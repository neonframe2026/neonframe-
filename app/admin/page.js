'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PW || 'neonframe2025'

// ─── colour dot helper ───────────────────────────────────────────────────────
function colorDot(s = '') {
  const c = s.toLowerCase()
  if (c.includes('ice blue') || c.includes('blue') || c.includes('blau')) return '#60c8f0'
  if (c.includes('warm white') || c.includes('warm')) return '#fff8e1'
  if (c.includes('white') || c.includes('weiß')) return '#eee'
  if (c.includes('red') || c.includes('rot')) return '#ef4444'
  if (c.includes('green') || c.includes('grün')) return '#22c55e'
  if (c.includes('pink')) return '#ec4899'
  if (c.includes('purple') || c.includes('lila')) return '#a855f7'
  if (c.includes('yellow') || c.includes('gelb')) return '#f59e0b'
  if (c.includes('orange')) return '#f97316'
  return '#aaa'
}

// ─── price calc ──────────────────────────────────────────────────────────────
function calcPrices(basePrice, discType, discVal, vatPct) {
  const base = parseFloat(basePrice) || 0
  const dv   = parseFloat(discVal)   || 0
  const vat  = parseFloat(vatPct)    || 19
  let net = discType === 'pct' ? base * (1 - dv / 100) : Math.max(0, base - dv)
  const vatAmt = net * (vat / 100)
  const total  = net + vatAmt
  const rrp    = base * (1 + vat / 100)
  return { net, vatAmt, total, rrp }
}

// ─── PDF parser ──────────────────────────────────────────────────────────────
async function extractPdfText(file) {
  const pdfjsLib = (await import('pdfjs-dist')).default || (await import('pdfjs-dist'))
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  let txt = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)
    const content = await page.getTextContent()
    txt += '\n' + content.items.map(x => x.str).join(' ')
  }
  return txt
}

