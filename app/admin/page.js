'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PW || 'neonframe2025'

function calcPrices(basePrice, discType, discVal, vatPct) {
  const base = parseFloat(basePrice) || 0
  const dv = parseFloat(discVal) || 0
  const vat = parseFloat(vatPct) || 19
  const net = discType === 'pct' ? base * (1 - dv / 100) : Math.max(0, base - dv)
  const vatAmt = net * (vat / 100)
  const total = net + vatAmt
  const rrp = base * (1 + vat / 100)
  const discAmt = discType === 'pct' ? base * (dv / 100) : dv
  return { net, vatAmt, total, rrp, discAmt }
}

function colorDot(s = '') {
  const c = s.toLowerCase()
  if (c.includes('ice blue') || c.includes('blue') || c.includes('blau')) return '#60c8f0'
  if (c.includes('warm white') || c.includes('warm')) return '#fef3c7'
  if (c.includes('white') || c.includes('weiß')) return '#e5e5e5'
  if (c.includes('red') || c.includes('rot')) return '#ef4444'
  if (c.includes('green') || c.includes('grün')) return '#22c55e'
  if (c.includes('pink')) return '#ec4899'
  if (c.includes('purple') || c.includes('lila')) return '#a855f7'
  if (c.includes('yellow') || c.includes('gelb')) return '#f59e0b'
  if (c.includes('soft orange') || c.includes('orange')) return '#fb923c'
  return '#9ca3af'
}

async function extractPdfText(file) {
  const pdfjsLib = (await import('pdfjs-dist')).default || (await import('pdfjs-dist'))
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  let txt = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    txt += '\n' + content.items.map(x => x.str).join(' ')
  }
  return txt
}

