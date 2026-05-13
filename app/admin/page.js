'use client'
import { useState, useEffect, useRef } from 'react'

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
  if (c.includes('white') || c.includes('weiß')) return '#f3f4f6'
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
  const get = (patterns) => {
    for (const p of patterns) { const m = txt.match(p); if (m) return (m[1] || m[0]).trim() }
    return ''
  }
  const date = get([/Angebotsdatum[:\s•]+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i, /(\d{1,2}\.\d{1,2}\.\d{4})/])
  const num = get([/Angebots(?:nummer|nr\.?|#)[:\s•#]+([A-Z0-9\-]{3,20})/i])
  const project = get([/(?:Projekt|Project)[:\s•]+([^\n•|]{2,60}?)(?:\s*[•|\n]|$)/i, /(?:Kunde|für)[:\s]+([^\n]{2,50})/i])
  let w = '', h = ''
  for (const p of [/(\d+)\s*[xX×]\s*(\d+)\s*cm/, /Abmessungen[^0-9]*(\d+)\s*[xX×]\s*(\d+)/i]) {
    const m = txt.match(p); if (m) { w = m[1]; h = m[2]; break }
  }
  const backplate = get([/R[üu]ckplatte?[:\s•-]+([^\n•]{2,60}?)(?:\s*(?:Verwendung|Farbe|\n))/i])
  const usage = get([/Verwendung[:\s•-]+([^\n•]{2,50})/i])
  const colors = get([/Farbe[n]?\s*[\(\)a-z]*\s*[•:\-]\s*([^\n•]{2,60}?)(?:\s*(?:Gesamt|MwSt|\n))/i])
  let price = ''
  for (const p of [/Gesamt[^€\d]*€\s*([\d.,]+)/i, /€\s*([\d.,]+)\s*(?:netto|zzgl)/i, /(\d{2,6}[.,]\d{2})\s*€/]) {
    const m = txt.match(p); if (m) { price = m[1].replace(',', '.'); break }
  }
  return { date, num, project, w, h, backplate, usage, colors, price }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState(false)
  const [tab, setTab] = useState('create') // 'create' | 'manage'
  const [offers, setOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)

  const [f, setF] = useState({
    date: '', num: '', project: '', w: '', h: '',
    backplate: '', usage: '', color: '',
    basePrice: '', discType: 'pct', discVal: '20', vat: '19',
    delivery: '', note: '', valid: '', url: '',
  })
  const [imgSrc, setImgSrc] = useState(null)
  const [parseStatus, setParseStatus] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishedLink, setPublishedLink] = useState(null)
  const iframeRef = useRef(null)

  const prices = calcPrices(f.basePrice, f.discType, f.discVal, f.vat)
  const upd = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    const today = new Date()
    const valid = new Date(); valid.setDate(today.getDate() + 30)
    setF(prev => ({ ...prev, date: today.toLocaleDateString('de-DE'), valid: valid.toLocaleDateString('de-DE') }))
  }, [])

  useEffect(() => { if (authed) renderPreview() }, [f, imgSrc, prices.total])

  function renderPreview() {
    if (!iframeRef.current) return
    const colors = f.color.split(',').map(c => c.trim()).filter(Boolean)
    const colorPills = colors.map(c => `
      <div style="display:inline-flex;align-items:center;gap:7px;border:1.5px solid #d1d5db;border-radius:30px;padding:8px 16px;font-size:14px;font-weight:500;color:#111827;background:#fff;margin-right:8px;margin-bottom:8px">
        <span style="width:12px;height:12px;border-radius:50%;background:${colorDot(c)};border:1.5px solid rgba(0,0,0,.12);display:inline-block;flex-shrink:0"></span>${c}
      </div>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;background:#fff;font-size:16px}
.hdr{background:#fff;border-bottom:1px solid #e5e7eb;padding:0 32px;height:64px;display:flex;align-items:center;justify-content:space-between}
.badge{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px}
.wrap{display:grid;grid-template-columns:1fr 1fr;gap:48px;padding:36px 32px;max-width:1100px}
.img-box{border-radius:14px;overflow:hidden;background:#f9fafb;border:1px solid #e5e7eb;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center}
.img-box img{width:100%;height:100%;object-fit:cover;display:block}
.contact-card{margin-top:18px;border:1px solid #e5e7eb;border-radius:12px;padding:20px;background:#fff}
.contact-card h3{font-size:15px;font-weight:700;margin-bottom:5px}
.contact-card p{font-size:13px;color:#6b7280;margin-bottom:14px;line-height:1.5}
.contact-card textarea{width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;font-size:13px;resize:vertical;min-height:70px;background:#f9fafb;font-family:inherit;outline:none;margin-bottom:10px;display:block}
.contact-card button{background:#111827;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
h1{font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-.02em;margin-bottom:24px}
.lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;display:block;margin-bottom:7px}
.pill{display:inline-flex;align-items:center;gap:7px;border:1.5px solid #d1d5db;border-radius:30px;padding:8px 16px;font-size:14px;font-weight:500;color:#111827}
.cfg-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.checks{margin-bottom:24px;display:flex;flex-direction:column;gap:10px}
.ck{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#374151;line-height:1.5}
.ck-icon{color:#16a34a;font-size:16px;flex-shrink:0;margin-top:2px}
.price-box{border:1px solid #e5e7eb;border-radius:12px;padding:22px;margin-bottom:18px}
.pr{display:flex;justify-content:space-between;font-size:14px;padding:5px 0;color:#9ca3af}
.pr-disc{display:flex;justify-content:space-between;font-size:14px;padding:5px 0;color:#16a34a;font-weight:600}
.pr-total{display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:6px}
.pr-total-label{font-size:14px;font-weight:700;color:#374151}
.pr-total-val{font-size:30px;font-weight:800;color:#111827;letter-spacing:-.02em}
.ship-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px}
.ship-txt strong{display:block;font-size:14px;font-weight:700;color:#166534}
.ship-txt span{font-size:13px;color:#166534}
.cta{width:100%;background:#16a34a;color:#fff;border:none;border-radius:10px;padding:16px;font-size:16px;font-weight:700;margin:16px 0 12px;cursor:pointer;font-family:inherit}
.pays{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:10px}
.pay{height:22px;object-fit:contain;opacity:.8}
.feats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}
.feat{border:1px solid #e5e7eb;border-radius:10px;padding:14px;display:flex;align-items:flex-start;gap:10px}
.feat-icon{width:34px;height:34px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px}
.feat strong{display:block;font-size:13px;font-weight:700;margin-bottom:2px}
.feat span{font-size:12px;color:#6b7280}
</style></head><body>
<div class="hdr">
  <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" style="height:36px;filter:invert(1)" alt="NeonFrame">
  ${f.num ? `<div class="badge">Angebot #${f.num}</div>` : ''}
</div>
<div class="wrap">
  <div>
    <div class="img-box">
      ${imgSrc ? `<img src="${imgSrc}">` : '<div style="color:#9ca3af;text-align:center"><div style="font-size:40px;margin-bottom:8px">💡</div><div style="font-size:14px">Vorschau-Bild</div></div>'}
    </div>
    <div class="contact-card">
      <h3>Fragen oder Anpassungswünsche?</h3>
      <p>Teilen Sie uns diese direkt hier mit – wir melden uns schnellstmöglich.</p>
      <textarea placeholder="z.B. Kann die Farbe noch angepasst werden?"></textarea>
      <button>Per E-Mail senden</button>
    </div>
  </div>
  <div>
    <h1>Individuelles LED-Neon-Schild –<br>personalisiert nach Wunsch</h1>
    ${f.w && f.h ? `<span class="lbl">Größe (Breite × Höhe)</span><div class="pill" style="margin-bottom:16px">${f.w} × ${f.h} cm</div>` : ''}
    <div class="cfg-row">
      ${colorPills}
      ${f.backplate ? `<div><span class="lbl" style="margin-bottom:5px">Rückwand</span><div class="pill">${f.backplate}</div></div>` : ''}
      ${f.usage ? `<div><span class="lbl" style="margin-bottom:5px">Modell</span><div class="pill">${f.usage}</div></div>` : ''}
    </div>
    <div class="checks">
      <div class="ck"><span class="ck-icon">✓</span><span>Einfach zu installieren mit dem mitgelieferten Montagematerial</span></div>
      <div class="ck"><span class="ck-icon">✓</span><span>Inklusive Fernbedienung, 3 Meter Stromkabel, Adapter und Dimmer</span></div>
      <div class="ck"><span class="ck-icon">✓</span><span>Seit über 10 Jahren die höchste Qualität Neon Signs in Europa</span></div>
    </div>
    <div class="price-box">
      ${parseFloat(f.basePrice) > 0 ? `<div class="pr"><span>Listenpreis (netto)</span><span>€ ${parseFloat(f.basePrice).toFixed(2)}</span></div>` : ''}
      ${prices.discAmt > 0 ? `<div class="pr-disc"><span>− Rabatt (${f.discType === 'pct' ? f.discVal + '%' : '€ ' + parseFloat(f.discVal).toFixed(2)})</span><span>− € ${prices.discAmt.toFixed(2)}</span></div>` : ''}
      ${prices.net > 0 ? `<div class="pr"><span>Netto nach Rabatt</span><span>€ ${prices.net.toFixed(2)}</span></div>` : ''}
      ${prices.vatAmt > 0 ? `<div class="pr"><span>+ MwSt. (${f.vat}%)</span><span>+ € ${prices.vatAmt.toFixed(2)}</span></div>` : ''}
      <div class="pr-total">
        <span class="pr-total-label">Gesamtbetrag</span>
        <span class="pr-total-val">${prices.total > 0 ? '€ ' + prices.total.toFixed(2) : '–'}</span>
      </div>
    </div>
    <div class="ship-box">
      <div>🚚</div>
      <div class="ship-txt"><strong>Kostenloser Versand</strong><span>${f.delivery ? 'Geliefert zwischen ' + f.delivery : 'Lieferzeit 2–3 Wochen'}</span></div>
    </div>
    <button class="cta">Angebot annehmen</button>
    <div class="pays">
      <img class="pay" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/124px-PayPal.svg.png" alt="PayPal">
      <img class="pay" src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/120px-Visa_Inc._logo.svg.png" alt="Visa">
      <img class="pay" src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/120px-Mastercard-logo.svg.png" alt="MC">
      <img class="pay" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Klarna_Payment_Badge.svg/120px-Klarna_Payment_Badge.svg.png" alt="Klarna" style="height:18px">
    </div>
    <div class="feats">
      <div class="feat"><div class="feat-icon">🛡</div><div><strong>2 Jahre Garantie</strong><span>Auf alle Innen-Neon-Schilder</span></div></div>
      <div class="feat"><div class="feat-icon">📦</div><div><strong>Komplettpaket</strong><span>Alles für sofortige Montage</span></div></div>
      <div class="feat"><div class="feat-icon">⚡</div><div><strong>Einfache Installation</strong><span>In wenigen Minuten fertig</span></div></div>
      <div class="feat"><div class="feat-icon">♾</div><div><strong>100.000 Std. Lebensdauer</strong><span>Langlebige PowerLEDs™</span></div></div>
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
      setF(prev => ({
        ...prev,
        date: p.date || prev.date, num: p.num || prev.num,
        project: p.project || prev.project, w: p.w || prev.w, h: p.h || prev.h,
        backplate: p.backplate || prev.backplate, usage: p.usage || prev.usage,
        color: p.colors || prev.color, basePrice: p.price || prev.basePrice,
      }))
      const filled = Object.values(p).filter(Boolean).length
      setParseStatus({ type: filled >= 4 ? 'ok' : 'warn', msg: `${filled} Felder erkannt – bitte prüfen` })
    } catch (err) {
      setParseStatus({ type: 'err', msg: 'Fehler: ' + err.message })
    }
  }

  function handleImage(e) {
    const file = e.target.files[0]; if (!file) return
    const r = new FileReader()
    r.onload = ev => setImgSrc(ev.target.result)
    r.readAsDataURL(file)
  }

  async function publish() {
    setPublishing(true)
    try {
      const payload = {
        offer_num: f.num, offer_date: f.date, project: f.project,
        width: f.w, height: f.h, backplate: f.backplate,
        usage: f.usage, colors: f.color,
        base_price: parseFloat(f.basePrice) || 0,
        disc_type: f.discType, disc_val: parseFloat(f.discVal) || 0,
        vat_pct: parseFloat(f.vat) || 19,
        net_price: prices.net, final_price: prices.total, rrp_price: prices.rrp,
        delivery: f.delivery, note: f.note, valid_until: f.valid,
        checkout_url: f.url, preview_image: null, published: true,
      }
      if (imgSrc?.startsWith('data:')) {
        const blob = await (await fetch(imgSrc)).blob()
        const fd = new FormData()
        fd.append('file', blob, `offer-${Date.now()}.jpg`)
        fd.append('offerId', f.num || 'new')
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upData = await up.json()
        if (upData.url) payload.preview_image = upData.url
      }
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const id = data.custom_id || data.id
      const link = `${window.location.origin}/angebot/${id}`
      setPublishedLink(link)
      await navigator.clipboard.writeText(link).catch(() => {})
      alert(`Veröffentlicht!\n\nLink kopiert:\n${link}`)
    } catch (err) {
      alert('Fehler: ' + err.message)
    } finally {
      setPublishing(false)
    }
  }

  async function loadOffers() {
    setLoadingOffers(true)
    try {
      const res = await fetch('/api/offers')
      const data = await res.json()
      setOffers(Array.isArray(data) ? data : [])
    } catch { setOffers([]) }
    setLoadingOffers(false)
  }

  async function toggleOffer(id, published) {
    await fetch(`/api/offers?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !published }),
    })
    loadOffers()
  }

  async function deleteOffer(id) {
    if (!confirm('Angebot wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return
    await fetch(`/api/offers?id=${id}`, { method: 'DELETE' })
    loadOffers()
  }

  useEffect(() => { if (authed && tab === 'manage') loadOffers() }, [authed, tab])

  // ── LOGIN ──
  if (!authed) return (
    <div style={{position:'fixed',inset:0,background:'#f9fafb',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:16,padding:40,width:360,textAlign:'center',boxShadow:'0 4px 24px rgba(0,0,0,.08)'}}>
        <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" style={{height:40,margin:'0 auto 20px',display:'block',filter:'invert(1)',background:'#0a0a14',padding:'8px 12px',borderRadius:8}} />
        <div style={{fontSize:14,color:'#6b7280',marginBottom:24}}>Admin-Bereich · Nur autorisierter Zugriff</div>
        <input type="password" placeholder="Passwort" value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { pw === ADMIN_PW ? (setAuthed(true), setPwErr(false)) : setPwErr(true) } }}
          style={{width:'100%',border:'1px solid #e5e7eb',borderRadius:10,padding:'11px 14px',fontSize:16,textAlign:'center',letterSpacing:3,marginBottom:12,outline:'none',fontFamily:'inherit'}}
        />
        <button onClick={() => pw === ADMIN_PW ? (setAuthed(true), setPwErr(false)) : setPwErr(true)}
          style={{width:'100%',background:'#111827',color:'#fff',border:'none',borderRadius:10,padding:12,fontWeight:600,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
          Einloggen
        </button>
        {pwErr && <div style={{color:'#ef4444',fontSize:13,marginTop:10}}>Falsches Passwort</div>}
      </div>
    </div>
  )

  const S = {
    app: { display:'flex', flexDirection:'column', height:'100vh', background:'#fff', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' },
    topbar: { background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 },
    tabs: { display:'flex', gap:4 },
    tab: (active) => ({ padding:'6px 16px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', background: active ? '#111827' : 'transparent', color: active ? '#fff' : '#6b7280', fontFamily:'inherit', transition:'.15s' }),
    main: { display:'flex', flex:1, overflow:'hidden' },
    left: { width:380, flexShrink:0, overflowY:'auto', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', background:'#fff' },
    section: { borderBottom:'1px solid #f3f4f6', padding:'16px 20px' },
    sTitle: { fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 },
    label: { fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em', display:'block', marginBottom:5 },
    input: { background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'9px 12px', color:'#111827', fontSize:14, fontFamily:'inherit', outline:'none', width:'100%', transition:'.15s' },
    select: { background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'9px 12px', color:'#111827', fontSize:14, fontFamily:'inherit', outline:'none', width:'100%', cursor:'pointer' },
    row2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
    row3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 },
    calcBox: { background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 },
    calcCell: (accent) => ({ '': '' }),
    uploadRow: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 },
    uploadZone: { border:'1px dashed #e5e7eb', borderRadius:10, padding:'16px 10px', textAlign:'center', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, position:'relative', transition:'.15s', background:'#fafafa' },
    status: (type) => ({ fontSize:12, padding:'8px 12px', borderRadius:8, marginTop:8, lineHeight:1.4, background: type === 'ok' ? '#f0fdf4' : type === 'warn' ? '#fffbeb' : '#fef2f2', border: `1px solid ${type === 'ok' ? '#bbf7d0' : type === 'warn' ? '#fde68a' : '#fecaca'}`, color: type === 'ok' ? '#166534' : type === 'warn' ? '#92400e' : '#991b1b' }),
    publishArea: { padding:'16px 20px', marginTop:'auto', borderTop:'1px solid #e5e7eb' },
    btnGreen: { background:'#16a34a', color:'#fff', border:'none', borderRadius:10, padding:'13px 20px', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit', width:'100%', marginBottom:8 },
    btnDark: { background:'#111827', color:'#fff', border:'none', borderRadius:8, padding:'9px 14px', fontWeight:500, fontSize:12, cursor:'pointer', fontFamily:'inherit' },
    btnOutline: { background:'transparent', border:'1px solid #e5e7eb', color:'#374151', borderRadius:8, padding:'9px 14px', fontWeight:500, fontSize:12, cursor:'pointer', fontFamily:'inherit' },
    linkBox: { background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:10, display:'flex', alignItems:'center', gap:8, marginTop:8 },
    right: { flex:1, position:'relative', overflow:'hidden', background:'#f3f4f6' },
    iframe: { width:'100%', height:'100%', border:'none', display:'block', background:'#fff' },
    previewLabel: { position:'absolute', top:10, right:10, background:'rgba(0,0,0,.6)', color:'#fff', fontSize:11, padding:'4px 10px', borderRadius:20, zIndex:10, pointerEvents:'none' },
  }

  const Field = ({ label, children, style }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:5, ...style }}>
      <label style={S.label}>{label}</label>
      {children}
    </div>
  )

  // ── MANAGE TAB ──
  if (tab === 'manage') return (
    <div style={S.app}>
      <div style={S.topbar}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NF" style={{height:28,filter:'invert(1)',background:'#111',padding:'4px 8px',borderRadius:6}} />
          <div style={S.tabs}>
            <button style={S.tab(false)} onClick={() => setTab('create')}>Angebot erstellen</button>
            <button style={S.tab(true)}>Angebote verwalten</button>
          </div>
        </div>
        <button style={S.btnOutline} onClick={() => setAuthed(false)}>Abmelden</button>
      </div>
      <div style={{ padding:32, overflowY:'auto', flex:1, background:'#f9fafb' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <h2 style={{ fontSize:20, fontWeight:700 }}>Alle Angebote</h2>
            <button style={S.btnDark} onClick={loadOffers}>Aktualisieren</button>
          </div>
          {loadingOffers ? (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af', fontSize:14 }}>Wird geladen...</div>
          ) : offers.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af', fontSize:14 }}>Noch keine Angebote vorhanden.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {offers.map(o => {
                const id = o.custom_id || o.id?.slice(0,8)
                const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/angebot/${o.custom_id || o.id}`
                return (
                  <div key={o.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'16px 20px', display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:16 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                        <span style={{ fontSize:15, fontWeight:700 }}>#{id}</span>
                        {o.project && <span style={{ fontSize:14, color:'#6b7280' }}>{o.project}</span>}
                        <span style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:20, background: o.published ? '#f0fdf4' : '#f3f4f6', color: o.published ? '#166534' : '#6b7280', border: `1px solid ${o.published ? '#bbf7d0' : '#e5e7eb'}` }}>
                          {o.published ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </div>
                      <div style={{ fontSize:13, color:'#9ca3af', display:'flex', gap:16, flexWrap:'wrap' }}>
                        {o.width && o.height && <span>{o.width} × {o.height} cm</span>}
                        {o.colors && <span>{o.colors}</span>}
                        {o.final_price > 0 && <span style={{ fontWeight:600, color:'#374151' }}>€ {parseFloat(o.final_price).toFixed(2)}</span>}
                        {o.offer_date && <span>{o.offer_date}</span>}
                      </div>
                      {o.published && (
                        <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:12, color:'#9ca3af', fontFamily:'monospace' }}>{link}</span>
                          <button onClick={() => navigator.clipboard.writeText(link)} style={{ ...S.btnOutline, padding:'3px 10px', fontSize:11 }}>Kopieren</button>
                          <a href={link} target="_blank" rel="noopener" style={{ ...S.btnOutline, padding:'3px 10px', fontSize:11, textDecoration:'none', display:'inline-block' }}>Öffnen</a>
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                      <button onClick={() => toggleOffer(o.id, o.published)}
                        style={{ ...S.btnOutline, fontSize:12 }}>
                        {o.published ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                      <button onClick={() => deleteOffer(o.id)}
                        style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', borderRadius:8, padding:'9px 14px', fontWeight:500, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                        Löschen
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── CREATE TAB ──
  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NF" style={{height:28,filter:'invert(1)',background:'#111',padding:'4px 8px',borderRadius:6}} />
          <div style={S.tabs}>
            <button style={S.tab(true)}>Angebot erstellen</button>
            <button style={S.tab(false)} onClick={() => setTab('manage')}>Angebote verwalten</button>
          </div>
        </div>
        <button style={S.btnOutline} onClick={() => setAuthed(false)}>Abmelden</button>
      </div>

      <div style={S.main}>
        {/* LEFT */}
        <div style={S.left}>
          {/* UPLOADS */}
          <div style={S.section}>
            <div style={S.sTitle}>Dateien hochladen</div>
            <div style={S.uploadRow}>
              <label style={S.uploadZone}>
                <input type="file" accept=".pdf" onChange={handlePDF} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer'}} />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span style={{fontSize:12,color:'#9ca3af',lineHeight:1.3,textAlign:'center'}}>PDF hochladen<br/>(Angebot)</span>
              </label>
              <label style={S.uploadZone}>
                <input type="file" accept="image/*" onChange={handleImage} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer'}} />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span style={{fontSize:12,color:'#9ca3af',lineHeight:1.3,textAlign:'center'}}>Vorschau-Bild<br/>hochladen</span>
              </label>
            </div>
            {parseStatus && <div style={S.status(parseStatus.type)}>{parseStatus.msg}</div>}
            {imgSrc && <img src={imgSrc} alt="" style={{width:'100%',aspectRatio:'16/9',objectFit:'cover',borderRadius:8,marginTop:10,display:'block'}} />}
          </div>

          {/* ANGEBOTSDATEN */}
          <div style={S.section}>
            <div style={S.sTitle}>Angebotsdaten</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={S.row2}>
                <Field label="Datum"><input style={S.input} value={f.date} onChange={e=>upd('date',e.target.value)} /></Field>
                <Field label="Angebotsnummer"><input style={S.input} value={f.num} onChange={e=>upd('num',e.target.value)} placeholder="NF-1001" /></Field>
              </div>
              <Field label="Projekt / Kundenname"><input style={S.input} value={f.project} onChange={e=>upd('project',e.target.value)} placeholder="z.B. esskultur – Max Mustermann" /></Field>
              <div style={S.row2}>
                <Field label="Breite (cm)"><input style={S.input} type="number" value={f.w} onChange={e=>upd('w',e.target.value)} /></Field>
                <Field label="Höhe (cm)"><input style={S.input} type="number" value={f.h} onChange={e=>upd('h',e.target.value)} /></Field>
              </div>
              <Field label="Rückwand"><input style={S.input} value={f.backplate} onChange={e=>upd('backplate',e.target.value)} placeholder="z.B. Ausgeschnitten" /></Field>
              <Field label="Modell / Verwendung"><input style={S.input} value={f.usage} onChange={e=>upd('usage',e.target.value)} placeholder="z.B. Innen" /></Field>
              <Field label="Farbe(n) – kommagetrennt"><input style={S.input} value={f.color} onChange={e=>upd('color',e.target.value)} placeholder="z.B. Soft Orange, Pink" /></Field>
            </div>
          </div>

          {/* PREIS */}
          <div style={S.section}>
            <div style={S.sTitle}>Preiskalkulation</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="PDF-Preis (netto)"><input style={S.input} type="number" step="0.01" value={f.basePrice} onChange={e=>upd('basePrice',e.target.value)} placeholder="0.00" /></Field>
              <div style={S.row2}>
                <Field label="Rabatt-Typ">
                  <select style={S.select} value={f.discType} onChange={e=>upd('discType',e.target.value)}>
                    <option value="pct">Prozent (%)</option>
                    <option value="eur">Euro (€)</option>
                  </select>
                </Field>
                <Field label={`Rabatt (${f.discType==='pct'?'%':'€'})`}><input style={S.input} type="number" step="0.01" value={f.discVal} onChange={e=>upd('discVal',e.target.value)} /></Field>
              </div>
              <div style={S.row2}>
                <Field label="MwSt. (%)"><input style={S.input} type="number" step="0.1" value={f.vat} onChange={e=>upd('vat',e.target.value)} /></Field>
                <Field label="Checkout-URL"><input style={S.input} value={f.url} onChange={e=>upd('url',e.target.value)} placeholder="https://..." /></Field>
              </div>
              <div style={S.calcBox}>
                {[['Netto', prices.net > 0 ? `€ ${prices.net.toFixed(2)}` : '–', false],
                  ['+ MwSt.', prices.vatAmt > 0 ? `€ ${prices.vatAmt.toFixed(2)}` : '–', false],
                  ['Endpreis', prices.total > 0 ? `€ ${prices.total.toFixed(2)}` : '–', true]
                ].map(([label, val, accent]) => (
                  <div key={label}>
                    <div style={{fontSize:10,color:accent?'#16a34a':'#9ca3af',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>{label}</div>
                    <div style={{fontSize:15,fontWeight:700,color:accent?'#16a34a':'#111827'}}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:11,color:'#9ca3af'}}>UVP (inkl. MwSt.): {prices.rrp > 0 ? `€ ${prices.rrp.toFixed(2)}` : '–'}</div>
            </div>
          </div>

          {/* WEITERE */}
          <div style={S.section}>
            <div style={S.sTitle}>Weitere Einstellungen</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Lieferdatum (Text)"><input style={S.input} value={f.delivery} onChange={e=>upd('delivery',e.target.value)} placeholder="z.B. 27. Mai und 3. Juni" /></Field>
              <Field label="Gültig bis"><input style={S.input} value={f.valid} onChange={e=>upd('valid',e.target.value)} /></Field>
              <Field label="Notiz für Kunden">
                <textarea style={{...S.input,minHeight:64,resize:'vertical',lineHeight:1.5}} value={f.note} onChange={e=>upd('note',e.target.value)} placeholder="z.B. Wie besprochen..." />
              </Field>
            </div>
          </div>

          {/* PUBLISH */}
          <div style={S.publishArea}>
            <button style={S.btnGreen} onClick={publish} disabled={publishing}>
              {publishing ? 'Wird veröffentlicht...' : 'Angebotsseite veröffentlichen'}
            </button>
            {publishedLink && (
              <div style={S.linkBox}>
                <input value={publishedLink} readOnly style={{flex:1,background:'transparent',border:'none',fontSize:12,color:'#16a34a',outline:'none',fontFamily:'monospace'}} />
                <button onClick={() => navigator.clipboard.writeText(publishedLink)} style={{...S.btnOutline,padding:'4px 10px',fontSize:11,flexShrink:0}}>Kopieren</button>
              </div>
            )}
            <div style={{fontSize:11,color:'#9ca3af',marginTop:8,lineHeight:1.5}}>Nur wer den Link hat, kann die Angebotsseite sehen.</div>
          </div>
        </div>

        {/* RIGHT – PREVIEW */}
        <div style={S.right}>
          <div style={S.previewLabel}>Live-Vorschau</div>
          <iframe ref={iframeRef} style={S.iframe} title="Vorschau" />
        </div>
      </div>
    </div>
  )
}