function parsePdfFields(txt) {
  const get = (patterns) => {
    for (const p of patterns) {
      const m = txt.match(p)
      if (m) return (m[1] || m[0]).trim()
    }
    return ''
  }

  const date = get([
    /Angebotsdatum[:\s•]+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
    /Datum[:\s•]+(\d{1,2}\.\d{1,2}\.\d{2,4})/i,
    /(\d{1,2}\.\d{1,2}\.\d{4})/,
  ])
  const num = get([
    /Angebots(?:nummer|nr\.?|#)[:\s•#]+([A-Z0-9\-]{3,20})/i,
    /(?:Nr\.|Number)[:\s]+([A-Z0-9\-]{3,20})/i,
  ])
  const project = get([
    /(?:Projekt|Project)[:\s•]+([^\n•|]{2,60}?)(?:\s*[•|\n]|$)/i,
    /(?:Kunde|Auftraggeber|für)[:\s]+([^\n]{2,50})/i,
  ])

  let w = '', h = ''
  const dimPats = [
    /(\d+)\s*[xX×]\s*(\d+)\s*cm/,
    /Abmessungen[^0-9]*(\d+)\s*[xX×]\s*(\d+)/i,
    /(\d{2,4})\s*cm\s*[xX×]\s*(\d{2,4})\s*cm/i,
  ]
  for (const p of dimPats) { const m = txt.match(p); if (m) { w = m[1]; h = m[2]; break } }

  const backplate = get([
    /R[üu]ckplatte?[:\s•-]+([^\n•]{2,60}?)(?:\s*(?:Verwendung|Farbe|Preis|\n))/i,
    /R[üu]ckwand[:\s•-]+([^\n•]{2,60})/i,
  ])
  const usage  = get([/Verwendung[:\s•-]+([^\n•]{2,50})/i])
  const colors = get([
    /Farbe[n]?\s*[\(\)a-z]*\s*[•:\-]\s*([^\n•]{2,60}?)(?:\s*(?:Gesamt|MwSt|Preis|\n))/i,
    /(?:Ice Blue|Warm White|Cold White|Red|Green|Blue|Pink|Yellow|Purple|Orange|RGB)/i,
  ])

  let price = ''
  for (const p of [
    /Gesamt[^€\d]*€\s*([\d.,]+)/i,
    /(?:Netto|Preis|Total)[^€\d]*€\s*([\d.,]+)/i,
    /€\s*([\d.,]+)\s*(?:netto|zzgl)/i,
    /(\d{2,6}[.,]\d{2})\s*€/,
    /€\s*(\d{2,6}(?:[.,]\d{2})?)/,
  ]) { const m = txt.match(p); if (m) { price = m[1].replace(',', '.'); break } }

  return { date, num, project, w, h, backplate, usage, colors, price }
}

// ─── live preview HTML ────────────────────────────────────────────────────────
function buildPreviewHTML(f, prices, imgSrc) {
  const { net, total, rrp } = prices
  const discLabel = f.discType === 'pct'
    ? `${parseFloat(f.discVal) || 0}% Partner-Rabatt inklusive`
    : `€${(parseFloat(f.discVal) || 0).toFixed(2)} Rabatt inklusive`
  const dot = colorDot(f.color)

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#222;background:#fff;font-size:13px}
.hdr{background:#111;padding:10px 20px;display:flex;align-items:center;justify-content:space-between}
.logo{color:#fff;font-size:17px;font-weight:800}
.rbar{background:#f9fafb;border-bottom:1px solid #e5e5e5;padding:7px 20px;display:flex;gap:16px;font-size:11px;color:#555;flex-wrap:wrap}
.gbar{background:#1a8a3a;color:#fff;text-align:center;padding:9px;font-size:12px;font-weight:600}
.bc{padding:9px 20px;font-size:11px;color:#888;border-bottom:1px solid #eee}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:20px;max-width:1100px}
.linner{display:flex;gap:8px}
.istrip{display:flex;flex-direction:column;border:1px solid #e5e5e5;border-radius:4px;width:64px;flex-shrink:0;overflow:hidden}
.is-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 3px;border-bottom:1px solid #eee;font-size:8px;color:#666;text-align:center}
.is-item:last-child{border:none}
.is-icon{font-size:17px}
.imgmain{position:relative;background:#f5f5f5;border-radius:4px;aspect-ratio:4/3;overflow:hidden;display:flex;align-items:center;justify-content:center}
.imgmain img{width:100%;height:100%;object-fit:cover;display:block}
.imgph{color:#bbb;font-size:12px;text-align:center}
.imgbadges{position:absolute;bottom:8px;right:8px;display:flex;gap:4px}
.ibadge{background:rgba(0,0,0,.7);color:#fff;font-size:8px;padding:3px 7px;border-radius:3px;font-weight:700}
.thumbs{display:flex;gap:5px;margin-top:7px}
.thumb{width:52px;height:52px;background:#f5f5f5;border-radius:3px;overflow:hidden;border:2px solid #1a8a3a}
.thumb img{width:100%;height:100%;object-fit:cover}
.aid{font-size:10px;color:#ccc;margin-top:5px}
.rating{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.stars{color:#f59e0b;font-size:13px}
.rnum{font-size:13px;font-weight:700}
.rcnt{font-size:11px;color:#666}
.title{font-size:20px;font-weight:800;line-height:1.2;margin-bottom:7px}
.ptag{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.pt1{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px}
.pt2{background:#1a8a3a;color:#fff;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px}
.slbl{font-size:11px;font-weight:700;display:block;margin-bottom:4px}
.sval{display:inline-block;border:2px solid #1a8a3a;border-radius:5px;padding:6px 14px;font-size:12px;font-weight:600;color:#1a8a3a;background:#f0fdf4;margin-bottom:12px}
.cfg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px}
.cv{display:inline-flex;align-items:center;gap:4px;border:1px solid #1a8a3a;border-radius:20px;padding:4px 10px;font-size:10px;font-weight:600;color:#1a8a3a;background:#f0fdf4;margin-top:3px}
.dot{width:9px;height:9px;border-radius:50%;border:1px solid rgba(0,0,0,.1);display:inline-block}
.qty{margin-bottom:12px}
.qsel{border:1px solid #ddd;border-radius:4px;padding:5px 10px;font-size:11px}
.checks{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.ck{display:flex;align-items:flex-start;gap:6px;font-size:11px;line-height:1.5}
.cki{color:#1a8a3a;font-size:13px;flex-shrink:0}
.pbox{background:#f9fafb;border:1px solid #e5e5e5;border-radius:7px;padding:14px;margin-bottom:12px}
.plbl{font-size:10px;font-weight:800;color:#1a8a3a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.pbig{font-size:26px;font-weight:800;margin-bottom:2px}
.pnote{font-size:10px;color:#888;margin-bottom:3px}
.prrp{font-size:11px;color:#888}
.prrp s{color:#bbb}
.ship{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:5px;padding:9px 12px;display:flex;align-items:center;gap:8px;margin-bottom:5px}
.shi{font-size:18px}
.sht strong{display:block;font-size:12px;color:#166534}
.sht span{font-size:11px;color:#555}
.exp{font-size:11px;color:#555;display:flex;align-items:center;gap:3px;margin-bottom:12px}
.cta{width:100%;background:#1a8a3a;color:#fff;border:none;border-radius:7px;padding:14px;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;font-family:Arial}
.pays{display:flex;gap:5px;justify-content:center;flex-wrap:wrap;margin-bottom:12px}
.pay{background:#f5f5f5;border:1px solid #e5e5e5;border-radius:3px;padding:3px 8px;font-size:9px;font-weight:600;color:#555}
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.fi{background:#f9fafb;border:1px solid #e5e5e5;border-radius:6px;padding:9px;display:flex;align-items:flex-start;gap:6px}
.fii{font-size:14px;flex-shrink:0}
.fit strong{display:block;font-size:10px;font-weight:700;margin-bottom:1px}
.fit span{font-size:9px;color:#666;line-height:1.4}
.vld{font-size:10px;color:#aaa;margin-top:6px;text-align:right}
.sticky{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e5e5;padding:8px 20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 -3px 12px rgba(0,0,0,.08)}
.stl{display:flex;align-items:center;gap:10px}
.sti{width:40px;height:40px;border-radius:3px;object-fit:cover;background:#f5f5f5}
.stt{font-size:12px;font-weight:700}
.stp{font-size:11px;color:#555}
.stb{background:#1a8a3a;color:#fff;border:none;border-radius:5px;padding:9px 22px;font-size:12px;font-weight:800;font-family:Arial}
</style></head><body>
<div class="hdr"><div class="logo">🔆 THE NEON COMPANY</div><span style="color:#888;font-size:11px">DE</span></div>
<div class="rbar"><span>⭐ <b>4.8 Google Reviews</b> <span style="color:#f59e0b">★★★★★</span></span><span style="margin-left:auto">4.7 <span style="color:#f59e0b">★★★★½</span> | 674 Bewertungen <b>Trustpilot</b></span></div>
<div class="gbar">✅ REDUZIERTE PREISAKTUALISIERUNG ANGEWENDET – NIEDRIGSTE IN EUROPA</div>
<div class="bc">Startseite / Neon Signs / <b>${f.project || 'Premium LED Neon Sign'}</b></div>
<div class="grid">
  <div class="linner">
    <div class="istrip">
      <div class="is-item"><div class="is-icon">🎮</div>REMOTE CONTROL</div>
      <div class="is-item"><div class="is-icon">✅</div>WARRANTY</div>
      <div class="is-item"><div class="is-icon">💡</div>DIMMER</div>
      <div class="is-item"><div class="is-icon">⚡</div>PowerLEDs™</div>
      <div class="is-item"><div class="is-icon">🔌</div>ADAPTER</div>
      <div class="is-item"><div class="is-icon">🔋</div>POWER CABLE</div>
    </div>
    <div style="flex:1">
      <div class="imgmain">
        ${imgSrc ? `<img src="${imgSrc}">` : `<div class="imgph"><div style="font-size:36px">💡</div><div>Bild hochladen</div></div>`}
        <div class="imgbadges"><div class="ibadge">10 YEARS LIFETIME</div><div class="ibadge">PREMIUM POWERLEDS™</div></div>
      </div>
      <div class="thumbs">${imgSrc ? `<div class="thumb"><img src="${imgSrc}"></div>` : ''}</div>
      ${f.num ? `<div class="aid">Angebots-ID: ${f.num}</div>` : ''}
    </div>
  </div>
  <div>
    <div class="rating"><span class="stars">★★★★★</span><span class="rnum">4.9</span><span class="rcnt">(1146+ bewertungen)</span></div>
    <div class="title">Premium PowerLEDs™ Neon Sign – Neonframe</div>
    ${f.project ? `<div class="ptag"><span class="pt1">Kundenspezifisch für ${f.project}</span><span class="pt2">JETZT MIT PARTNER-RABATT</span></div>` : ''}
    <span class="slbl">Größe (Breite x Höhe):</span>
    <div class="sval">${f.w && f.h ? `${f.w} x ${f.h} CM` : '– x – CM'}</div>
    <div class="cfg">
      <div><span class="slbl">Farbe:</span><div class="cv"><span class="dot" style="background:${dot}"></span>${f.color || '–'}</div></div>
      <div><span class="slbl">Rückwand:</span><div class="cv">${f.backplate || '–'}</div></div>
      <div><span class="slbl">Modell:</span><div class="cv">${f.usage || '–'}</div></div>
    </div>
    <div class="qty"><span class="slbl">Anzahl:</span><select class="qsel"><option>1</option></select></div>
    <div class="checks">
      <div class="ck"><span class="cki">✅</span><span>Einfach zu installieren mit dem mitgelieferten <u>Montagematerial</u></span></div>
      <div class="ck"><span class="cki">✅</span><span>Inklusive Fernbedienung, 3 Meter Stromkabel, Adapter, Dimmer und Montagematerial</span></div>
      <div class="ck"><span class="cki">✅</span><span>Seit über 10 Jahren die höchste Qualität Neon Signs in Europa</span></div>
    </div>
    <div class="pbox">
      <div class="plbl">Partnerpreis</div>
      <div class="pbig">${total > 0 ? `€ ${total.toFixed(2)}` : '€ –'}</div>
      <div class="pnote">exklusive MwSt. · ${discLabel}</div>
      ${rrp > 0 ? `<div class="prrp">Empfohlener Verkaufspreis: <s>€ ${rrp.toFixed(2)}</s></div>` : ''}
    </div>
    <div class="ship"><div class="shi">🚚</div><div class="sht"><strong>Kostenloser Versand</strong><span>${f.delivery ? 'Geliefert zwischen ' + f.delivery : 'Lieferzeit auf Anfrage'}</span></div></div>
    <div class="exp">⚡ <b>Schnell benötigt?</b>&nbsp;Expressversand wählen</div>
    <div class="cta">🛒 BESTÄTIGEN</div>
    <div class="pays"><span class="pay">PayPal</span><span class="pay">💳 Karte</span><span class="pay">Klarna</span><span class="pay">SEPA</span><span class="pay">📄 Rechnung</span></div>
    <div class="fgrid">
      <div class="fi"><span class="fii">🛡️</span><div class="fit"><strong>Qualitätsgarantie</strong><span>Handgefertigte PowerLEDs™</span></div></div>
      <div class="fi"><span class="fii">📦</span><div class="fit"><strong>Komplettpaket</strong><span>Montagematerial + Controller</span></div></div>
      <div class="fi"><span class="fii">⚡</span><div class="fit"><strong>Einfache Installation</strong><span>In wenigen Minuten fertig</span></div></div>
      <div class="fi"><span class="fii">♾️</span><div class="fit"><strong>10+ Jahre Lebensdauer</strong><span>100.000 Brennstunden</span></div></div>
    </div>
    ${f.valid || f.date ? `<div class="vld">${f.date ? 'Datum: ' + f.date + ' · ' : ''}${f.valid ? 'Gültig bis: ' + f.valid : ''}</div>` : ''}
  </div>
</div>
<div class="sticky">
  <div class="stl">
    ${imgSrc ? `<img src="${imgSrc}" class="sti">` : '<div class="sti"></div>'}
    <div><div class="stt">Custom PowerLEDs™ Neon Sign</div><div class="stp">${total > 0 ? `€ ${total.toFixed(2)} exklusive MwSt.` : ''}</div></div>
  </div>
  <button class="stb">🛒 BESTÄTIGEN</button>
</div>
</body></html>`
}

// ─── main component ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState(false)

  const [fields, setFields] = useState({
    date: '', num: '', project: '', w: '', h: '',
    backplate: '', usage: '', color: '',
    basePrice: '', discType: 'pct', discVal: '20', vat: '19',
    delivery: '', note: '', valid: '', url: '',
  })
  const [imgSrc, setImgSrc] = useState(null)
  const [parseStatus, setParseStatus] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishedLink, setPublishedLink] = useState(null)
  const [saving, setSaving] = useState(false)

  const prices = calcPrices(fields.basePrice, fields.discType, fields.discVal, fields.vat)
  const iframeRef = useRef(null)

  // init defaults
  useEffect(() => {
    const today = new Date()
    const validDate = new Date(); validDate.setDate(today.getDate() + 30)
    setFields(f => ({
      ...f,
      date: today.toLocaleDateString('de-DE'),
      valid: validDate.toLocaleDateString('de-DE'),
    }))
  }, [])

  // update iframe preview
  useEffect(() => {
    if (!iframeRef.current) return
    const html = buildPreviewHTML(fields, prices, imgSrc)
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document
    doc.open(); doc.write(html); doc.close()
  }, [fields, imgSrc, prices.total, prices.rrp])

  const upd = (key, val) => setFields(f => ({ ...f, [key]: val }))

  // PDF
  async function handlePDF(e) {
    const file = e.target.files[0]; if (!file) return
    setParseStatus({ type: 'loading', msg: 'PDF wird gelesen…' })
    try {
      const txt = await extractPdfText(file)
      const parsed = parsePdfFields(txt)
      setFields(f => ({
        ...f,
        date:      parsed.date      || f.date,
        num:       parsed.num       || f.num,
        project:   parsed.project   || f.project,
        w:         parsed.w         || f.w,
        h:         parsed.h         || f.h,
        backplate: parsed.backplate || f.backplate,
        usage:     parsed.usage     || f.usage,
        color:     parsed.colors    || f.color,
        basePrice: parsed.price     || f.basePrice,
      }))
      const filled = Object.values(parsed).filter(Boolean).length
      setParseStatus({ type: filled >= 5 ? 'ok' : 'warn', msg: `${filled} Felder erkannt – bitte prüfen` })
    } catch (err) {
      setParseStatus({ type: 'err', msg: 'Fehler: ' + err.message })
    }
  }

  // Image
  async function handleImage(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImgSrc(ev.target.result)
    reader.readAsDataURL(file)
  }

  // Publish
  async function publish() {
    setPublishing(true)
    try {
      const payload = {
        offer_num:   fields.num,
        offer_date:  fields.date,
        project:     fields.project,
        width:       fields.w,
        height:      fields.h,
        backplate:   fields.backplate,
        usage:       fields.usage,
        colors:      fields.color,
        base_price:  parseFloat(fields.basePrice) || 0,
        disc_type:   fields.discType,
        disc_val:    parseFloat(fields.discVal)   || 0,
        vat_pct:     parseFloat(fields.vat)       || 19,
        net_price:   prices.net,
        final_price: prices.total,
        rrp_price:   prices.rrp,
        delivery:    fields.delivery,
        note:        fields.note,
        valid_until: fields.valid,
        checkout_url: fields.url,
        preview_image: null,
        published:   true,
      }

      // upload image if we have one
      if (imgSrc && imgSrc.startsWith('data:')) {
        const blob = await (await fetch(imgSrc)).blob()
        const fd = new FormData()
        fd.append('file', blob, `offer-${Date.now()}.jpg`)
        fd.append('offerId', fields.num || 'new')
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

      const link = `${window.location.origin}/angebot/${data.id}`
      setPublishedLink(link)
      await navigator.clipboard.writeText(link).catch(() => {})
      alert(`✅ Veröffentlicht!\n\nLink kopiert:\n${link}`)
    } catch (err) {
      alert('Fehler: ' + err.message)
    } finally {
      setPublishing(false)
    }
  }

  // ── login screen ────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={S.loginWrap}>
      <div style={S.loginBox}>
        <div style={S.loginLogo}>🔆 NEONFRAME</div>
        <div style={S.loginSub}>Admin-Bereich · Nur autorisierter Zugriff</div>
        <input
          type="password" placeholder="Passwort" value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (pw === ADMIN_PW ? (setAuthed(true), setPwErr(false)) : setPwErr(true))}
          style={S.loginInput}
        />
        <button style={S.loginBtn} onClick={() => pw === ADMIN_PW ? (setAuthed(true), setPwErr(false)) : setPwErr(true)}>
          Einloggen
        </button>
        {pwErr && <div style={S.loginErr}>Falsches Passwort</div>}
      </div>
    </div>
  )

  // ── app ─────────────────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      {/* TOPBAR */}
      <div style={S.topbar}>
        <div style={S.topLeft}>
          <span style={S.topLogo}>NEONFRAME</span>
          <span style={S.topBadge}>ADMIN</span>
        </div>
        <button style={S.logoutBtn} onClick={() => setAuthed(false)}>Abmelden</button>
      </div>

      <div style={S.main}>
        {/* ══ LEFT PANEL ══ */}
        <div style={S.left}>

          {/* uploads */}
          <Section title="📂 Dateien hochladen">
            <div style={S.uploadRow}>
              <UploadZone label="PDF hochladen" sub="(Angebot)" accept=".pdf" onChange={handlePDF} />
              <UploadZone label="Vorschau-Bild" sub="hochladen" accept="image/*" onChange={handleImage} />
            </div>
            {parseStatus && (
              <div style={{ ...S.status, ...(parseStatus.type === 'ok' ? S.statusOk : parseStatus.type === 'warn' ? S.statusWarn : S.statusErr) }}>
                {parseStatus.msg}
              </div>
            )}
            {imgSrc && (
              <div style={S.thumbWrap}>
                <img src={imgSrc} alt="Vorschau" style={S.thumb} />
              </div>
            )}
          </Section>

          {/* angebots-daten */}
          <Section title="📋 Angebotsdaten">
            <Row2>
              <Field label="Angebotsdatum"><input style={S.input} value={fields.date} onChange={e => upd('date', e.target.value)} /></Field>
              <Field label="Angebotsnummer"><input style={S.input} value={fields.num} onChange={e => upd('num', e.target.value)} placeholder="NF-1001" /></Field>
            </Row2>
            <Field label="Projekt / Kundenname"><input style={S.input} value={fields.project} onChange={e => upd('project', e.target.value)} placeholder="z.B. Never Quit – Max Mustermann" /></Field>
            <Row2>
              <Field label="Breite (cm)"><input style={S.input} type="number" value={fields.w} onChange={e => upd('w', e.target.value)} /></Field>
              <Field label="Höhe (cm)"><input style={S.input} type="number" value={fields.h} onChange={e => upd('h', e.target.value)} /></Field>
            </Row2>
            <Field label="Rückplatte"><input style={S.input} value={fields.backplate} onChange={e => upd('backplate', e.target.value)} placeholder="z.B. Ausgeschnitten" /></Field>
            <Field label="Verwendung"><input style={S.input} value={fields.usage} onChange={e => upd('usage', e.target.value)} placeholder="z.B. Innen" /></Field>
            <Field label="Farbe(n)"><input style={S.input} value={fields.color} onChange={e => upd('color', e.target.value)} placeholder="z.B. Ice Blue" /></Field>
          </Section>

          {/* preiskalkulation */}
          <Section title="💰 Preiskalkulation">
            <Field label="PDF-Preis (netto, aus PDF)">
              <input style={S.input} type="number" step="0.01" value={fields.basePrice} onChange={e => upd('basePrice', e.target.value)} placeholder="0.00" />
            </Field>
            <Row2>
              <Field label="Rabatt-Typ">
                <select style={S.select} value={fields.discType} onChange={e => upd('discType', e.target.value)}>
                  <option value="pct">Prozent (%)</option>
                  <option value="eur">Euro (€)</option>
                </select>
              </Field>
              <Field label={`Rabatt-Wert (${fields.discType === 'pct' ? '%' : '€'})`}>
                <input style={S.input} type="number" step="0.01" value={fields.discVal} onChange={e => upd('discVal', e.target.value)} />
              </Field>
            </Row2>
            <Row2>
              <Field label="MwSt. (%)">
                <input style={S.input} type="number" step="0.1" value={fields.vat} onChange={e => upd('vat', e.target.value)} />
              </Field>
              <Field label="Checkout-URL">
                <input style={S.input} value={fields.url} onChange={e => upd('url', e.target.value)} placeholder="https://..." />
              </Field>
            </Row2>
            <div style={S.priceCalc}>
              <PriceCell label="Netto-Preis" value={prices.net > 0 ? `€ ${prices.net.toFixed(2)}` : '€ –'} />
              <PriceCell label="+ MwSt." value={prices.vatAmt > 0 ? `€ ${prices.vatAmt.toFixed(2)}` : '€ –'} />
              <PriceCell label="Endpreis (brutto)" value={prices.total > 0 ? `€ ${prices.total.toFixed(2)}` : '€ –'} accent />
            </div>
            <div style={S.rrpLine}>UVP (inkl. MwSt.): {prices.rrp > 0 ? `€ ${prices.rrp.toFixed(2)}` : '–'}</div>
          </Section>

          {/* zusatz */}
          <Section title="✏️ Weitere Einstellungen">
            <Field label="Lieferdatum (Text)"><input style={S.input} value={fields.delivery} onChange={e => upd('delivery', e.target.value)} placeholder="z.B. 27. Mai und 3. Juni" /></Field>
            <Field label="Gültig bis"><input style={S.input} value={fields.valid} onChange={e => upd('valid', e.target.value)} /></Field>
            <Field label="Notiz für Kunden">
              <textarea style={{ ...S.input, minHeight: 64, resize: 'vertical', lineHeight: 1.5 }} value={fields.note} onChange={e => upd('note', e.target.value)} placeholder="z.B. Wie besprochen…" />
            </Field>
          </Section>

          {/* publish */}
          <div style={S.publishArea}>
            <button style={{ ...S.btn, ...S.btnGreen }} onClick={publish} disabled={publishing}>
              {publishing ? '⏳ Wird veröffentlicht…' : '🚀 Angebotsseite veröffentlichen'}
            </button>
            {publishedLink && (
              <div style={S.linkBox}>
                <input style={S.linkInput} value={publishedLink} readOnly />
                <button style={S.copyBtn} onClick={() => navigator.clipboard.writeText(publishedLink)}>Kopieren</button>
              </div>
            )}
            <div style={S.publishHint}>Der Link enthält die Angebots-ID. Nur wer den Link hat, kann die Seite sehen.</div>
          </div>

        </div>{/* /left */}

        {/* ══ RIGHT PREVIEW ══ */}
        <div style={S.right}>
          <div style={S.previewLabel}>Live-Vorschau</div>
          <iframe ref={iframeRef} style={S.iframe} title="Vorschau" />
        </div>

      </div>
    </div>
  )
}

// ─── small helper components ──────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}
function Field({ label, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={S.label}>{label}</label>{children}</div>
}
function Row2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>
}
function UploadZone({ label, sub, accept, onChange }) {
  return (
    <label style={S.uploadZone}>
      <input type="file" accept={accept} onChange={onChange} style={{ display: 'none' }} />
      <div style={{ fontSize: 22, marginBottom: 4 }}>📁</div>
      <div style={{ fontSize: 11, color: '#888', lineHeight: 1.3, textAlign: 'center' }}>{label}<br />{sub}</div>
    </label>
  )
}
function PriceCell({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: accent ? '#22c55e' : '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: accent ? '#22c55e' : '#f5f5f5' }}>{value}</div>
    </div>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  loginWrap:   { position: 'fixed', inset: 0, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loginBox:    { background: '#141414', border: '1px solid #333', borderRadius: 12, padding: 40, width: 340, textAlign: 'center' },
  loginLogo:   { fontSize: 22, fontWeight: 700, color: '#22c55e', marginBottom: 4 },
  loginSub:    { fontSize: 12, color: '#888', marginBottom: 24 },
  loginInput:  { width: '100%', background: '#1c1c1c', border: '1px solid #333', borderRadius: 7, padding: '10px 14px', color: '#f5f5f5', fontSize: 16, fontFamily: 'inherit', outline: 'none', marginBottom: 12, textAlign: 'center', letterSpacing: 3 },
  loginBtn:    { width: '100%', background: '#22c55e', color: '#000', border: 'none', borderRadius: 7, padding: 11, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  loginErr:    { color: '#ef4444', fontSize: 12, marginTop: 8 },

  app:         { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', color: '#f5f5f5', fontFamily: 'Arial, sans-serif' },
  topbar:      { background: '#141414', borderBottom: '1px solid #2a2a2a', padding: '0 20px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  topLeft:     { display: 'flex', alignItems: 'center', gap: 10 },
  topLogo:     { fontSize: 16, fontWeight: 700, letterSpacing: 1, color: '#22c55e' },
  topBadge:    { background: '#1c1c1c', border: '1px solid #333', color: '#888', fontSize: 10, padding: '2px 7px', borderRadius: 20, letterSpacing: '.5px' },
  logoutBtn:   { background: 'transparent', border: '1px solid #333', color: '#888', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },

  main:        { display: 'flex', flex: 1, overflow: 'hidden' },
  left:        { width: 400, flexShrink: 0, overflowY: 'auto', background: '#141414', borderRight: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column' },
  section:     { borderBottom: '1px solid #2a2a2a', padding: '14px 18px' },
  sectionTitle:{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 },

  uploadRow:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  uploadZone:  { border: '1px dashed #333', borderRadius: 7, padding: '14px 10px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  status:      { fontSize: 11, padding: '7px 10px', borderRadius: 6, marginTop: 6, lineHeight: 1.4 },
  statusOk:    { background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', color: '#4ade80' },
  statusWarn:  { background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', color: '#fbbf24' },
  statusErr:   { background: 'rgba(239,68,68,.1)',  border: '1px solid rgba(239,68,68,.2)',  color: '#f87171' },
  thumbWrap:   { marginTop: 8, borderRadius: 7, overflow: 'hidden' },
  thumb:       { width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' },

  label:       { fontSize: 10, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' },
  input:       { background: '#1c1c1c', border: '1px solid #333', borderRadius: 7, padding: '8px 10px', color: '#f5f5f5', fontSize: 12, fontFamily: 'inherit', outline: 'none', width: '100%' },
  select:      { background: '#1c1c1c', border: '1px solid #333', borderRadius: 7, padding: '8px 10px', color: '#f5f5f5', fontSize: 12, fontFamily: 'inherit', outline: 'none', width: '100%', cursor: 'pointer' },

  priceCalc:   { background: '#1c1c1c', border: '1px solid #333', borderRadius: 7, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 },
  rrpLine:     { fontSize: 10, color: '#555', marginTop: 4 },

  publishArea: { padding: '16px 18px', marginTop: 'auto', borderTop: '1px solid #2a2a2a' },
  btn:         { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 16px', borderRadius: 7, fontWeight: 500, fontSize: 12, cursor: 'pointer', border: 'none', fontFamily: 'inherit', width: '100%', marginBottom: 8 },
  btnGreen:    { background: '#22c55e', color: '#000', padding: '13px 16px', fontSize: 13, fontWeight: 700 },
  linkBox:     { background: '#1c1c1c', border: '1px solid #333', borderRadius: 7, padding: 8, display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 },
  linkInput:   { flex: 1, background: 'transparent', border: 'none', fontSize: 11, color: '#22c55e', outline: 'none', fontFamily: 'monospace' },
  copyBtn:     { background: '#222', border: '1px solid #333', color: '#888', borderRadius: 5, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
  publishHint: { fontSize: 10, color: '#555', marginTop: 8, lineHeight: 1.5 },

  right:       { flex: 1, position: 'relative', overflow: 'hidden' },
  previewLabel:{ position: 'absolute', top: 10, right: 10, background: '#000', color: '#fff', fontSize: 10, padding: '4px 10px', borderRadius: 20, opacity: .5, zIndex: 10, fontFamily: 'Arial' },
  iframe:      { width: '100%', height: '100%', border: 'none', display: 'block' },
}