function parsePdfFields(txt) {
  const get = (patterns) => { for (const p of patterns) { const m = txt.match(p); if (m) return (m[1] || m[0]).trim() } return '' }
  const num = get([/Angebots(?:nummer|nr\.?|#)[:\s•#]+([A-Z0-9\-]{3,20})/i])
  const project = get([/(?:Projekt|Project)[:\s•]+([^\n•|]{2,60}?)(?:\s*[•|\n]|$)/i, /(?:Kunde|für)[:\s]+([^\n]{2,50})/i])
  let w = '', h = ''
  for (const p of [/(\d+)\s*[xX×]\s*(\d+)\s*cm/, /Abmessungen[^0-9]*(\d+)\s*[xX×]\s*(\d+)/i]) { const m = txt.match(p); if (m) { w = m[1]; h = m[2]; break } }
  const colors = get([/Farbe[n]?\s*[\(\)a-z]*\s*[•:\-]\s*([^\n•]{2,60}?)(?:\s*(?:Gesamt|MwSt|\n))/i])
  let price = ''
  for (const p of [/Gesamt[^€\d]*€\s*([\d.,]+)/i, /€\s*([\d.,]+)\s*(?:netto|zzgl)/i, /(\d{2,6}[.,]\d{2})\s*€/]) { const m = txt.match(p); if (m) { price = m[1].replace(',', '.'); break } }
  return { num, project, w, h, colors, price }
}

const BACKPLATE_OPTIONS = ['Ausgeschnitten', 'Quadratisch', 'Ohne']
const BACKPLATE_COLOR_OPTIONS = ['Transparent', 'Schwarz', 'Weiß']
const USAGE_OPTIONS = ['Innen', 'Außen IP65']

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState(false)
  const [tab, setTab] = useState('create')
  const [offers, setOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)

  // ── KEY FIX: store ALL form values in a ref, never in state ──
  // This means text inputs are UNCONTROLLED (defaultValue only).
  // Only selects and price fields use state (because they need to re-render the price display).
  const fRef = useRef({
    num: '', project: '', w: '', h: '',
    backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen',
    color: '', basePrice: '', discType: 'pct', discVal: '20', vat: '19',
    delivery: '', url: '',
  })

  // State only for things that MUST re-render: selects + price numbers
  const [selects, setSelects] = useState({ backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen', discType: 'pct' })
  const [priceInputs, setPriceInputs] = useState({ basePrice: '', discVal: '20', vat: '19' })

  const [imgSrcs, setImgSrcs] = useState([null, null, null])
  const [parseStatus, setParseStatus] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishedLink, setPublishedLink] = useState(null)
  const iframeRef = useRef(null)

  const prices = calcPrices(priceInputs.basePrice, selects.discType, priceInputs.discVal, priceInputs.vat)

  // Text input: update ref only (no re-render → no focus loss), then schedule preview
  const updText = (k, v) => { fRef.current[k] = v; schedulePreview() }

  // Select: update ref + state (need re-render for controlled select)
  const updSelect = (k, v) => { fRef.current[k] = v; setSelects(p => ({ ...p, [k]: v })) }

  // Price input: update ref + state (need re-render for price display)
  const updPrice = (k, v) => { fRef.current[k] = v; setPriceInputs(p => ({ ...p, [k]: v })) }

  const debounceRef = useRef(null)
  const schedulePreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { renderPreviewFromRef() }, 400)
  }, [])

  // Trigger preview when selects/prices/images change
  useEffect(() => { if (authed) schedulePreview() }, [selects, priceInputs, imgSrcs, authed])

  function renderPreviewFromRef() {
    if (!iframeRef.current) return
    const f = { ...fRef.current, ...selects, ...priceInputs }
    const p = calcPrices(f.basePrice, f.discType, f.discVal, f.vat)
    const colors = f.color.split(',').map(c => c.trim()).filter(Boolean)
    const colorPills = colors.map(c => `<div style="display:inline-flex;align-items:center;gap:6px;background:#f5f5f5;border:1px solid #eee;border-radius:20px;padding:6px 12px;font-size:12px;color:#333;margin-right:5px;margin-bottom:5px"><span style="width:9px;height:9px;border-radius:50%;background:${colorDot(c)};display:inline-block;border:1px solid rgba(0,0,0,.08)"></span>${c}</div>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#fff;font-size:14px}
.hdr{background:#0a0a0a;padding:0 28px;height:72px;display:flex;align-items:center;justify-content:space-between}
.badge{background:rgba(96,200,240,.12);border:1px solid rgba(96,200,240,.3);color:#60c8f0;font-size:12px;font-weight:600;padding:6px 14px;border-radius:20px}
.wrap{display:grid;grid-template-columns:1.2fr 1fr;gap:36px;padding:28px;max-width:1100px}
.img-box{border-radius:14px;overflow:hidden;background:#f5f5f5;border:1px solid #eee;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center}
.img-box img{width:100%;height:100%;object-fit:contain;display:block}
.contact-card{margin-top:14px;background:#fff;border:1px solid #eee;border-radius:12px;padding:16px}
.contact-hdr{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.contact-hdr img{width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0}
.contact-hdr h3{font-size:13px;font-weight:700;margin-bottom:2px}
.contact-hdr p{font-size:11px;color:#999;line-height:1.4}
.contact-card textarea{width:100%;background:#fafafa;border:1px solid #e8e8e8;border-radius:8px;padding:9px 11px;font-size:12px;resize:vertical;min-height:60px;font-family:inherit;outline:none;margin-bottom:8px;display:block}
.contact-card button{background:#0a0a0a;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
h1{font-size:22px;font-weight:800;line-height:1.2;letter-spacing:-.02em;margin-bottom:8px}
.stars-row{display:flex;align-items:center;gap:6px;margin-bottom:10px}
.stars{color:#f59e0b;font-size:16px}
.stars-lbl{font-size:12px;color:#666}
.badge-made{display:inline-flex;align-items:center;gap:8px;background:#f5f5f5;border:1px solid #e8e8e8;border-radius:10px;padding:6px 11px;margin-bottom:14px}
.badge-made .name{font-size:12px;color:#555}
.badge-made strong{color:#111}
.sz-row{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:10px;align-items:flex-start}
.cfg-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:flex-end}
.cfg-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111;display:block;margin-bottom:3px}
.pill{display:inline-flex;align-items:center;gap:5px;background:#f5f5f5;border:1px solid #eee;border-radius:20px;padding:5px 11px;font-size:12px;font-weight:500;color:#333}
.checks{margin-bottom:14px;display:flex;flex-direction:column;gap:7px}
.ck{display:flex;align-items:flex-start;gap:7px;font-size:12px;color:#555;line-height:1.5}
.ck-icon{color:#22c55e;font-size:13px;flex-shrink:0}
.price-box{background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:14px;margin-bottom:10px}
.pr{display:flex;justify-content:space-between;font-size:12px;color:#999;padding:3px 0}
.pr-d{display:flex;justify-content:space-between;font-size:12px;color:#16a34a;padding:3px 0;font-weight:600}
.pr-n{display:flex;justify-content:space-between;font-size:12px;color:#111;padding:3px 0}
.pr-g{display:flex;justify-content:space-between;font-size:12px;color:#999;padding:3px 0}
.divider{border-top:1px solid #f0f0f0;margin:8px 0}
.total{display:flex;justify-content:space-between;align-items:baseline}
.tlbl{font-size:13px;font-weight:700;color:#111}
.tval{font-size:20px;font-weight:800;color:#111;letter-spacing:-.02em}
.tval-note{font-size:10px;color:#888;margin-left:5px;font-weight:400}
.ship{background:#f0fbff;border:1px solid #b8e8f8;border-radius:10px;padding:10px 13px;display:flex;align-items:center;gap:9px;margin-bottom:5px}
.ship-icon{color:#60c8f0;font-size:15px}
.ship strong{display:block;font-size:12px;font-weight:700;color:#111;margin-bottom:1px}
.ship span{font-size:11px;color:#888}
.cta{width:100%;background:#16a34a;color:#fff;border:none;border-radius:11px;padding:14px;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;margin:10px 0;cursor:pointer;font-family:inherit}
.feats{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}
.feat{background:#fff;border:1px solid #eee;border-radius:10px;padding:10px;display:flex;align-items:flex-start;gap:8px}
.feat-icon{width:28px;height:28px;background:#f0fbff;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid #d0f0fc;color:#60c8f0;font-size:12px}
.feat strong{display:block;font-size:11px;font-weight:700;margin-bottom:1px}
.feat span{font-size:10px;color:#888;line-height:1.4}
</style></head><body>
<div class="hdr">
  <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" style="height:52px">
  ${f.num ? `<div class="badge">Angebot #${f.num}</div>` : ''}
</div>
<div class="wrap">
  <div>
    <div class="img-box">
      ${imgSrcs[0] ? `<img src="${imgSrcs[0]}">` : '<span style="color:#ccc;font-size:12px">Vorschau-Bild</span>'}
    </div>
    <div class="contact-card">
      <div class="contact-hdr">
        <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_19_21_39_800x800.png?v=1778783280" alt="Support">
        <div><h3>Noch Fragen oder Änderungswünsche?</h3><p>Wir melden uns schnellstmöglich.</p></div>
      </div>
      <textarea placeholder="z.B. Kann die Farbe noch angepasst werden?"></textarea>
      <button>✉ Per E-Mail senden</button>
    </div>
  </div>
  <div>
    <h1>Individuelles LED-Neon-Schild –<br>personalisiert nach Wunsch</h1>
    <div class="stars-row"><div class="stars">★★★★<span style="color:#e5e7eb">★</span></div><span class="stars-lbl">4,5 / 5 Sternen</span></div>
    ${f.project ? `<div class="badge-made"><span class="name">Individuell angefertigt für <strong>${f.project}</strong></span></div>` : ''}
    <div class="sz-row">
      ${f.w && f.h ? `<div><span class="cfg-lbl">Maße (Breite × Höhe)</span><div class="pill" style="margin-top:3px">${f.w} × ${f.h} cm</div></div>` : ''}
      ${colors.length > 0 ? `<div><span class="cfg-lbl">Farbe</span><div style="margin-top:3px">${colorPills}</div></div>` : ''}
    </div>
    <div class="cfg-row">
      ${f.backplate ? `<div><span class="cfg-lbl">Rückwandform</span><div class="pill" style="margin-top:3px">${f.backplate}</div></div>` : ''}
      ${f.backplate_color ? `<div><span class="cfg-lbl">Rückwandfarbe</span><div class="pill" style="margin-top:3px">${f.backplate_color}</div></div>` : ''}
      ${f.usage ? `<div><span class="cfg-lbl">Verwendungszweck</span><div class="pill" style="margin-top:3px">${f.usage}</div></div>` : ''}
    </div>
    <div class="checks">
      <div class="ck"><span class="ck-icon">✓</span><span>Einfach zu installieren mit Montagematerial</span></div>
      <div class="ck"><span class="ck-icon">✓</span><span>Inklusive Fernbedienung, 3m Kabel, Adapter und Dimmer</span></div>
      <div class="ck"><span class="ck-icon">✓</span><span>Langlebige und hochwertige Nutzung</span></div>
    </div>
    <div class="price-box">
      ${parseFloat(f.basePrice) > 0 ? `<div class="pr"><span>Listenpreis (netto)</span><span>€ ${parseFloat(f.basePrice).toFixed(2)}</span></div>` : ''}
      ${p.discAmt > 0 ? `<div class="pr-d"><span>− Rabatt (${f.discType === 'pct' ? f.discVal + '%' : '€ ' + parseFloat(f.discVal).toFixed(2)})</span><span>− € ${p.discAmt.toFixed(2)}</span></div>` : ''}
      ${p.net > 0 ? `<div class="pr-n"><span>Netto-Preis nach Rabatt</span><span>€ ${p.net.toFixed(2)}</span></div>` : ''}
      ${p.vatAmt > 0 ? `<div class="pr-g"><span>+ MwSt. (${f.vat}%)</span><span>+ € ${p.vatAmt.toFixed(2)}</span></div>` : ''}
      <div class="divider"></div>
      <div class="total"><span class="tlbl">Gesamtbetrag</span><span class="tval">${p.total > 0 ? '€ ' + p.total.toFixed(2) : '–'}${p.total > 0 ? '<span class="tval-note">(inkl. MwSt.)</span>' : ''}</span></div>
    </div>
    <div class="cta">🛒 Angebot annehmen</div>
    <div class="ship"><div class="ship-icon">🚚</div><div><strong>Kostenloser Versand</strong><span>${f.delivery ? 'Geliefert zwischen ' + f.delivery : 'Lieferzeit 2–3 Wochen'}</span></div></div>
    <div class="feats">
      <div class="feat"><div class="feat-icon">🛡</div><div><strong>Qualitätsgarantie</strong><span>Hochwertige Neonfertigung</span></div></div>
      <div class="feat"><div class="feat-icon">📦</div><div><strong>Komplettpaket</strong><span>Netzteil, Dimmer, FB</span></div></div>
      <div class="feat"><div class="feat-icon">⚡</div><div><strong>Einfache Installation</strong><span>In Minuten montiert</span></div></div>
      <div class="feat"><div class="feat-icon">♾</div><div><strong>Extrem langlebig</strong><span>100.000 Std. Lebensdauer</span></div></div>
    </div>
  </div>
</div>
</body></html>`
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document
    if (doc) { doc.open(); doc.write(html); doc.close() }
  }

  async function handlePDF(e) {
    const file = e.target.files[0]; if (!file) return
    setParseStatus({ type: 'loading', msg: 'PDF wird gelesen...' })
    try {
      const txt = await extractPdfText(file)
      const p = parsePdfFields(txt)
      // Update refs
      if (p.num) fRef.current.num = p.num
      if (p.project) fRef.current.project = p.project
      if (p.w) fRef.current.w = p.w
      if (p.h) fRef.current.h = p.h
      if (p.colors) fRef.current.color = p.colors
      if (p.price) fRef.current.basePrice = p.price
      // Force price display update
      if (p.price) setPriceInputs(prev => ({ ...prev, basePrice: p.price }))
      // Force re-render for input defaultValues by remounting — simplest approach
      setParseStatus({ type: 'ok', msg: `${Object.values(p).filter(Boolean).length} Felder erkannt – bitte prüfen` })
      schedulePreview()
    } catch (err) {
      setParseStatus({ type: 'err', msg: 'Fehler: ' + err.message })
    }
  }

  function handleImage(e, idx) {
    const file = e.target.files[0]; if (!file) return
    const r = new FileReader(); r.onload = ev => setImgSrcs(prev => { const next=[...prev]; next[idx]=ev.target.result; return next; }); r.readAsDataURL(file)
  }

  async function publish() {
    setPublishing(true)
    const f = { ...fRef.current, ...selects, ...priceInputs }
    try {
      const payload = {
        offer_num: f.num, project: f.project,
        width: f.w, height: f.h,
        backplate: f.backplate, backplate_color: f.backplate_color, usage: f.usage,
        colors: f.color,
        base_price: parseFloat(f.basePrice) || 0, disc_type: f.discType,
        disc_val: parseFloat(f.discVal) || 0, vat_pct: parseFloat(f.vat) || 19,
        net_price: prices.net, final_price: prices.total, rrp_price: prices.rrp,
        delivery: f.delivery,
        checkout_url: f.url, preview_image: null, preview_image_2: null, preview_image_3: null, published: true,
      }
      const imgFields = ['preview_image', 'preview_image_2', 'preview_image_3']
      for (let i = 0; i < 3; i++) {
        if (imgSrcs[i]?.startsWith('data:')) {
          const blob = await (await fetch(imgSrcs[i])).blob()
          const fd = new FormData(); fd.append('file', blob, `offer-${Date.now()}-${i}.jpg`); fd.append('offerId', f.num || 'new')
          const up = await fetch('/api/upload', { method: 'POST', body: fd })
          const upData = await up.json()
          if (upData.url) payload[imgFields[i]] = upData.url
        }
      }
      const res = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const id = data.custom_id || data.id
      const link = `${window.location.origin}/angebot/${id}`
      setPublishedLink(link)
      await navigator.clipboard.writeText(link).catch(() => {})
      alert(`Veröffentlicht!\n\nLink kopiert:\n${link}`)
    } catch (err) { alert('Fehler: ' + err.message) }
    finally { setPublishing(false) }
  }

  async function loadOffers() {
    setLoadingOffers(true)
    try { const res = await fetch('/api/offers'); const data = await res.json(); setOffers(Array.isArray(data) ? data : []) }
    catch { setOffers([]) }
    setLoadingOffers(false)
  }

  async function toggleOffer(id, published) {
    await fetch(`/api/offers?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ published: !published }) })
    loadOffers()
  }

  async function deleteOffer(id) {
    if (!confirm('Angebot wirklich löschen?')) return
    await fetch(`/api/offers?id=${id}`, { method: 'DELETE' })
    loadOffers()
  }

  useEffect(() => { if (authed && tab === 'manage') loadOffers() }, [authed, tab])

  if (!authed) return (
    <div style={{position:'fixed',inset:0,background:'#f9fafb',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:16,padding:40,width:360,textAlign:'center',boxShadow:'0 4px 24px rgba(0,0,0,.08)'}}>
        <div style={{background:'#0a0a0a',padding:'12px 16px',borderRadius:10,display:'inline-block',marginBottom:20}}>
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" style={{height:40,display:'block'}} />
        </div>
        <div style={{fontSize:14,color:'#6b7280',marginBottom:24}}>Admin-Bereich · Nur autorisierter Zugriff</div>
        <input type="password" placeholder="Passwort" value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { pw === ADMIN_PW ? (setAuthed(true), setPwErr(false)) : setPwErr(true) } }}
          style={{width:'100%',border:'1px solid #e5e7eb',borderRadius:10,padding:'11px 14px',fontSize:16,textAlign:'center',letterSpacing:3,marginBottom:12,outline:'none',fontFamily:'inherit'}}
        />
        <button onClick={() => pw === ADMIN_PW ? (setAuthed(true), setPwErr(false)) : setPwErr(true)}
          style={{width:'100%',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:10,padding:12,fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
          Einloggen
        </button>
        {pwErr && <div style={{color:'#ef4444',fontSize:13,marginTop:10}}>Falsches Passwort</div>}
      </div>
    </div>
  )

  const S = {
    app: {display:'flex',flexDirection:'column',height:'100vh',background:'#fff',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'},
    topbar: {background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0},
    tabs: {display:'flex',gap:4},
    tab: (a) => ({padding:'6px 16px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',border:'none',background:a?'#0a0a0a':'transparent',color:a?'#fff':'#6b7280',fontFamily:'inherit',transition:'.15s'}),
    main: {display:'flex',flex:1,overflow:'hidden'},
    left: {width:390,flexShrink:0,overflowY:'auto',borderRight:'1px solid #e5e7eb',display:'flex',flexDirection:'column',background:'#fff'},
    section: {borderBottom:'1px solid #f3f4f6',padding:'16px 20px'},
    sTitle: {fontSize:11,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12},
    label: {fontSize:10,fontWeight:600,color:'#6b7280',textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:5},
    input: {background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:'9px 12px',color:'#111',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%'},
    select: {background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:'9px 12px',color:'#111',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%',cursor:'pointer'},
    row2: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:10},
    uploadRow: {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8},
    uploadZone: {border:'1px dashed #e5e7eb',borderRadius:10,padding:'14px 10px',textAlign:'center',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:6,position:'relative',background:'#fafafa'},
    status: (t) => ({fontSize:12,padding:'8px 12px',borderRadius:8,marginTop:8,background:t==='ok'?'#f0fdf4':t==='warn'?'#fffbeb':'#fef2f2',border:`1px solid ${t==='ok'?'#bbf7d0':t==='warn'?'#fde68a':'#fecaca'}`,color:t==='ok'?'#166534':t==='warn'?'#92400e':'#991b1b'}),
    publishArea: {padding:'16px 20px',marginTop:'auto',borderTop:'1px solid #e5e7eb'},
    btnGreen: {background:'#16a34a',color:'#fff',border:'none',borderRadius:10,padding:'13px 20px',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit',width:'100%',marginBottom:8},
    btnDark: {background:'#0a0a0a',color:'#fff',border:'none',borderRadius:8,padding:'9px 14px',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'},
    btnOutline: {background:'transparent',border:'1px solid #e5e7eb',color:'#374151',borderRadius:8,padding:'9px 14px',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'},
    linkBox: {background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:10,display:'flex',alignItems:'center',gap:8,marginTop:8},
    right: {flex:1,position:'relative',overflow:'hidden',background:'#f3f4f6'},
    iframe: {width:'100%',height:'100%',border:'none',display:'block',background:'#fff'},
    previewLabel: {position:'absolute',top:10,right:10,background:'rgba(0,0,0,.6)',color:'#fff',fontSize:11,padding:'4px 10px',borderRadius:20,zIndex:10,pointerEvents:'none'},
  }

  const Field = ({ label, children }) => (
    <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={S.label}>{label}</label>{children}</div>
  )

  if (tab === 'manage') return (
    <div style={S.app}>
      <div style={S.topbar}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{background:'#0a0a0a',padding:'6px 10px',borderRadius:8}}><img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NF" style={{height:24,display:'block'}} /></div>
          <div style={S.tabs}><button style={S.tab(false)} onClick={() => setTab('create')}>Erstellen</button><button style={S.tab(true)}>Verwalten</button></div>
        </div>
        <button style={S.btnOutline} onClick={() => setAuthed(false)}>Abmelden</button>
      </div>
      <div style={{padding:32,overflowY:'auto',flex:1,background:'#f9fafb'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
            <h2 style={{fontSize:20,fontWeight:700}}>Alle Angebote</h2>
            <button style={S.btnDark} onClick={loadOffers}>Aktualisieren</button>
          </div>
          {loadingOffers ? <div style={{textAlign:'center',padding:60,color:'#9ca3af',fontSize:14}}>Wird geladen...</div>
          : offers.length === 0 ? <div style={{textAlign:'center',padding:60,color:'#9ca3af',fontSize:14}}>Noch keine Angebote.</div>
          : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {offers.map(o => {
                const id = o.custom_id || o.id?.slice(0,8)
                const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/angebot/${o.custom_id || o.id}`
                return (
                  <div key={o.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',gap:16}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                        <span style={{fontSize:15,fontWeight:700}}>#{id}</span>
                        {o.project && <span style={{fontSize:14,color:'#6b7280'}}>{o.project}</span>}
                        <span style={{fontSize:12,fontWeight:600,padding:'3px 10px',borderRadius:20,background:o.published?'#f0fdf4':'#f3f4f6',color:o.published?'#166534':'#6b7280',border:`1px solid ${o.published?'#bbf7d0':'#e5e7eb'}`}}>{o.published?'Aktiv':'Inaktiv'}</span>
                      </div>
                      <div style={{fontSize:13,color:'#9ca3af',display:'flex',gap:16,flexWrap:'wrap'}}>
                        {o.width && o.height && <span>{o.width} × {o.height} cm</span>}
                        {o.colors && <span>{o.colors}</span>}
                        {o.final_price > 0 && <span style={{fontWeight:600,color:'#374151'}}>€ {parseFloat(o.final_price).toFixed(2)}</span>}
                      </div>
                      {o.published && (
                        <div style={{marginTop:8,display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:12,color:'#9ca3af',fontFamily:'monospace'}}>{link}</span>
                          <button onClick={() => navigator.clipboard.writeText(link)} style={{...S.btnOutline,padding:'3px 10px',fontSize:11}}>Kopieren</button>
                          <a href={link} target="_blank" rel="noopener" style={{...S.btnOutline,padding:'3px 10px',fontSize:11,textDecoration:'none',display:'inline-block'}}>Öffnen</a>
                        </div>
                      )}
                    </div>
                    <div style={{display:'flex',gap:8,flexShrink:0}}>
                      <button onClick={() => toggleOffer(o.id, o.published)} style={{...S.btnOutline,fontSize:12}}>{o.published?'Deaktivieren':'Aktivieren'}</button>
                      <button onClick={() => deleteOffer(o.id)} style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',borderRadius:8,padding:'9px 14px',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Löschen</button>
                    </div>
                  </div>
                )
              })}
            </div>}
        </div>
      </div>
    </div>
  )

  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{background:'#0a0a0a',padding:'6px 10px',borderRadius:8}}><img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NF" style={{height:24,display:'block'}} /></div>
          <div style={S.tabs}><button style={S.tab(true)}>Erstellen</button><button style={S.tab(false)} onClick={() => setTab('manage')}>Verwalten</button></div>
        </div>
        <button style={S.btnOutline} onClick={() => setAuthed(false)}>Abmelden</button>
      </div>

      <div style={S.main}>
        <div style={S.left}>
          {/* BILDER */}
          <div style={S.section}>
            <div style={S.sTitle}>Dateien hochladen</div>
            <div style={S.uploadRow}>
              {[0,1,2].map(idx => (
                <label key={idx} style={S.uploadZone} htmlFor={`img-${idx}`}>
                  <input id={`img-${idx}`} type="file" accept="image/*" style={{display:'none'}} onChange={e => handleImage(e, idx)} />
                  {imgSrcs[idx]
                    ? <img src={imgSrcs[idx]} style={{width:'100%',height:60,objectFit:'cover',borderRadius:6}} alt="" />
                    : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span style={{fontSize:10,color:'#9ca3af',lineHeight:1.3,textAlign:'center'}}>Bild {idx+1}</span></>
                  }
                </label>
              ))}
            </div>
            <label style={{...S.uploadZone,marginTop:8,flexDirection:'row',padding:'10px 14px',justifyContent:'flex-start',gap:10}} htmlFor="pdf-upload">
              <input id="pdf-upload" type="file" accept=".pdf" style={{display:'none'}} onChange={handlePDF} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{fontSize:12,color:'#9ca3af'}}>PDF hochladen (automatisch ausfüllen)</span>
            </label>
            {parseStatus && <div style={S.status(parseStatus.type)}>{parseStatus.msg}</div>}
          </div>

          {/* ANGEBOTSDATEN — uncontrolled inputs (defaultValue) */}
          <div style={S.section}>
            <div style={S.sTitle}>Angebotsdaten</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Angebotsnummer">
                <input style={S.input} defaultValue={fRef.current.num} onChange={e => updText('num', e.target.value)} placeholder="NF-1001" />
              </Field>
              <Field label="Projekt / Kundenname">
                <input style={S.input} defaultValue={fRef.current.project} onChange={e => updText('project', e.target.value)} placeholder="z.B. esskultur – Max Mustermann" />
              </Field>
              <div style={S.row2}>
                <Field label="Breite (cm)"><input style={S.input} type="number" defaultValue={fRef.current.w} onChange={e => updText('w', e.target.value)} /></Field>
                <Field label="Höhe (cm)"><input style={S.input} type="number" defaultValue={fRef.current.h} onChange={e => updText('h', e.target.value)} /></Field>
              </div>
              <Field label="Farbe(n) – kommagetrennt">
                <input style={S.input} defaultValue={fRef.current.color} onChange={e => updText('color', e.target.value)} placeholder="z.B. Soft Orange, Pink" />
              </Field>
            </div>
          </div>

          {/* KONFIGURATION — controlled selects */}
          <div style={S.section}>
            <div style={S.sTitle}>Konfiguration</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Rückwandform">
                <select style={S.select} value={selects.backplate} onChange={e => updSelect('backplate', e.target.value)}>
                  {BACKPLATE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Rückwandfarbe">
                <select style={S.select} value={selects.backplate_color} onChange={e => updSelect('backplate_color', e.target.value)}>
                  {BACKPLATE_COLOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Verwendungszweck">
                <select style={S.select} value={selects.usage} onChange={e => updSelect('usage', e.target.value)}>
                  {USAGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* PREIS — price inputs use state for live display */}
          <div style={S.section}>
            <div style={S.sTitle}>Preiskalkulation</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Listenpreis (netto)">
                <input style={S.input} type="number" step="0.01" value={priceInputs.basePrice} onChange={e => updPrice('basePrice', e.target.value)} placeholder="0.00" />
              </Field>
              <div style={S.row2}>
                <Field label="Rabatt-Typ">
                  <select style={S.select} value={selects.discType} onChange={e => updSelect('discType', e.target.value)}>
                    <option value="pct">Prozent (%)</option><option value="eur">Euro (€)</option>
                  </select>
                </Field>
                <Field label={`Rabatt (${selects.discType==='pct'?'%':'€'})`}>
                  <input style={S.input} type="number" step="0.01" value={priceInputs.discVal} onChange={e => updPrice('discVal', e.target.value)} />
                </Field>
              </div>
              <div style={S.row2}>
                <Field label="MwSt. (%)">
                  <input style={S.input} type="number" step="0.1" value={priceInputs.vat} onChange={e => updPrice('vat', e.target.value)} />
                </Field>
                <Field label="Checkout-URL">
                  <input style={S.input} defaultValue={fRef.current.url} onChange={e => updText('url', e.target.value)} placeholder="https://..." />
                </Field>
              </div>
              <div style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                {[['Netto',prices.net>0?`€ ${prices.net.toFixed(2)}`:'–',false],['+ MwSt.',prices.vatAmt>0?`€ ${prices.vatAmt.toFixed(2)}`:'–',false],['Endpreis',prices.total>0?`€ ${prices.total.toFixed(2)}`:'–',true]].map(([l,v,a])=>(
                  <div key={l}><div style={{fontSize:10,color:a?'#16a34a':'#9ca3af',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>{l}</div><div style={{fontSize:14,fontWeight:700,color:a?'#16a34a':'#111'}}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>

          {/* LIEFERDATUM */}
          <div style={S.section}>
            <div style={S.sTitle}>Weitere Einstellungen</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Lieferdatum">
                <input style={S.input} defaultValue={fRef.current.delivery} onChange={e => updText('delivery', e.target.value)} placeholder="z.B. 27. Mai und 3. Juni" />
              </Field>
            </div>
          </div>

          {/* PUBLISH */}
          <div style={S.publishArea}>
            <button style={S.btnGreen} onClick={publish} disabled={publishing}>{publishing?'Wird veröffentlicht...':'Angebotsseite veröffentlichen'}</button>
            {publishedLink && (
              <div style={S.linkBox}>
                <input value={publishedLink} readOnly style={{flex:1,background:'transparent',border:'none',fontSize:12,color:'#16a34a',outline:'none',fontFamily:'monospace'}} />
                <button onClick={() => navigator.clipboard.writeText(publishedLink)} style={{...S.btnOutline,padding:'4px 10px',fontSize:11,flexShrink:0}}>Kopieren</button>
              </div>
            )}
          </div>
        </div>

        {/* PREVIEW */}
        <div style={S.right}>
          <div style={S.previewLabel}>Live-Vorschau</div>
          <iframe ref={iframeRef} style={S.iframe} title="Vorschau" />
        </div>
      </div>
    </div>
  )
}
