'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PW ?? 'neonframe2025'

const STATUS_OPTIONS = [
  { value: 'offer_sent',      label: 'Angebot erhalten',    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { value: 'recontacted',     label: 'Nochmals kontaktiert', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { value: 'confirmed',       label: 'Bestellt',             color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
]

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
  if (c.includes('lake blue')) return '#06b6d4'
  if (c.includes('ice blue')) return '#38bdf8'
  if (c.includes('blue') || c.includes('blau')) return '#2563eb'
  if (c.includes('warm white') || c.includes('warm')) return '#fef3c7'
  if (c.includes('white') || c.includes('weiß')) return '#e5e5e5'
  if (c.includes('peachy pink')) return '#fb7185'
  if (c.includes('soft pink')) return '#f9a8d4'
  if (c.includes('pink')) return '#ec4899'
  if (c.includes('red') || c.includes('rot')) return '#ef4444'
  if (c.includes('light green')) return '#84cc16'
  if (c.includes('green') || c.includes('grün')) return '#22c55e'
  if (c.includes('purple') || c.includes('lila')) return '#a855f7'
  if (c.includes('yellow') || c.includes('gelb')) return '#eab308'
  if (c.includes('soft orange')) return '#fdba74'
  if (c.includes('orange')) return '#f97316'
  return '#9ca3af'
}

// Verkleinert & komprimiert ein hochgeladenes Bild im Browser, BEVOR es irgendwo
// hochgeladen oder in eine Anfrage gepackt wird. Ohne das können z.B. KI-generierte
// Bilder (ElevenLabs, Canva AI, etc.) mehrere MB groß sein und die Server-Anfrage
// sprengen ("Request Entity Too Large" -> Vorschau-Fehler).
function compressImage(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim }
          else { width = Math.round(width * (maxDim / height)); height = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'))
      img.src = ev.target.result
    }
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsDataURL(file)
  })
}

function ThemeVars() {
  return (
    <style>{`
      .nf-admin { --bg:#ffffff; --bg-alt:#f9fafb; --panel:#ffffff; --border:#e5e7eb; --text:#111111; --text-muted:#6b7280; --text-faint:#9ca3af; --input-bg:#f9fafb; --email-bg:#f0fbff; --email-border:#60c8f044; }
      .nf-admin[data-theme='dark'] { --bg:#0f1115; --bg-alt:#16181d; --panel:#1a1c22; --border:#2b2e36; --text:#f3f4f6; --text-muted:#9ca3af; --text-faint:#71757f; --input-bg:#20222a; --email-bg:#132732; --email-border:#3a7ca844; }
    `}</style>
  )
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
      style={{background:'transparent',border:'1px solid var(--border)',borderRadius:8,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16,lineHeight:1}}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  )
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
  const num = get([/Angebotsnummer\s*:\s*(\d{8,})/i, /Angebotsnummer\s*:\s*[\d-]+\s+(\d{8,})/i])
  const project = get([/Project\s*:\s*(.+?)\s*Beschreibung/i, /Projekt\s*:\s*(.+?)\s*Beschreibung/i, /Project\s*:\s*(\S+)/i, /Projekt\s*:\s*(\S+)/i])
  let w = '', h = ''
  for (const p of [/Abmessungen\s*:\s*(\d+)\s*x\s*(\d+)/i, /(\d+)\s*x\s*(\d+)\s*CM/i]) {
    const m = txt.match(p); if (m) { w = m[1]; h = m[2]; break }
  }
  const colors = get([/Farbe\(n\)\s*:\s*(.+?)\s*Gesamt/i, /Farbe\(n\)\s*:\s*(\S+)/i])
  const backplateRaw = get([/Rückplatte\s*:\s*(.+?)\s*Verwendung/i, /Rückplatte\s*:\s*(\S+)/i])
  let backplate = ''
  const bp = backplateRaw.toLowerCase()
  if (bp.includes('ausschneiden') || bp.includes('ausgeschnitten')) backplate = 'Ausgeschnitten'
  else if (bp.includes('quadrat')) backplate = 'Quadratisch'
  else if (bp.includes('ohne')) backplate = 'Ohne'

  const usageRaw = get([/Verwendung\s*:\s*(\S+)/i])
  let usage = ''
  const uw = usageRaw.toLowerCase()
  if (uw.includes('innen')) usage = 'Innen'
  else if (uw.includes('außen') || uw.includes('aussen')) usage = 'Außen IP65'

  return { num, project, w, h, colors, backplate, usage }
}

const BACKPLATE_OPTIONS = ['Ausgeschnitten', 'Quadratisch', 'Ohne']
const BACKPLATE_COLOR_OPTIONS = ['Transparent', 'Schwarz', 'Weiß']
const USAGE_OPTIONS = ['Innen', 'Außen IP65']
const COLOR_OPTIONS = ['White', 'Warm White', 'Soft Orange', 'Orange', 'Red', 'Purple', 'Peachy Pink', 'Soft Pink', 'Pink', 'Light Green', 'Green', 'Yellow', 'Lake Blue', 'Ice Blue', 'Blue']

const PAYMENT_ICONS_HTML = `
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
  <div style="background:#003087;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <svg width="36" height="20" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg"><text x="4" y="22" font-size="16" font-weight="800" font-family="Arial,sans-serif" fill="#009cde">P</text><text x="14" y="22" font-size="16" font-weight="800" font-family="Arial,sans-serif" fill="#012169">ay</text><text x="28" y="22" font-size="16" font-weight="800" font-family="Arial,sans-serif" fill="#009cde">Pa</text></svg>
  </div>
  <div style="background:#ffb3c7;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <span style="font-weight:900;font-size:11px;color:#17120e;font-family:Arial,sans-serif;letter-spacing:-0.5px">klarna</span>
  </div>
  <div style="background:#1a1f71;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <span style="font-weight:900;font-size:16px;color:#fff;font-family:Arial,sans-serif;font-style:italic;letter-spacing:-1px">VISA</span>
  </div>
  <div style="background:#fff;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <svg width="36" height="22" viewBox="0 0 36 22"><circle cx="13" cy="11" r="10" fill="#eb001b"/><circle cx="23" cy="11" r="10" fill="#f79e1b"/><path d="M18 4a10 10 0 0 1 0 14A10 10 0 0 1 18 4z" fill="#ff5f00"/></svg>
  </div>
  <div style="background:#000;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #333">
    <svg width="38" height="16" viewBox="0 0 60 26" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 5.2c-.8 1-2.1 1.7-3.3 1.6-.2-1.3.5-2.6 1.2-3.4C10.2 2.5 11.6 1.8 12.7 1.8c.1 1.3-.4 2.5-1.2 3.4zM12.7 7c-1.8-.1-3.4 1-4.2 1s-2.2-1-3.6-1C2.9 7 1 8.5.3 10.7c-1.4 2.5.4 7.8 1.9 10.4.7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-1.1 2.7-2.2.8-1.3 1.2-2.6 1.2-2.6s-2.3-.9-2.3-3.5c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.7-1.7-3.2-1.7h-.1z" fill="white"/><text x="18" y="19" font-size="13" font-weight="500" font-family="-apple-system,BlinkMacSystemFont,sans-serif" fill="white"> Pay</text></svg>
  </div>
  <div style="background:#fff;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <svg width="40" height="16" viewBox="0 0 60 22" xmlns="http://www.w3.org/2000/svg"><text x="0" y="16" font-size="12" font-family="Arial,sans-serif" font-weight="500"><tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan fill="#FBBC05">o</tspan><tspan fill="#4285F4">g</tspan><tspan fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan></text><text x="38" y="16" font-size="12" font-family="Arial,sans-serif" font-weight="500" fill="#5f6368"> Pay</text></svg>
  </div>
  <div style="background:#007bc1;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <span style="font-weight:900;font-size:8px;color:#fff;font-family:Arial,sans-serif;letter-spacing:0.2px;text-align:center;line-height:1.2">AMERICAN<br>EXPRESS</span>
  </div>
  <div style="background:#fff;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <svg width="36" height="22" viewBox="0 0 36 22"><circle cx="13" cy="11" r="10" fill="#009be0"/><circle cx="23" cy="11" r="10" fill="#ee0005"/><path d="M18 4a10 10 0 0 1 0 14A10 10 0 0 1 18 4z" fill="#7b2d8b"/></svg>
  </div>
</div>`

function EditModal({ offer, onClose, onSaved }) {
  const [form, setForm] = useState({
    offer_num: offer.offer_num || offer.custom_id || '',
    project: offer.project || '',
    width: offer.width || '',
    height: offer.height || '',
    colors: offer.colors || '',
    backplate: offer.backplate || 'Ausgeschnitten',
    backplate_color: offer.backplate_color || 'Transparent',
    usage: offer.usage || 'Innen',
    base_price: offer.base_price || '',
    disc_type: offer.disc_type || 'pct',
    disc_val: offer.disc_val || '20',
    vat_pct: offer.vat_pct || '19',
    delivery: offer.delivery || '',
    checkout_url: offer.checkout_url || '',
    customer_note: offer.customer_note || '',
    valid_until: offer.valid_until ? offer.valid_until.slice(0, 10) : '',
    status: offer.status || 'offer_sent',
    customer_email: offer.customer_email || '',
    size_warning_enabled: offer.size_warning_enabled || false,
    size_warning_text: offer.size_warning_text || 'Für dieses Design benötigen wir leider eine Mindestgröße von 120 x 25 CM, da sonst Details und Lesbarkeit darunter leiden würden. Kleiner gewünscht? Kontaktiere uns - wir können dein Design eventuell vereinfachen.',
  })
  const [saving, setSaving] = useState(false)
  const [imgSrcs, setImgSrcs] = useState([
    offer.preview_image || null,
    offer.preview_image_2 || null,
    offer.preview_image_3 || null,
  ])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const prices = calcPrices(form.base_price, form.disc_type, form.disc_val, form.vat_pct)

  async function handleImage(e, idx) {
    const file = e.target.files[0]; if (!file) return
    try {
      const compressed = await compressImage(file)
      setImgSrcs(prev => { const next = [...prev]; next[idx] = compressed; return next })
    } catch (err) {
      alert('Bild konnte nicht verarbeitet werden: ' + err.message)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const uploadedImgs = [...imgSrcs]
      for (let i = 0; i < 3; i++) {
        if (imgSrcs[i] && imgSrcs[i].startsWith('data')) {
          const blob = await (await fetch(imgSrcs[i])).blob()
          const fd = new FormData()
          fd.append('file', blob, `offer-edit-${Date.now()}-${i}.jpg`)
          fd.append('offerId', offer.id)
          const up = await fetch('/api/upload', { method: 'POST', body: fd })
          const upData = await up.json()
          if (upData.url) uploadedImgs[i] = upData.url
        }
      }
      const payload = {
        offer_num: form.offer_num, project: form.project,
        width: form.width, height: form.height, colors: form.colors,
        backplate: form.backplate, backplate_color: form.backplate_color, usage: form.usage,
        base_price: parseFloat(form.base_price) || 0, disc_type: form.disc_type,
        disc_val: parseFloat(form.disc_val) || 0, vat_pct: parseFloat(form.vat_pct) || 19,
        net_price: prices.net, final_price: prices.total,
        delivery: form.delivery, checkout_url: form.checkout_url,
        customer_note: form.customer_note || null,
        valid_until: form.valid_until || null, status: form.status,
        customer_email: form.customer_email || null,
        size_warning_enabled: form.size_warning_enabled, size_warning_text: form.size_warning_text || null,
        preview_image: uploadedImgs[0], preview_image_2: uploadedImgs[1], preview_image_3: uploadedImgs[2],
      }
      const res = await fetch(`/api/offers?id=${offer.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onSaved()
    } catch (err) { alert('Fehler: ' + err.message) }
    setSaving(false)
  }

  const inp = { background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }
  const sel = { ...inp, cursor: 'pointer' }
  const lbl = { fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--panel)', color: 'var(--text)', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Angebot bearbeiten</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>#{offer.custom_id || offer.id.slice(0,8)}{offer.project ? ` · ${offer.project}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-faint)', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Vorschaubilder</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[0,1,2].map(idx => (
                <label key={idx} htmlFor={`edit-img-${idx}`} style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 8, textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'var(--input-bg)' }}>
                  <input id={`edit-img-${idx}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImage(e, idx)} />
                  {imgSrcs[idx]
                    ? <img src={imgSrcs[idx]} style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 6 }} alt="" />
                    : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Bild {idx+1}</span></>
                  }
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Angebotsdaten</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Angebotsnummer</label><input style={inp} value={form.offer_num} onChange={e => set('offer_num', e.target.value)} /></div>
                <div><label style={lbl}>Projekt / Kundenname</label><input style={inp} value={form.project} onChange={e => set('project', e.target.value)} /></div>
              </div>
              <div><label style={lbl}>Kunden-E-Mail</label><input style={{...inp, borderColor: 'var(--email-border)', background: 'var(--email-bg)'}} type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="kunde@email.de" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Breite (cm)</label><input style={inp} type="number" value={form.width} onChange={e => set('width', e.target.value)} /></div>
                <div><label style={lbl}>Höhe (cm)</label><input style={inp} type="number" value={form.height} onChange={e => set('height', e.target.value)} /></div>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: form.size_warning_enabled ? 8 : 0 }}>
                  <input type="checkbox" checked={form.size_warning_enabled} onChange={e => set('size_warning_enabled', e.target.checked)} />
                  <span style={lbl}>Mindestgröße-Hinweis anzeigen</span>
                </label>
                {form.size_warning_enabled && (
                  <textarea style={{ ...inp, minHeight: 90, resize: 'vertical', lineHeight: 1.5 }} value={form.size_warning_text} onChange={e => set('size_warning_text', e.target.value)} placeholder="Warntext für den Kunden..." />
                )}
              </div>
              <div><label style={lbl}>Farbe(n) – kommagetrennt</label><input style={inp} value={form.colors} onChange={e => set('colors', e.target.value)} /></div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Konfiguration</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Rückwandform</label>
                <select style={sel} value={form.backplate} onChange={e => set('backplate', e.target.value)}>
                  {BACKPLATE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Rückwandfarbe</label>
                <select style={sel} value={form.backplate_color} onChange={e => set('backplate_color', e.target.value)}>
                  {BACKPLATE_COLOR_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Verwendungszweck</label>
                <select style={sel} value={form.usage} onChange={e => set('usage', e.target.value)}>
                  {USAGE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Preiskalkulation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={lbl}>Listenpreis (netto)</label><input style={inp} type="number" step="0.01" value={form.base_price} onChange={e => set('base_price', e.target.value)} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Rabatt-Typ</label>
                  <select style={sel} value={form.disc_type} onChange={e => set('disc_type', e.target.value)}>
                    <option value="pct">Prozent (%)</option>
                    <option value="eur">Euro (€)</option>
                  </select>
                </div>
                <div><label style={lbl}>Rabatt ({form.disc_type === 'pct' ? '%' : '€'})</label><input style={inp} type="number" step="0.01" value={form.disc_val} onChange={e => set('disc_val', e.target.value)} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>MwSt. (%)</label><input style={inp} type="number" value={form.vat_pct} onChange={e => set('vat_pct', e.target.value)} /></div>
                <div><label style={lbl}>Kalkuliert</label>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 700, color: '#16a34a' }}>
                    {prices.total > 0 ? `€ ${prices.total.toFixed(2)}` : '–'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Weitere Einstellungen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Lieferdatum</label><input style={inp} value={form.delivery} onChange={e => set('delivery', e.target.value)} placeholder="27. Mai – 3. Juni" /></div>
                <div><label style={lbl}>Gültig bis</label><input style={inp} type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} /></div>
              </div>
              <div><label style={lbl}>Status</label>
                <select style={sel} value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Checkout-URL</label><input style={inp} value={form.checkout_url} onChange={e => set('checkout_url', e.target.value)} placeholder="https..." /></div>
              <div><label style={lbl}>Notizen für den Kunden</label>
                <textarea style={{ ...inp, minHeight: 72, resize: 'vertical', lineHeight: 1.5 }} value={form.customer_note} onChange={e => set('customer_note', e.target.value)} placeholder="z.B. Bitte überprüfen Sie die Maße nochmals..." />
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: 12, fontWeight: 500, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Wird gespeichert...' : '✓ Änderungen speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===================== STARTSEITE =====================
const NF_LOGO = 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735'
const NEON = '#60c8f0'
const SHOPIFY_DRAFTS = 'https://admin.shopify.com/store/atcbcn-sh/draft_orders'

const daysSince = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

function HomeCSS() {
  return <style>{`
    .nf-b{transition:transform .15s,box-shadow .15s,filter .15s,border-color .15s}
    .nf-b:hover{transform:translateY(-2px);box-shadow:0 0 22px ${NEON}66;border-color:${NEON}!important;filter:brightness(1.06)}
    @keyframes nfPulse{0%,100%{opacity:1}50%{opacity:.35}}
  `}</style>
}

function HomeBtn({ c }) {
  const s = {
    marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
    padding: '14px 16px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    textDecoration: 'none', boxSizing: 'border-box',
    background: c.primary ? NEON : 'transparent', color: c.primary ? '#0a0a0a' : (c.dark ? '#fff' : 'var(--text)'),
    border: c.primary ? `1px solid ${NEON}` : `1px solid ${c.dark ? '#2b2e36' : 'var(--border)'}`,
  }
  return c.href
    ? <a className="nf-b" href={c.href} target="_blank" rel="noopener" style={s}>{c.btn}</a>
    : <button className="nf-b" onClick={c.onClick} style={s}>{c.btn}</button>
}

function HomePage({ offers, setTab, theme, toggleTheme, onLogout }) {
  const n = offers.filter(o => daysSince(o.created_at) >= 3 && o.status !== 'recontacted' && o.status !== 'confirmed').length
  const card = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 18, padding: 32, display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }
  const redPill = { background: '#dc2626', color: '#fff', borderRadius: 20, fontSize: 12, fontWeight: 800, padding: '3px 9px' }

  const main = [
    { icon: '✏️', title: 'Neues Angebot', text: 'Angebot inkl. Vorschau, Angebotsseite und Kunden-E-Mail erstellen – PDF hochladen, Preis setzen, fertig.', btn: '＋ Angebot erstellen', primary: true, dark: true, onClick: () => setTab('create') },
    { icon: '📋', title: 'Meine Angebote', text: 'Alle Angebote im Überblick – Status ändern, bearbeiten, Links kopieren.', btn: '⚡ Zu meinen Angeboten', onClick: () => setTab('manage') },
  ]
  const small = [
    { icon: '↩️', title: 'Nachfassen', badge: n, text: n ? `${n} Angebote sind älter als 3 Tage und warten auf eine Erinnerung.` : 'Alles erledigt – aktuell keine Erinnerungen fällig.', btn: '↩ Erinnerungen senden', onClick: () => setTab('manage') },
    { icon: '🌐', title: 'Shop', text: 'neonframe.de aus Kundensicht prüfen.', btn: '🌐 neonframe.de öffnen', href: 'https://neonframe.de' },
    { icon: '🛒', title: 'Bestellentwürfe', text: 'Direkt zu den Shopify Draft Orders.', btn: '🛒 Shopify öffnen', href: SHOPIFY_DRAFTS },
  ]

  return (
    <>
      <HomeCSS />
      <div style={{ background: '#0a0a0a', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <img src={NF_LOGO} alt="NeonFrame" style={{ height: 52, display: 'block' }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid #2b2e36', color: '#9ca3af', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Abmelden</button>
        </div>
      </div>

      <div
        onClick={() => n && setTab('manage')}
        style={{ background: n ? 'linear-gradient(90deg,#7f1d1d,#b91c1c)' : 'linear-gradient(90deg,#14532d,#16a34a)', padding: '13px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: n ? 'pointer' : 'default' }}
      >
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff', animation: n ? 'nfPulse 1.4s infinite' : 'none' }} />
        {n
          ? <>{n} {n === 1 ? 'Angebot wartet' : 'Angebote warten'} seit über 3 Tagen auf eine Erinnerung <span style={{ textDecoration: 'underline' }}>Jetzt nachfassen →</span></>
          : 'Alles erledigt – keine offenen Erinnerungen ✓'}
      </div>

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '48px 32px 64px' }}>
        <h1 style={{ fontSize: 38, fontWeight: 800, margin: '0 0 32px' }}>Willkommen 👋</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: 24, marginBottom: 24 }}>
          {main.map(c => (
            <div key={c.title} style={{ ...card, minHeight: 360, padding: 40, background: c.dark ? 'radial-gradient(ellipse at 20% 0%,#0e3a4a 0%,#0a0a0a 70%)' : 'var(--panel)', color: c.dark ? '#fff' : 'var(--text)', borderColor: c.dark ? NEON + '66' : 'var(--border)' }}>
              <div style={{ fontSize: 48 }}>{c.icon}</div>
              <h3 style={{ margin: '8px 0 0', fontSize: 34, fontWeight: 800 }}>{c.title}</h3>
              <p style={{ margin: '0 0 24px', fontSize: 16, lineHeight: 1.6, color: c.dark ? '#9ca3af' : 'var(--text-muted)', maxWidth: 460 }}>{c.text}</p>
              <HomeBtn c={c} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 24 }}>
          {small.map(c => (
            <div key={c.title} style={{ ...card, minHeight: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>{c.icon}</span>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{c.title}</h3>
                {c.badge > 0 && <span style={redPill}>{c.badge}</span>}
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>{c.text}</p>
              <HomeBtn c={c} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
// =================== ENDE STARTSEITE ===================

// ===================== VERWALTEN (Liste + Detail) =====================
const mLink = (o) => `${typeof window !== 'undefined' ? window.location.origin : ''}/angebot/${o.custom_id || o.id}`
const mId = (o) => String(o.custom_id || String(o.id).slice(0, 8))
const mDays = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
const mIsRed = (o) => mDays(o.created_at) >= 3 && o.status !== 'recontacted' && o.status !== 'confirmed'
const mDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'
const mEur = (n) => `€ ${(parseFloat(n) || 0).toFixed(2)}`
const mStatus = (v) => STATUS_OPTIONS.find(s => s.value === v) || STATUS_OPTIONS[0]
const mImgs = (o) => [o.preview_image, o.preview_image_2, o.preview_image_3].filter(Boolean)
const mTint = (c) => ({ background: c + '1a', border: `1px solid ${c}55`, color: c })
const M_NEON = '#60c8f0'
const M_KINDS = {
  outline: { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' },
  neon: { background: M_NEON, border: `1px solid ${M_NEON}`, color: '#0a0a0a' },
  edit: mTint('#3b82f6'), del: mTint('#ef4444'), review: mTint('#eab308'), red: mTint('#ef4444'),
  muted: { background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-muted)' },
}

function MCSS() {
  return <style>{`
    .nf-mb{transition:transform .15s,box-shadow .15s,filter .15s}
    .nf-mb:hover{transform:translateY(-1px);box-shadow:0 0 16px ${M_NEON}55;filter:brightness(1.1)}
  `}</style>
}
function MB({ children, kind = 'outline', onClick, small, title, style }) {
  return <button type="button" className="nf-mb" title={title} onClick={onClick} style={{ borderRadius: 10, padding: small ? '5px 10px' : '11px 14px', fontSize: small ? 11 : 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', ...M_KINDS[kind], ...style }}>{children}</button>
}
const MLbl = ({ children, style }) => <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-faint)', marginBottom: 8, ...style }}>{children}</div>
const MCard = ({ title, children }) => <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>{title && <MLbl>{title}</MLbl>}{children}</div>
const MKv = ({ k, v, color }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px dashed var(--border)', fontSize: 13 }}><span style={{ color: 'var(--text-muted)' }}>{k}</span><span style={{ fontWeight: 600, color: color || 'var(--text)', textAlign: 'right' }}>{v}</span></div>
const MAktiv = ({ o }) => <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, ...(o.published ? mTint('#22c55e') : mTint('#6b7280')) }}>{o.published ? 'Aktiv' : 'Inaktiv'}</span>
const MDateTxt = ({ o }) => <span style={{ fontSize: 12, color: mIsRed(o) ? '#ef4444' : 'var(--text-faint)', fontWeight: mIsRed(o) ? 700 : 400 }}>📅 {mDate(o.created_at)}{mIsRed(o) && ` · ${mDays(o.created_at)} Tage`}</span>

function MGallery({ o }) {
  const list = mImgs(o)
  const [i, setI] = useState(0)
  useEffect(() => { setI(0) }, [o.id])
  if (!list.length) return <div style={{ height: 260, borderRadius: 14, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Kein Vorschaubild</div>
  return (
    <div>
      <div style={{ height: 260, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: '#0b0d12' }}>
        <img src={list[i] || list[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </div>
      {list.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {list.map((s, j) => <img key={j} src={s} alt="" onClick={() => setI(j)} style={{ width: 70, height: 52, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: `2px solid ${j === i ? M_NEON : 'transparent'}` }} />)}
        </div>
      )}
    </div>
  )
}

function MTimeline({ o }) {
  const ev = [
    { t: 'Angebot erstellt & gesendet', d: mDate(o.created_at), c: '#16a34a', done: true },
    { t: 'Erinnerung gesendet', d: o.status !== 'offer_sent' ? 'erledigt' : '—', c: '#d97706', done: o.status !== 'offer_sent' },
    { t: 'Bestellt', d: o.status === 'confirmed' ? 'erledigt' : '—', c: '#2563eb', done: o.status === 'confirmed' },
  ]
  return (
    <div>
      {ev.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: i < ev.length - 1 ? 16 : 0 }}>
          {i < ev.length - 1 && <span style={{ position: 'absolute', left: 6, top: 16, bottom: 0, width: 2, background: 'var(--border)' }} />}
          <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 2, background: e.done ? e.c : 'transparent', border: `2px solid ${e.done ? e.c : 'var(--border)'}`, boxShadow: e.done ? `0 0 10px ${e.c}88` : 'none' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: e.done ? 'var(--text)' : 'var(--text-faint)' }}>{e.t}</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{e.d}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MLinkRow({ label, url, on, offText }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <MLbl style={{ marginBottom: 5 }}>{label}</MLbl>
      {on && url ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
          <MB small onClick={() => navigator.clipboard.writeText(url)}>Kopieren</MB>
          <MB small onClick={() => window.open(url, '_blank')}>Öffnen</MB>
        </div>
      ) : <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{offText}</span>}
    </div>
  )
}

function MDetail({ o, onEdit, onContact, onReview, onToggle, onDelete, onStatus }) {
  const p = calcPrices(o.base_price, o.disc_type, o.disc_val, o.vat_pct)
  const colors = (o.colors || '').split(',').map(c => c.trim()).filter(Boolean)
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 30, fontWeight: 900 }}>#{mId(o)}</span>
            <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-muted)' }}>{o.project}</span>
            <MAktiv o={o} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            {o.offer_num && <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>Nr. {o.offer_num}</span>}
            <MDateTxt o={o} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <MB kind="edit" onClick={onEdit}>✏️ Bearbeiten</MB>
          <MB kind={mIsRed(o) ? 'red' : 'muted'} onClick={onContact} title={o.customer_email || 'Keine E-Mail hinterlegt'}>↩ Erneut kontaktieren</MB>
          {o.status === 'confirmed' && <MB kind="review" onClick={onReview}>⭐ Bewertung</MB>}
          <MB onClick={onToggle}>{o.published ? 'Deaktivieren' : 'Aktivieren'}</MB>
          <MB kind="del" onClick={onDelete} title="Löschen">🗑</MB>
        </div>
      </div>

      {mIsRed(o) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ef44441a', border: '1px solid #ef444455', color: '#ef4444', borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>
          ⚠️ Seit {mDays(o.created_at)} Tagen keine Rückmeldung – Zeit zum Nachfassen.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16 }}>
        <MCard title="Vorschau"><MGallery o={o} /></MCard>
        <MCard title="Konfiguration">
          <div style={{ marginBottom: 12 }}>
            <MKv k="Maße" v={o.width && o.height ? `${o.width} × ${o.height} cm${o.size_warning_enabled ? ' ⚠️' : ''}` : '–'} />
            <MKv k="Rückwandform" v={o.backplate || '–'} />
            <MKv k="Rückwandfarbe" v={o.backplate_color || '–'} />
            <MKv k="Verwendung" v={o.usage || '–'} />
          </div>
          <MLbl style={{ marginBottom: 6 }}>Farben</MLbl>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {colors.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>–</span>}
            {colors.map(c => (
              <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: colorDot(c), border: '1px solid rgba(0,0,0,.15)' }} />{c}
              </span>
            ))}
          </div>
        </MCard>
        <MCard title="Preis">
          <MKv k="Listenpreis (netto)" v={mEur(o.base_price)} />
          {p.discAmt > 0 && <MKv k={`Rabatt (${o.disc_type === 'pct' ? o.disc_val + '%' : mEur(o.disc_val)})`} v={'− ' + mEur(p.discAmt)} color="#22c55e" />}
          <MKv k="Netto nach Rabatt" v={mEur(p.net)} />
          <MKv k={`MwSt. (${o.vat_pct || 19}%)`} v={'+ ' + mEur(p.vatAmt)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12 }}>
            <span style={{ fontWeight: 800 }}>Gesamt</span>
            <span style={{ fontSize: 26, fontWeight: 900 }}>{o.final_price > 0 ? mEur(o.final_price) : '–'}</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <MLbl>Status</MLbl>
            <select value={o.status || 'offer_sent'} onChange={e => onStatus(e.target.value)} style={{ fontSize: 13, padding: '10px 12px', borderRadius: 10, border: `1px solid ${mStatus(o.status).color}88`, background: 'var(--input-bg)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </MCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 16 }}>
        <MCard title="Links">
          <MLinkRow label="Angebotslink" url={mLink(o)} on={o.published} offText="Angebot deaktiviert – Link nicht erreichbar" />
          <MLinkRow label="Checkout-Link (Shopify)" url={o.checkout_url} on={true} offText="Nicht vorhanden" />
        </MCard>
        <MCard title="Verlauf"><MTimeline o={o} /></MCard>
        <MCard title="Kunde & Notiz">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: `${M_NEON}22`, border: `1px solid ${M_NEON}55`, color: M_NEON, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, flexShrink: 0 }}>{(o.project || '?')[0].toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{o.project || '–'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>✉️ {o.customer_email || 'keine E-Mail'}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6, color: o.customer_note ? 'var(--text)' : 'var(--text-faint)', whiteSpace: 'pre-wrap' }}>{o.customer_note || 'Keine Notiz hinterlegt.'}</div>
        </MCard>
      </div>
    </div>
  )
}

function ManagePage({ offers, loadingOffers, loadOffers, setTab, theme, toggleTheme, onLogout, updateStatus, toggleOffer, deleteOffer }) {
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [sel, setSel] = useState(null)
  const [editing, setEditing] = useState(null)

  const ql = q.toLowerCase()
  const list = offers.filter(o =>
    (!ql || (o.project || '').toLowerCase().includes(ql) || String(o.custom_id || '').includes(ql) || String(o.offer_num || '').toLowerCase().includes(ql)) &&
    (!st || o.status === st)
  )
  const o = list.find(x => x.id === sel) || list[0]
  const due = offers.filter(mIsRed).length
  const inp = { background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: 'var(--text)', width: '100%' }

  async function contact(o) {
    if (!o.customer_email) { alert('Keine E-Mail hinterlegt. Bitte im Bearbeiten-Menü ergänzen.'); return }
    if (!confirm(`Erinnerungs-E-Mail an ${o.customer_email} senden?`)) return
    try {
      const res = await fetch('/api/recontact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerId: o.id, customerEmail: o.customer_email, customerName: o.project, offerLink: mLink(o), price: o.final_price, width: o.width, height: o.height, colors: o.colors }) })
      const data = await res.json()
      if (data.success) { alert('✅ E-Mail gesendet & Status aktualisiert!'); loadOffers() } else { alert('Fehler: ' + data.error) }
    } catch (err) { alert('Fehler: ' + err.message) }
  }
  async function review(o) {
    if (!o.customer_email) { alert('Keine E-Mail hinterlegt.'); return }
    if (!confirm(`Bewertungsanfrage an ${o.customer_email} senden?`)) return
    try {
      const res = await fetch('/api/review-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerEmail: o.customer_email, customerName: o.project }) })
      const data = await res.json()
      if (data.success) { alert('✅ Bewertungsanfrage gesendet!') } else { alert('Fehler: ' + data.error) }
    } catch (err) { alert('Fehler: ' + err.message) }
  }

  return (
    <div className="nf-admin" data-theme={theme} style={{ position: 'fixed', inset: 0, background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <ThemeVars />
      <MCSS />
      {editing && <EditModal offer={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadOffers() }} />}

      <div style={{ background: '#0a0a0a', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid #1f2937', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" title="Zur Startseite" onClick={() => setTab('home')} style={{ height: 40, cursor: 'pointer' }} />
          <button onClick={() => setTab('create')} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontFamily: 'inherit' }}>Erstellen</button>
          <button style={{ position: 'relative', padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: `1px solid ${M_NEON}66`, background: `${M_NEON}1a`, color: M_NEON, cursor: 'default', fontFamily: 'inherit' }}>
            Verwalten
            {due > 0 && <span style={{ position: 'absolute', top: -7, right: -9, background: '#dc2626', color: '#fff', borderRadius: 10, minWidth: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{due}</span>}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid #2b2e36', color: '#9ca3af', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Abmelden</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: 400, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--panel)', flexShrink: 0 }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 18 }}>Alle Angebote <span style={{ fontSize: 13, color: 'var(--text-faint)', fontWeight: 500 }}>({offers.length})</span></span>
              <MB small kind="neon" onClick={loadOffers} title="Aktualisieren">⟳</MB>
            </div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name, ID oder Angebotsnummer..." style={inp} />
            <select value={st} onChange={e => setSt(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="">Alle Status</option>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loadingOffers && offers.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Wird geladen...</div>}
            {!loadingOffers && list.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>Keine Angebote gefunden.</div>}
            {list.map(x => {
              const act = o && x.id === o.id
              const img = mImgs(x)[0]
              return (
                <div key={x.id} onClick={() => setSel(x.id)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: act ? `${M_NEON}14` : 'transparent', boxShadow: act ? `inset 3px 0 0 ${M_NEON}` : 'none' }}>
                  {img ? <img src={img} alt="" style={{ width: 48, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} /> : <div style={{ width: 48, height: 40, borderRadius: 8, background: 'var(--bg-alt)', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: mStatus(x.status).color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 800 }}>#{mId(x)}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.project}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 800, whiteSpace: 'nowrap' }}>{x.final_price > 0 ? mEur(x.final_price) : '–'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <MDateTxt o={x} />
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{mStatus(x.status).label}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {o ? (
            <MDetail
              o={o}
              onEdit={() => setEditing(o)}
              onContact={() => contact(o)}
              onReview={() => review(o)}
              onToggle={() => toggleOffer(o.id, o.published)}
              onDelete={() => deleteOffer(o.id)}
              onStatus={(v) => updateStatus(o.id, v)}
            />
          ) : <div style={{ padding: 40, color: 'var(--text-faint)' }}>Kein Angebot ausgewählt.</div>}
        </div>
      </div>
    </div>
  )
}
// =================== ENDE VERWALTEN ===================

// ===================== ERSTELLEN (Design) =====================
const C_NEON = '#60c8f0'
const cLbl = { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 6 }
const cIn = { background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }
const cDrop = { border: '1px dashed var(--border)', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--input-bg)', color: 'var(--text-muted)', fontSize: 13, transition: '.15s' }

function CCSS() {
  return <style>{`
    .nf-cb{transition:transform .15s,box-shadow .15s,filter .15s}
    .nf-cb:hover{transform:translateY(-1px);box-shadow:0 0 18px ${C_NEON}55;filter:brightness(1.08)}
    .nf-cin{transition:border-color .15s,box-shadow .15s}
    .nf-cin:focus{border-color:${C_NEON}!important;box-shadow:0 0 0 3px ${C_NEON}22}
    .nf-cdrop:hover{border-color:${C_NEON}!important}
  `}</style>
}

function CCard({ t, sub, children }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 18, padding: 22 }}>
      {t && <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><span style={{ fontSize: 15, fontWeight: 800 }}>{t}</span>{sub && <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{sub}</span>}</div>}
      {children}
    </div>
  )
}

function CSeg({ label, value, opts, onChange }) {
  return (
    <div>
      <label style={cLbl}>{label}</label>
      <div style={{ display: 'flex', gap: 4, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 4 }}>
        {opts.map(o => {
          const v = typeof o === 'string' ? o : o.value
          const l = typeof o === 'string' ? o : o.label
          const act = value === v
          return <button key={v} type="button" onClick={() => onChange(v)} style={{ flex: 1, padding: '8px 6px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: act ? C_NEON : 'transparent', color: act ? '#0a0a0a' : 'var(--text-muted)', boxShadow: act ? `0 0 12px ${C_NEON}66` : 'none' }}>{l}</button>
        })}
      </div>
    </div>
  )
}
// =================== ENDE ERSTELLEN (Design) ===================

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState(false)
  const [tab, setTab] = useState('home')
  const [previewTab, setPreviewTab] = useState('angebot')
  const [offers, setOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [editingOffer, setEditingOffer] = useState(null)
  const [manageSearch, setManageSearch] = useState('')
  const [manageStatus, setManageStatus] = useState('')

  const fRef = useRef({
    num: '', project: '', customerEmail: '', customerNote: '', w: '', h: '',
    backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen',
    color: '', basePrice: '', discType: 'pct', discVal: '20', vat: '19',
    delivery: '', url: '', validUntil: '', status: 'offer_sent',
    sizeWarningText: 'Für dieses Design benötigen wir leider eine Mindestgröße von 120 x 25 CM, da sonst Details und Lesbarkeit darunter leiden würden. Kleiner gewünscht? Kontaktiere uns - wir können dein Design eventuell vereinfachen.',
  })

  const [selects, setSelects] = useState({ backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen', discType: 'pct', status: 'offer_sent', sizeWarningEnabled: false })
  const [priceInputs, setPriceInputs] = useState({ basePrice: '', discVal: '20', vat: '19' })
  const [imgSrcs, setImgSrcs] = useState([])
  const [parseStatus, setParseStatus] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [publishedLink, setPublishedLink] = useState(null)
  const [previewOfferId, setPreviewOfferId] = useState(null)
  const [previewOfferDbId, setPreviewOfferDbId] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(null)
  const [formKey, setFormKey] = useState(0)
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false)
  const [theme, setTheme] = useState('light')
  const iframeRef = useRef(null)
  const emailIframeRef = useRef(null)

  const prices = calcPrices(priceInputs.basePrice, selects.discType, priceInputs.discVal, priceInputs.vat)

  const updText = (k, v) => { fRef.current[k] = v; schedulePreview() }
  const updSelect = (k, v) => { fRef.current[k] = v; setSelects(p => ({ ...p, [k]: v })) }
  const updPrice = (k, v) => { fRef.current[k] = v; setPriceInputs(p => ({ ...p, [k]: v })) }
  const updPriceField = (k, v) => { fRef.current[k] = v }
  const toggleColor = (c) => {
    const current = fRef.current.color.split(',').map(s => s.trim()).filter(Boolean)
    const idx = current.findIndex(x => x.toLowerCase() === c.toLowerCase())
    if (idx >= 0) current.splice(idx, 1)
    else current.push(c)
    fRef.current.color = current.join(', ')
    setFormKey(k => k + 1)
    schedulePreview()
  }

  function resetForm() {
    fRef.current = {
      num: '', project: '', customerEmail: '', customerNote: '', w: '', h: '',
      backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen',
      color: '', basePrice: '', discType: 'pct', discVal: '20', vat: '19',
      delivery: '', url: '', validUntil: '', status: 'offer_sent',
      sizeWarningText: 'Für dieses Design benötigen wir leider eine Mindestgröße von 120 x 25 CM, da sonst Details und Lesbarkeit darunter leiden würden. Kleiner gewünscht? Kontaktiere uns - wir können dein Design eventuell vereinfachen.',
    }
    setSelects({ backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen', discType: 'pct', status: 'offer_sent', sizeWarningEnabled: false })
    setPriceInputs({ basePrice: '', discVal: '20', vat: '19' })
    setImgSrcs([])
    setPublishedLink(null)
    setParseStatus(null)
    setPreviewOfferId(null)
    setPreviewOfferDbId(null)
    setShowPreviewModal(null)
    setColorDropdownOpen(false)
    const pdfInput = document.getElementById('pdf-upload')
    if (pdfInput) pdfInput.value = ''
    const imgInput = document.getElementById('multi-img-upload')
    if (imgInput) imgInput.value = ''
    setFormKey(k => k + 1)
  }

  const debounceRef = useRef(null)
  const schedulePreview = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      renderPreviewFromRef()
      renderEmailPreview()
    }, 400)
  }, [])

  useEffect(() => { if (authed) schedulePreview() }, [selects, priceInputs, imgSrcs, authed, previewTab])
  useEffect(() => { if (showPreviewModal) renderPreviewFromRef() }, [showPreviewModal])
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nf_admin_theme')
      if (saved === 'dark' || saved === 'light') setTheme(saved)
    } catch {}
  }, [])
  const toggleTheme = () => {
    setTheme(t => {
      const next = t === 'light' ? 'dark' : 'light'
      try { localStorage.setItem('nf_admin_theme', next) } catch {}
      return next
    })
  }

  function renderPreviewFromRef() {
    if (!iframeRef.current) return
    const f = { ...fRef.current, ...selects, ...priceInputs }
    const p = calcPrices(f.basePrice, f.discType, f.discVal, f.vat)
    const colors = f.color.split(',').map(c => c.trim()).filter(Boolean)
    const colorPills = colors.map(c => `<div style="display:inline-flex;align-items:center;gap:6px;background:#f5f5f5;border:1px solid #eee;border-radius:20px;padding:6px 12px;font-size:12px;color:#333;margin-right:5px;margin-bottom:5px"><span style="width:9px;height:9px;border-radius:50%;background:${colorDot(c)};display:inline-block;border:1px solid rgba(0,0,0,.08)"></span>${c}</div>`).join('')

    const stepperSteps = ['Anfrage gesendet', 'Angebot erhalten', 'Bestätigt', 'In Produktion', 'Lieferung']
    const statusIndex = { offer_sent: 1, confirmed: 2, in_production: 3, shipped: 4 }
    const activeIdx = statusIndex[f.status] || 1
    const stepperHtml = stepperSteps.map((s, i) => {
      const done = i <= activeIdx
      const dot = done
        ? `<div style="width:22px;height:22px;border-radius:50%;background:#16a34a;border:2px solid #16a34a;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></div>`
        : `<div style="width:22px;height:22px;border-radius:50%;background:#e5e7eb;border:2px solid #d1d5db;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="width:7px;height:7px;border-radius:50%;background:#9ca3af;display:block"></span></div>`
      const label = `<span style="font-size:11px;font-weight:${done ? '600' : '400'};color:${done ? '#15803d' : '#9ca3af'};white-space:nowrap">${s}</span>`
      const line = i < stepperSteps.length - 1
        ? `<div style="flex:1;height:2px;background:${i < activeIdx ? '#16a34a' : '#e5e7eb'};margin:0 8px"></div>`
        : ''
      return `<div style="display:flex;align-items:center;flex:${i < stepperSteps.length-1 ? '1' : '0'}">${dot}<div style="margin-left:6px;margin-right:4px">${label}</div>${line}</div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;background:#fff;font-size:14px}
.hdr{background:#0a0a0a;padding:0 28px;height:72px;display:flex;align-items:center;justify-content:space-between}
.badge{background:rgba(96,200,240,.12);border:1px solid rgba(96,200,240,.3);color:#60c8f0;font-size:12px;font-weight:600;padding:6px 14px;border-radius:20px}
.stepper{background:#f9fafb;border-bottom:1px solid #eee;padding:12px 28px;display:flex;align-items:center}
.wrap{display:grid;grid-template-columns:1.2fr 1fr;gap:36px;padding:28px;max-width:1100px}
.img-box{border-radius:14px;overflow:hidden;background:#f5f5f5;border:1px solid #eee;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center}
.img-box img{width:100%;height:100%;object-fit:contain;display:block}
.contact-card{margin-top:14px;background:#fff;border:1px solid #eee;border-radius:12px;padding:16px}
.contact-hdr{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.contact-hdr img{width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0}
.contact-hdr h3{font-size:13px;font-weight:700;margin-bottom:2px}
.contact-hdr p{font-size:11px;color:#999;line-height:1.4}
h1{font-size:22px;font-weight:800;line-height:1.2;letter-spacing:-.02em;margin-bottom:8px}
.stars-row{display:flex;align-items:center;gap:6px;margin-bottom:10px}
.badge-made{display:inline-flex;align-items:center;gap:8px;background:#f5f5f5;border:1px solid #e8e8e8;border-radius:10px;padding:6px 11px;margin-bottom:14px}
.sz-row{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:10px;align-items:flex-start}
.cfg-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:flex-end}
.cfg-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111;display:block;margin-bottom:3px}
.pill{display:inline-flex;align-items:center;gap:5px;background:#f5f5f5;border:1px solid #eee;border-radius:20px;padding:5px 11px;font-size:12px;font-weight:500;color:#333}
.checks{margin-bottom:14px;display:flex;flex-direction:column;gap:7px}
.ck{display:flex;align-items:flex-start;gap:7px;font-size:12px;color:#555;line-height:1.5}
.ck-icon{color:#22c55e}
.price-box{background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:14px;margin-bottom:10px}
.pr{display:flex;justify-content:space-between;font-size:12px;color:#999;padding:3px 0}
.pr-d{display:flex;justify-content:space-between;font-size:12px;color:#16a34a;padding:3px 0;font-weight:600}
.pr-n{display:flex;justify-content:space-between;font-size:12px;color:#111;padding:3px 0}
.divider{border-top:1px solid #f0f0f0;margin:8px 0}
.total{display:flex;justify-content:space-between;align-items:baseline}
.tlbl{font-size:13px;font-weight:700;color:#111}
.tval{font-size:20px;font-weight:800;color:#111}
.tval-note{font-size:10px;color:#888;margin-left:5px;font-weight:400}
.ship{background:#f0fbff;border:1px solid #b8e8f8;border-radius:10px;padding:10px 13px;display:flex;align-items:center;gap:9px;margin-bottom:5px}
.cta{width:100%;background:#16a34a;color:#fff;border:none;border-radius:11px;padding:14px;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;margin:10px 0;cursor:pointer}
.warn{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin-bottom:10px;font-size:11px;color:#92400e}
</style></head><body>
<div class="hdr">
  <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" style="height:52px">
  <div style="display:flex;align-items:center;gap:8px">
    ${f.validUntil ? `<div style="background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35);color:#d97706;font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px">📅 Gültig bis ${new Date(f.validUntil).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>` : ''}
    ${f.num ? `<div class="badge">Angebot #${f.num}</div>` : ''}
  </div>
</div>
<div class="stepper">${stepperHtml}</div>
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
    </div>
  </div>
  <div>
    <h1>Individuelles LED-Neon-Schild –<br>personalisiert nach Wunsch</h1>
    <div class="stars-row"><span style="color:#f59e0b;font-size:16px">★★★★</span><span style="color:#e5e7eb;font-size:16px">★</span><span style="font-size:12px;color:#666;margin-left:4px">4,5 / 5 Sternen</span></div>
    ${f.project ? `<div class="badge-made"><span style="font-size:12px;color:#555">Individuell angefertigt für <strong style="color:#111">${f.project}</strong></span></div>` : ''}
    <div class="sz-row">
      ${f.w && f.h ? `<div><span class="cfg-lbl">Maße (Breite × Höhe)</span><div style="display:flex;align-items:center;gap:6px;margin-top:3px"><div class="pill" style="margin-top:0">${f.w} × ${f.h} cm</div>${f.sizeWarningEnabled ? `<span title="${(f.sizeWarningText||'').replace(/"/g,'&quot;')}" style="color:#dc2626;font-weight:800;font-size:15px;cursor:help">&#9888;</span>` : ''}</div></div>` : ''}
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
      ${p.vatAmt > 0 ? `<div class="pr-n"><span>+ MwSt. (${f.vat}%)</span><span>+ € ${p.vatAmt.toFixed(2)}</span></div>` : ''}
      <div class="divider"></div>
      <div class="total"><span class="tlbl">Gesamtbetrag</span><span class="tval">${p.total > 0 ? '€ ' + p.total.toFixed(2) : '–'}${p.total > 0 ? '<span class="tval-note">(inkl. MwSt.)</span>' : ''}</span></div>
    </div>
    <div class="cta">🛒 Angebot annehmen</div>
    ${PAYMENT_ICONS_HTML}
    <div class="warn">⚠️ Da es sich um ein individuell angefertigtes Produkt handelt, besteht gemäß § 312g BGB kein Widerrufsrecht.</div>
    <div class="ship"><span>🚚</span><div><strong style="display:block;font-size:12px">Kostenloser Versand</strong><span style="font-size:11px;color:#888">${f.delivery ? 'Geliefert zwischen ' + f.delivery : 'Lieferzeit 2–3 Wochen'}</span></div></div>
  </div>
</div>
</body></html>`
    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document
    if (doc) { doc.open(); doc.write(html); doc.close() }
  }

  function renderEmailPreview() {
    if (!emailIframeRef.current) return
    const f = { ...fRef.current, ...selects, ...priceInputs }
    const p = calcPrices(f.basePrice, f.discType, f.discVal, f.vat)
    const firstName = f.project.split(' ')[0] || 'dort'

    const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td style="background:#0a0a0a;border-radius:14px 14px 0 0;padding:24px;text-align:center">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" height="40" style="display:block;margin:0 auto">
        </td></tr>
        <tr><td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:3px;font-size:0">&nbsp;</td></tr>
        <tr><td style="background:#fff;padding:28px 28px 20px">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#111">Hallo ${firstName}! 👋</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#666;line-height:1.6">Ihr individuelles Angebot für Ihr personalisiertes LED-Neon-Schild ist fertig!</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:20px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:10px">Ihre Konfiguration</div>
            ${f.num ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span style="color:#666">Angebot</span><span style="font-weight:600">#${f.num}</span></div>` : ''}
            ${f.w && f.h ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span style="color:#666">Maße</span><span style="font-weight:600">${f.w} × ${f.h} cm</span></div>` : ''}
            ${f.color ? `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0"><span style="color:#666">Farben</span><span style="font-weight:600">${f.color}</span></div>` : ''}
            ${p.total > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0 0;margin-top:6px;border-top:1px solid #e2e8f0"><span style="font-weight:700">Gesamtbetrag</span><span style="font-weight:800;color:#111">€ ${p.total.toFixed(2)}</span></div>` : ''}
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
            <tr>
              <td style="padding-right:6px"><div style="background:#f8fafc;border:1.5px solid #e2e8f0;color:#111;text-align:center;padding:12px;border-radius:9px;font-size:13px;font-weight:600">📋 Angebot ansehen</div></td>
              <td style="padding-left:6px"><div style="background:#16a34a;color:#fff;text-align:center;padding:12px;border-radius:9px;font-size:13px;font-weight:700">🛒 Jetzt bestellen</div></td>
            </tr>
          </table>
          <p style="margin:0 0 8px;font-size:12px;color:#888;line-height:1.6">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>
          <p style="margin:0;font-size:11px;color:#aaa">⚠️ Kein Widerrufsrecht bei individuell angefertigten Produkten (§ 312g BGB)</p>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 14px 14px;padding:14px;text-align:center">
          <p style="margin:0;font-size:11px;color:#aaa">NeonFrame · neonframe.de · info@neonframe.de</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
    const doc = emailIframeRef.current.contentDocument || emailIframeRef.current.contentWindow.document
    if (doc) { doc.open(); doc.write(html); doc.close() }
  }

  async function handlePDF(e) {
    const file = e.target.files[0]; if (!file) return
    setParseStatus({ type: 'loading', msg: 'PDF wird gelesen...' })
    try {
      const txt = await extractPdfText(file)
      const p = parsePdfFields(txt)
      if (p.num) fRef.current.num = p.num
      if (p.project) fRef.current.project = p.project
      if (p.w) fRef.current.w = p.w
      if (p.h) fRef.current.h = p.h
      if (p.colors) fRef.current.color = p.colors
      if (p.backplate) updSelect('backplate', p.backplate)
      if (p.usage) updSelect('usage', p.usage)
      setFormKey(k => k + 1)
      setParseStatus({ type: 'ok', msg: `${Object.values(p).filter(Boolean).length} Felder erkannt – bitte prüfen` })
      schedulePreview()
    } catch (err) {
      setParseStatus({ type: 'err', msg: 'Fehler: ' + err.message })
    }
  }

  async function handleImage(e, idx) {
    const file = e.target.files[0]; if (!file) return
    try {
      const compressed = await compressImage(file)
      setImgSrcs(prev => { const next = [...prev]; next[idx] = compressed; return next })
    } catch (err) {
      alert('Bild konnte nicht verarbeitet werden: ' + err.message)
    }
  }

  async function publish() {
    setPublishing(true)
    const f = { ...fRef.current, ...selects, ...priceInputs }
    try {
      const uploadedImgs = [null, null, null]
      for (let i = 0; i < 3; i++) {
        if (imgSrcs[i] && imgSrcs[i].startsWith('data')) {
          const blob = await (await fetch(imgSrcs[i])).blob()
          const fd = new FormData(); fd.append('file', blob, `offer-${Date.now()}-${i}.jpg`); fd.append('offerId', f.num || 'new')
          const up = await fetch('/api/upload', { method: 'POST', body: fd })
          const upData = await up.json()
          if (upData.url) uploadedImgs[i] = upData.url
        }
      }

      const payload = {
        offer_num: f.num, project: f.project,
        width: f.w, height: f.h,
        backplate: f.backplate, backplate_color: f.backplate_color, usage: f.usage,
        colors: f.color,
        base_price: parseFloat(f.basePrice) || 0, disc_type: f.discType,
        disc_val: parseFloat(f.discVal) || 0, vat_pct: parseFloat(f.vat) || 19,
        net_price: prices.net, final_price: prices.total, rrp_price: prices.rrp,
        delivery: f.delivery,
        checkout_url: f.url,
        customer_note: f.customerNote || null,
        customer_email: f.customerEmail || null,
        valid_until: f.validUntil || null,
        status: f.status || 'offer_sent',
        size_warning_enabled: f.sizeWarningEnabled || false,
        size_warning_text: f.sizeWarningText || null,
        preview_image: uploadedImgs[0], preview_image_2: uploadedImgs[1], preview_image_3: uploadedImgs[2],
        published: true,
      }

let offerId = previewOfferId
      if (offerId) {
        const res = await fetch(`/api/offers?id=${previewOfferDbId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
      } else {
        const res = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
offerId = data.custom_id || data.id
        setPreviewOfferDbId(data.id)
      }
      const offerLink = `${window.location.origin}/angebot/${offerId}`

      const draftRes = await fetch('/api/draft-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: f.customerEmail,
          customerName: f.project,
          offerNum: f.num,
          finalPrice: prices.total,
          basePrice: f.basePrice,
          discVal: f.discVal,
          discType: f.discType,
          vatPct: f.vat,
          width: f.w,
          height: f.h,
          colors: f.color,
          backplate: f.backplate,
          backplateColor: f.backplate_color,
          usage: f.usage,
          delivery: f.delivery,
          offerLink,
        }),
      })

      const draftData = await draftRes.json()
      let statusMsg = `Veröffentlicht!\n\nAngebotslink\n${offerLink}`

      if (draftData.success) {
if (draftData.checkoutUrl) {
          await fetch(`/api/offers?id=${previewOfferDbId || offerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkout_url: draftData.checkoutUrl }),
          })
        }
        if (f.customerEmail) statusMsg += `\n\nKunden-E-Mail gesendet an ${f.customerEmail}`
      } else {
        statusMsg += `\n\n⚠️ Draft Order Fehler: ${draftData.error}`
      }

      setPublishedLink(offerLink)
      await navigator.clipboard.writeText(offerLink).catch(() => {})
      alert(statusMsg)

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

  async function updateStatus(id, newStatus) {
    await fetch(`/api/offers?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    loadOffers()
  }

  async function deleteOffer(id) {
    if (!confirm('Angebot wirklich löschen?')) return
    await fetch(`/api/offers?id=${id}`, { method: 'DELETE' })
    loadOffers()
  }

useEffect(() => { if (authed) loadOffers() }, [authed, tab])

  useEffect(() => {
    const titles = {
      home: 'Angebote - NeonFrame',
      create: 'Neues Angebot erstellen - NeonFrame',
      manage: 'Angebote verwalten - NeonFrame',
    }
    const due = offers.filter(o => Math.floor((Date.now() - new Date(o.created_at).getTime()) / 86400000) >= 3 && o.status !== 'recontacted' && o.status !== 'confirmed').length
    const base = !authed ? 'Login - NeonFrame Admin' : (titles[tab] || titles.home)
    document.title = authed && due > 0 ? `(${due}) ${base}` : base
  }, [tab, authed, offers])

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
    app: {display:'flex',flexDirection:'column',height:'100vh',background:'var(--bg)',color:'var(--text)',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'},
    topbar: {background:'var(--panel)',borderBottom:'1px solid var(--border)',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0},
    tabs: {display:'flex',gap:4},
    tab: (a) => ({padding:'6px 16px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',border:'none',background:a?'#0a0a0a':'transparent',color:a?'#fff':'var(--text-muted)',fontFamily:'inherit',transition:'.15s'}),
    main: {display:'flex',flex:1,overflowY:'auto',justifyContent:'center'},
    left: {width:'100%',maxWidth:820,flexShrink:0,display:'flex',flexDirection:'column',background:'var(--bg)',padding:'0 20px'},
    section: {borderBottom:'1px solid var(--border)',padding:'16px 20px'},
    sTitle: {fontSize:11,fontWeight:700,color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12},
    label: {fontSize:10,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.06em',display:'block',marginBottom:5},
    input: {background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%'},
    select: {background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontSize:13,fontFamily:'inherit',outline:'none',width:'100%',cursor:'pointer'},
    row2: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:10},
    uploadRow: {display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8},
    uploadZone: {border:'1px dashed var(--border)',borderRadius:10,padding:'14px 10px',textAlign:'center',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:6,position:'relative',background:'var(--input-bg)'},
    status: (t) => ({fontSize:12,padding:'8px 12px',borderRadius:8,marginTop:8,background:t==='ok'?'#f0fdf4':t==='warn'?'#fffbeb':'#fef2f2',border:`1px solid ${t==='ok'?'#bbf7d0':t==='warn'?'#fde68a':'#fecaca'}`,color:t==='ok'?'#166534':t==='warn'?'#92400e':'#991b1b'}),
    publishArea: {padding:'16px 20px',marginTop:'auto',borderTop:'1px solid var(--border)'},
    btnGreen: {background:'#16a34a',color:'#fff',border:'none',borderRadius:10,padding:'13px 20px',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit',width:'100%',marginBottom:8},
    btnDark: {background:'#0a0a0a',color:'#fff',border:'none',borderRadius:8,padding:'9px 14px',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'},
    btnOutline: {background:'transparent',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'9px 14px',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'},
    linkBox: {background:'var(--input-bg)',border:'1px solid var(--border)',borderRadius:8,padding:10,display:'flex',alignItems:'center',gap:8,marginTop:8},
    right: {flex:1,position:'relative',overflow:'hidden',background:'#f3f4f6',display:'flex',flexDirection:'column'},
    iframe: {width:'100%',flex:1,border:'none',display:'block',background:'#fff'},
  }

  const Field = ({ label, children }) => (
    <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={S.label}>{label}</label>{children}</div>
  )

if (tab === 'home') return (
    <div className="nf-admin" data-theme={theme} style={{position:'fixed',inset:0,overflowY:'auto',background:'var(--bg)',color:'var(--text)',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
      <ThemeVars />
      <HomePage offers={offers} setTab={setTab} theme={theme} toggleTheme={toggleTheme} onLogout={() => setAuthed(false)} />
    </div>
  )

if (tab === 'manage') return (
    <ManagePage
      offers={offers}
      loadingOffers={loadingOffers}
      loadOffers={loadOffers}
      setTab={setTab}
      theme={theme}
      toggleTheme={toggleTheme}
      onLogout={() => setAuthed(false)}
      updateStatus={updateStatus}
      toggleOffer={toggleOffer}
      deleteOffer={deleteOffer}
    />
  )

if (tab === 'create') return (
    <div className="nf-admin" data-theme={theme} style={{position:'fixed',inset:0,overflowY:'auto',background:'var(--bg)',color:'var(--text)',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
      <ThemeVars />
      <CCSS />
      {showPreviewModal && showPreviewModal !== null && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',flexDirection:'column'}}>
          <div style={{background:'var(--panel)',borderBottom:'1px solid var(--border)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <span style={{fontWeight:700,fontSize:15,color:'var(--text)'}}>👁 Vorschau</span>
            <div style={{display:'flex',gap:10}}>
              <button onClick={() => setShowPreviewModal(null)} style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'8px 16px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>✕ Schließen</button>
              <button onClick={() => { setShowPreviewModal(null); publish() }} style={{background:C_NEON,color:'#0a0a0a',border:'none',borderRadius:8,padding:'8px 20px',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:'inherit'}}>🚀 Jetzt veröffentlichen</button>
            </div>
          </div>
          <iframe src={showPreviewModal} style={{flex:1,border:'none',width:'100%',background:'#fff'}} title="Vorschau" />
        </div>
      )}

      <div style={{background:'#0a0a0a',height:64,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',borderBottom:'1px solid #1f2937',position:'sticky',top:0,zIndex:50}}>
        <div style={{display:'flex',alignItems:'center',gap:18}}>
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" title="Zur Startseite" onClick={() => setTab('home')} style={{height:40,cursor:'pointer'}} />
          <button style={{padding:'7px 16px',borderRadius:8,fontSize:13,fontWeight:700,border:`1px solid ${C_NEON}66`,background:`${C_NEON}1a`,color:C_NEON,cursor:'default',fontFamily:'inherit'}}>Erstellen</button>
          <button onClick={() => setTab('manage')} style={{position:'relative',padding:'7px 16px',borderRadius:8,fontSize:13,fontWeight:600,border:'none',background:'transparent',color:'#9ca3af',cursor:'pointer',fontFamily:'inherit'}}>
            Verwalten
            {(() => { const n = offers.filter(o => { const d = Math.floor((Date.now() - new Date(o.created_at).getTime())/(1000*60*60*24)); return d >= 3 && o.status !== 'recontacted' && o.status !== 'confirmed' }).length; return n > 0 ? <span style={{position:'absolute',top:-6,right:-8,background:'#dc2626',color:'#fff',borderRadius:10,minWidth:18,height:18,fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',lineHeight:1}}>{n}</span> : null })()}
          </button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button onClick={() => setAuthed(false)} style={{background:'transparent',border:'1px solid #2b2e36',color:'#9ca3af',borderRadius:8,padding:'8px 14px',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Abmelden</button>
        </div>
      </div>

      <div style={{maxWidth:1000,margin:'0 auto',padding:'32px 24px 60px',display:'flex',flexDirection:'column',gap:16}}>
        <h1 style={{margin:0,fontSize:30,fontWeight:900}}>Neues Angebot</h1>

        <CCard t="Dateien">
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <label className="nf-cdrop" htmlFor="multi-img-upload" style={{...cDrop,padding:'14px 16px',justifyContent:'center'}}>
              <input id="multi-img-upload" type="file" accept="image/*" multiple style={{display:'none'}} onChange={e => {
                const files = Array.from(e.target.files)
                Promise.all(files.map(file => compressImage(file)))
                  .then(compressed => setImgSrcs(prev => [...prev, ...compressed]))
                  .catch(err => alert('Bild konnte nicht verarbeitet werden: ' + err.message))
                e.target.value = ''
              }} />
              <span style={{fontSize:18}}>🖼️</span><span><b style={{color:'var(--text)'}}>Bilder hochladen</b> (max. 3 möglich)</span>
            </label>
            {imgSrcs.filter(Boolean).length > 0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                {imgSrcs.map((src, idx) => src ? (
                  <div key={idx} style={{position:'relative',borderRadius:10,overflow:'hidden',border:'1px solid var(--border)'}}>
                    <img src={src} style={{width:'100%',height:90,objectFit:'cover',display:'block'}} alt="" />
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:4,background:'rgba(0,0,0,0.35)',opacity:0,transition:'.15s'}}
                      onMouseEnter={e => e.currentTarget.style.opacity=1}
                      onMouseLeave={e => e.currentTarget.style.opacity=0}>
                      <button onClick={() => setImgSrcs(prev => { const n=[...prev]; if(idx>0){[n[idx-1],n[idx]]=[n[idx],n[idx-1]]}; return n })}
                        style={{background:'rgba(255,255,255,0.85)',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:12}}>←</button>
                      <button onClick={() => setImgSrcs(prev => prev.filter((_,i) => i !== idx))}
                        style={{background:'rgba(220,38,38,0.9)',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:12,color:'#fff'}}>✕</button>
                      <button onClick={() => setImgSrcs(prev => { const n=[...prev]; if(idx<n.length-1){[n[idx],n[idx+1]]=[n[idx+1],n[idx]]}; return n })}
                        style={{background:'rgba(255,255,255,0.85)',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:12}}>→</button>
                    </div>
                    <div style={{position:'absolute',top:4,left:4,background:'rgba(0,0,0,0.6)',color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:4}}>{idx+1}</div>
                  </div>
                ) : null)}
              </div>
            )}
            <div style={{display:'flex',gap:8}}>
              <label className="nf-cdrop" htmlFor="pdf-upload" style={{...cDrop,flex:1,padding:'11px 14px'}}>
                <input id="pdf-upload" type="file" accept=".pdf" style={{display:'none'}} onChange={handlePDF} />
                📄 PDF hochladen <span style={{color:'var(--text-faint)'}}>(automatisch ausfüllen)</span>
              </label>
              <button className="nf-cb" onClick={resetForm} style={{background:'#ef44441a',border:'1px solid #ef444455',color:'#ef4444',borderRadius:12,padding:'0 16px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>↺ Reset</button>
            </div>
            {parseStatus && (
              <div style={{fontSize:12,padding:'8px 12px',borderRadius:8,...(parseStatus.type==='ok'?{background:'#22c55e1a',border:'1px solid #22c55e55',color:'#22c55e'}:parseStatus.type==='err'?{background:'#ef44441a',border:'1px solid #ef444455',color:'#ef4444'}:{background:'#f59e0b1a',border:'1px solid #f59e0b55',color:'#f59e0b'})}}>{parseStatus.msg}</div>
            )}
          </div>
        </CCard>

        <CCard t="Angebotsdaten">
          <div key={formKey} style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={cLbl}>Angebotsnummer</label><input className="nf-cin" style={cIn} defaultValue={fRef.current.num} onChange={e => updText('num', e.target.value)} placeholder="NF-1001" /></div>
              <div><label style={cLbl}>Projekt / Kundenname</label><input className="nf-cin" style={cIn} defaultValue={fRef.current.project} onChange={e => updText('project', e.target.value)} placeholder="z.B. Max Mustermann" /></div>
            </div>
            <div><label style={cLbl}>Kunden-E-Mail</label><input className="nf-cin" type="email" style={{...cIn,borderColor:C_NEON+'55',background:C_NEON+'0d'}} defaultValue={fRef.current.customerEmail} onChange={e => updText('customerEmail', e.target.value)} placeholder="kunde@email.de" /></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={cLbl}>Breite (cm)</label><input className="nf-cin" type="number" style={cIn} defaultValue={fRef.current.w} onChange={e => updText('w', e.target.value)} /></div>
              <div><label style={cLbl}>Höhe (cm)</label><input className="nf-cin" type="number" style={cIn} defaultValue={fRef.current.h} onChange={e => updText('h', e.target.value)} /></div>
            </div>
            <div>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
                <input type="checkbox" checked={selects.sizeWarningEnabled} onChange={e => updSelect('sizeWarningEnabled', e.target.checked)} style={{accentColor:C_NEON,width:16,height:16}} />
                <span style={{...cLbl,marginBottom:0}}>Mindestgröße-Hinweis anzeigen</span>
              </label>
              {selects.sizeWarningEnabled && (
                <textarea className="nf-cin" style={{...cIn,minHeight:84,marginTop:8,resize:'vertical',lineHeight:1.5}} defaultValue={fRef.current.sizeWarningText} onChange={e => updText('sizeWarningText', e.target.value)} placeholder="Warntext für den Kunden..." />
              )}
            </div>
          </div>
        </CCard>

        <CCard t="Farben" sub="klick zum Auswählen">
          <div key={formKey} style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {COLOR_OPTIONS.map(c => {
                const act = fRef.current.color.split(',').map(s => s.trim().toLowerCase()).includes(c.toLowerCase())
                return (
                  <button key={c} type="button" onClick={() => toggleColor(c)} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 11px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',border:`1px solid ${act ? colorDot(c) : 'var(--border)'}`,background:act ? colorDot(c)+'22' : 'var(--input-bg)',color:'var(--text)',boxShadow:act ? `0 0 10px ${colorDot(c)}66` : 'none'}}>
                    <span style={{width:9,height:9,borderRadius:'50%',background:colorDot(c)}} />{c}
                  </button>
                )
              })}
            </div>
            <input className="nf-cin" style={cIn} defaultValue={fRef.current.color} onChange={e => updText('color', e.target.value)} placeholder="oder selbst eintippen, kommagetrennt – z.B. Soft Orange, Pink" />
          </div>
        </CCard>

        <CCard t="Konfiguration">
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <CSeg label="Rückwandform" value={selects.backplate} opts={BACKPLATE_OPTIONS} onChange={v => updSelect('backplate', v)} />
            <CSeg label="Rückwandfarbe" value={selects.backplate_color} opts={BACKPLATE_COLOR_OPTIONS} onChange={v => updSelect('backplate_color', v)} />
            <CSeg label="Verwendungszweck" value={selects.usage} opts={USAGE_OPTIONS} onChange={v => updSelect('usage', v)} />
          </div>
        </CCard>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}>
          <CCard t="Preiskalkulation">
            <div key={formKey} style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><label style={cLbl}>Listenpreis (netto)</label><input className="nf-cin" type="number" step="0.01" style={cIn} defaultValue={priceInputs.basePrice} onChange={e => updPriceField('basePrice', e.target.value)} onBlur={e => updPrice('basePrice', e.target.value)} placeholder="0.00" /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <CSeg label="Rabatt-Typ" value={selects.discType} opts={[{value:'pct',label:'Prozent %'},{value:'eur',label:'Euro €'}]} onChange={v => updSelect('discType', v)} />
                <div><label style={cLbl}>{`Rabatt (${selects.discType==='pct'?'%':'€'})`}</label><input className="nf-cin" type="number" step="0.01" style={cIn} value={priceInputs.discVal} onChange={e => updPrice('discVal', e.target.value)} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div><label style={cLbl}>MwSt. (%)</label><input className="nf-cin" type="number" step="0.1" style={cIn} value={priceInputs.vat} onChange={e => updPrice('vat', e.target.value)} /></div>
                <div><label style={cLbl}>Lieferdatum</label><input className="nf-cin" style={cIn} defaultValue={fRef.current.delivery} onChange={e => updText('delivery', e.target.value)} placeholder="27. Mai – 3. Juni" /></div>
              </div>
              <div style={{background:`linear-gradient(135deg,${C_NEON}14,transparent)`,border:`1px solid ${C_NEON}44`,borderRadius:14,padding:14,display:'grid',gridTemplateColumns:'1fr 1fr 1.2fr',gap:10,alignItems:'end'}}>
                <div><div style={{...cLbl,marginBottom:3}}>Netto</div><div style={{fontSize:15,fontWeight:800}}>{prices.net > 0 ? `€ ${prices.net.toFixed(2)}` : '–'}</div></div>
                <div><div style={{...cLbl,marginBottom:3}}>+ MwSt.</div><div style={{fontSize:15,fontWeight:800}}>{prices.vatAmt > 0 ? `€ ${prices.vatAmt.toFixed(2)}` : '–'}</div></div>
                <div style={{textAlign:'right'}}><div style={{...cLbl,marginBottom:3,color:C_NEON}}>Endpreis</div><div style={{fontSize:22,fontWeight:900,color:C_NEON,textShadow:`0 0 12px ${C_NEON}66`}}>{prices.total > 0 ? `€ ${prices.total.toFixed(2)}` : '–'}</div></div>
              </div>
            </div>
          </CCard>

          <CCard t="Weitere Einstellungen">
            <div key={formKey} style={{display:'flex',flexDirection:'column',gap:12}}>
              <CSeg label="Status" value={selects.status} opts={STATUS_OPTIONS} onChange={v => updSelect('status', v)} />
              <div><label style={cLbl}>Checkout-URL (Shopify Draft Order Link)</label><input className="nf-cin" style={cIn} defaultValue={fRef.current.url} onChange={e => updText('url', e.target.value)} placeholder="https..." /></div>
              <div><label style={cLbl}>Notizen für den Kunden</label><textarea className="nf-cin" style={{...cIn,minHeight:84,resize:'vertical',lineHeight:1.5}} defaultValue={fRef.current.customerNote} onChange={e => updText('customerNote', e.target.value)} placeholder="z.B. Bitte überprüfen Sie die Maße nochmals..." /></div>
            </div>
          </CCard>
        </div>

        <CCard>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{fontSize:12,color:'var(--text-muted)'}}>✉️ Beim Veröffentlichen wird automatisch eine E-Mail an den Kunden gesendet.</div>
            <div style={{display:'flex',gap:10}}>
              <button
                className="nf-cb"
                style={{flex:1,background:'transparent',border:`1px solid ${C_NEON}`,color:C_NEON,borderRadius:12,padding:14,fontSize:14,fontWeight:800,fontFamily:'inherit',opacity: previewLoading ? 0.7 : 1, cursor: previewLoading ? 'not-allowed' : 'pointer'}}
                disabled={previewLoading}
                onClick={async () => {
                  setPreviewLoading(true)
                  const f = { ...fRef.current, ...selects, ...priceInputs }
                  try {
                    const uploadedImgs = [...imgSrcs]
                    for (let i = 0; i < 3; i++) {
                      if (imgSrcs[i] && imgSrcs[i].startsWith('data')) {
                        const blob = await (await fetch(imgSrcs[i])).blob()
                        const fd = new FormData(); fd.append('file', blob, `offer-prev-${Date.now()}-${i}.jpg`); fd.append('offerId', f.num || 'preview')
                        const up = await fetch('/api/upload', { method: 'POST', body: fd })
                        const upData = await up.json()
                        if (upData.url) uploadedImgs[i] = upData.url
                      }
                    }
                    const payload = {
                      offer_num: f.num, project: f.project,
                      width: f.w, height: f.h,
                      backplate: f.backplate, backplate_color: f.backplate_color, usage: f.usage,
                      colors: f.color,
                      base_price: parseFloat(f.basePrice) || 0, disc_type: f.discType,
                      disc_val: parseFloat(f.discVal) || 0, vat_pct: parseFloat(f.vat) || 19,
                      net_price: prices.net, final_price: prices.total, rrp_price: prices.rrp,
                      delivery: f.delivery, checkout_url: f.url,
                      customer_note: f.customerNote || null, customer_email: f.customerEmail || null,
                      valid_until: f.validUntil || null, status: f.status || 'offer_sent',
                      size_warning_enabled: f.sizeWarningEnabled || false, size_warning_text: f.sizeWarningText || null,
                      preview_image: uploadedImgs[0], preview_image_2: uploadedImgs[1], preview_image_3: uploadedImgs[2],
                      published: false,
                    }
                    let offerId = previewOfferId
                    if (offerId) {
                      await fetch(`/api/offers?id=${previewOfferDbId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                    } else {
                      const res = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                      const data = await res.json()
                      if (data.error) throw new Error(data.error)
                      offerId = data.custom_id || data.id
                      setPreviewOfferId(offerId)
                      setPreviewOfferDbId(data.id)
                    }
                    setShowPreviewModal(`${window.location.origin}/angebot/${offerId}`)
                  } catch (err) { alert('Vorschau-Fehler: ' + err.message) }
                  finally { setPreviewLoading(false) }
                }}
              >
                {previewLoading ? '⏳ Vorschau wird erstellt...' : '👁 Vorschau öffnen'}
              </button>
              <button className="nf-cb" onClick={publish} disabled={publishing} style={{flex:1.4,background:C_NEON,border:'none',color:'#0a0a0a',borderRadius:12,padding:14,fontSize:14,fontWeight:900,cursor:publishing?'not-allowed':'pointer',fontFamily:'inherit',opacity:publishing?0.7:1}}>
                {publishing ? '⏳ Wird veröffentlicht...' : '🚀 Angebotsseite veröffentlichen'}
              </button>
            </div>
            {publishedLink && (
              <div style={{background:'var(--input-bg)',border:'1px solid #22c55e55',borderRadius:10,padding:10,display:'flex',alignItems:'center',gap:8}}>
                <input value={publishedLink} readOnly style={{flex:1,background:'transparent',border:'none',fontSize:12,color:'#22c55e',outline:'none',fontFamily:'monospace'}} />
                <button onClick={() => navigator.clipboard.writeText(publishedLink)} style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'5px 10px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Kopieren</button>
              </div>
            )}
          </div>
        </CCard>
      </div>
    </div>
  )

  if (tab === 'manage_old') return (
    <div className="nf-admin" data-theme={theme} style={S.app}>
      <ThemeVars />
      {editingOffer && (
        <EditModal
          offer={editingOffer}
          onClose={() => setEditingOffer(null)}
          onSaved={() => { setEditingOffer(null); loadOffers() }}
        />
      )}
      <div style={S.topbar}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div onClick={() => setTab('home')} title="Zur Startseite" style={{background:'#0a0a0a',padding:'6px 10px',borderRadius:8,cursor:'pointer'}}><img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NF" style={{height:24,display:'block'}} /></div>
          <div style={S.tabs}>
            <button style={S.tab(false)} onClick={() => setTab('create')}>Erstellen</button>
            <button style={{...S.tab(true), position:'relative'}}>
              Verwalten
              {(() => { const n = offers.filter(o => { const d = Math.floor((Date.now() - new Date(o.created_at).getTime())/(1000*60*60*24)); return d >= 3 && o.status !== 'recontacted' && o.status !== 'confirmed' }).length; return n > 0 ? <span style={{position:'absolute',top:-6,right:-8,background:'#dc2626',color:'#fff',borderRadius:'50%',minWidth:18,height:18,fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',lineHeight:1}}>{n}</span> : null })()}
            </button>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button style={S.btnOutline} onClick={() => setAuthed(false)}>Abmelden</button>
        </div>
      </div>
      <div style={{padding:32,overflowY:'auto',flex:1,background:'var(--bg-alt)'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <h2 style={{fontSize:20,fontWeight:700,color:'var(--text)'}}>Alle Angebote {offers.length > 0 && <span style={{fontSize:14,fontWeight:500,color:'var(--text-faint)'}}>({offers.length})</span>}</h2>
            <button style={S.btnDark} onClick={loadOffers}>Aktualisieren</button>
          </div>
          <div style={{display:'flex',gap:10,marginBottom:20}}>
            <input
              placeholder="Nach Name oder Angebots-ID suchen..."
              onChange={e => setManageSearch(e.target.value)}
              style={{flex:1,background:'var(--panel)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 14px',fontSize:13,fontFamily:'inherit',outline:'none',color:'var(--text)'}}
            />
            <select
              onChange={e => setManageStatus(e.target.value)}
              style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:8,padding:'9px 14px',fontSize:13,fontFamily:'inherit',outline:'none',color:'var(--text)',cursor:'pointer'}}
            >
              <option value="">Alle Status</option>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {loadingOffers ? <div style={{textAlign:'center',padding:60,color:'var(--text-faint)',fontSize:14}}>Wird geladen...</div>
           : offers.length === 0 ? <div style={{textAlign:'center',padding:60,color:'var(--text-faint)',fontSize:14}}>Noch keine Angebote.</div>
           : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {offers.filter(o => {
                const q = manageSearch.toLowerCase()
                const matchSearch = !q || (o.project && o.project.toLowerCase().includes(q)) || (o.custom_id && String(o.custom_id).includes(q)) || (o.offer_num && o.offer_num.toLowerCase().includes(q))
                const matchStatus = !manageStatus || o.status === manageStatus
                return matchSearch && matchStatus
              }).map(o => {
                const id = o.custom_id || o.id.slice(0,8)
                const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/angebot/${o.custom_id || o.id}`
                const daysDiff = Math.floor((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24))
                const isRed = daysDiff >= 3 && o.status !== 'recontacted' && o.status !== 'confirmed'
                return (
<div key={o.id} style={{background:'var(--panel)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',display:'grid',gridTemplateColumns:'1fr 220px 200px'}}>
<div style={{padding:'20px 22px',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',justifyContent:'center',gap:14}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                        <span style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>#{id}</span>
                        <span style={{fontSize:15,color:'var(--text-muted)'}}>{o.project}</span>
                        <span style={{fontSize:11,fontWeight:500,padding:'3px 10px',borderRadius:20,background:o.published?'#f0fdf4':'#f3f4f6',color:o.published?'#166534':'#6b7280',border:`1px solid ${o.published?'#bbf7d0':'#e5e7eb'}`}}>{o.published?'Aktiv':'Inaktiv'}</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                        {o.created_at && <span style={{fontSize:12,color:isRed?'#dc2626':'#9ca3af',fontWeight:isRed?700:400}}>📅 {new Date(o.created_at).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}</span>}
                        <span
                          onClick={async () => {
                            if (!o.customer_email) { alert('Keine E-Mail hinterlegt. Bitte im Bearbeiten-Menü ergänzen.'); return }
                            if (!confirm(`Erinnerungs-E-Mail an ${o.customer_email} senden?`)) return
                            try {
                              const offerLink = `${window.location.origin}/angebot/${o.custom_id || o.id}`
                              const res = await fetch('/api/recontact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerId: o.id, customerEmail: o.customer_email, customerName: o.project, offerLink, price: o.final_price, width: o.width, height: o.height, colors: o.colors }) })
                              const data = await res.json()
                              if (data.success) { alert('✅ E-Mail gesendet & Status aktualisiert!'); loadOffers() } else { alert('Fehler: ' + data.error) }
                            } catch (err) { alert('Fehler: ' + err.message) }
                          }}
                          title={o.customer_email || 'Keine E-Mail hinterlegt'}
                          style={{display:'inline-flex',alignItems:'center',gap:5,background:isRed?'#fef2f2':'#f3f4f6',border:`1px solid ${isRed?'#fecaca':'#e5e7eb'}`,color:isRed?'#dc2626':'#9ca3af',fontSize:11,fontWeight:700,padding:'4px 12px',borderRadius:20,whiteSpace:'nowrap',cursor:'pointer',userSelect:'none'}}
                        >↩ Erneut kontaktieren</span>
                      </div>
                      {o.published && (
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:11,color:'var(--text-faint)',fontFamily:'monospace'}}>{link}</span>
                          <button onClick={() => navigator.clipboard.writeText(link)} style={{...S.btnOutline,padding:'4px 10px',fontSize:11}}>Kopieren</button>
                          <a href={link} target="_blank" rel="noopener" style={{...S.btnOutline,padding:'4px 10px',fontSize:11,textDecoration:'none',display:'inline-block'}}>Öffnen</a>
                        </div>
                      )}
                    </div>
                    <div style={{padding:'16px 18px',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:8,justifyContent:'center'}}>
                      <span style={{fontSize:10,fontWeight:600,color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'.06em'}}>Preis</span>
                      <span style={{fontSize:20,fontWeight:700,color:'var(--text)'}}>{o.final_price > 0 ? `€ ${parseFloat(o.final_price).toFixed(2)}` : '–'}</span>
                      <span style={{fontSize:10,fontWeight:600,color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'.06em'}}>Status</span>
                      <select
                        value={o.status || 'offer_sent'}
                        onChange={e => updateStatus(o.id, e.target.value)}style={{fontSize:12,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--input-bg)',color:'var(--text)',cursor:'pointer',fontFamily:'inherit',width:'100%'}}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div style={{padding:'16px 18px',display:'flex',flexDirection:'column',gap:8,justifyContent:'center'}}>
                      <button onClick={() => setEditingOffer(o)} style={{background:'#eff6ff',border:'1px solid #bfdbfe',color:'#2563eb',borderRadius:8,padding:'9px 14px',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✏️ Bearbeiten</button>
                      {o.status === 'confirmed' && (
                        <button onClick={async () => {
                          if (!o.customer_email) { alert('Keine E-Mail hinterlegt.'); return }
                          if (!confirm(`Bewertungsanfrage an ${o.customer_email} senden?`)) return
                          try {
                            const res = await fetch('/api/review-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerEmail: o.customer_email, customerName: o.project }) })
                            const data = await res.json()
                            if (data.success) { alert('✅ Bewertungsanfrage gesendet!') } else { alert('Fehler: ' + data.error) }
                          } catch (err) { alert('Fehler: ' + err.message) }
                        }} style={{background:'#fefce8',border:'1px solid #fde68a',color:'#92400e',borderRadius:8,padding:'9px 14px',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>⭐ Bewertung anfragen</button>
                      )}
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
    <div className="nf-admin" data-theme={theme} style={S.app}>
      <ThemeVars />
      {showPreviewModal && showPreviewModal !== null && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',flexDirection:'column'}}>
          <div style={{background:'var(--panel)',borderBottom:'1px solid var(--border)',padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <span style={{fontWeight:700,fontSize:15,color:'var(--text)'}}>👁 Vorschau</span>
            <div style={{display:'flex',gap:10}}>
              <button onClick={() => setShowPreviewModal(null)} style={{background:'transparent',border:'1px solid var(--border)',color:'var(--text)',borderRadius:8,padding:'8px 16px',fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>✕ Schließen</button>
              <button onClick={() => { setShowPreviewModal(null); publish() }} style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:8,padding:'8px 20px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>🚀 Jetzt veröffentlichen</button>
            </div>
          </div>
          <iframe src={showPreviewModal} style={{flex:1,border:'none',width:'100%',background:'#fff'}} title="Vorschau" />
        </div>
      )}
      <div style={S.topbar}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div onClick={() => setTab('home')} title="Zur Startseite" style={{background:'#0a0a0a',padding:'6px 10px',borderRadius:8,cursor:'pointer'}}><img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NF" style={{height:24,display:'block'}} /></div>
          <div style={S.tabs}>
            <button style={S.tab(true)}>Erstellen</button>
            <button style={{...S.tab(false), position:'relative'}} onClick={() => setTab('manage')}>
              Verwalten
              {(() => { const n = offers.filter(o => { const d = Math.floor((Date.now() - new Date(o.created_at).getTime())/(1000*60*60*24)); return d >= 3 && o.status !== 'recontacted' && o.status !== 'confirmed' }).length; return n > 0 ? <span style={{position:'absolute',top:-6,right:-8,background:'#dc2626',color:'#fff',borderRadius:'50%',minWidth:18,height:18,fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',lineHeight:1}}>{n}</span> : null })()}
            </button>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button style={S.btnOutline} onClick={() => setAuthed(false)}>Abmelden</button>
        </div>
      </div>

<div style={S.main}>
        <div style={S.left}>
          <div style={S.section}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div style={S.sTitle}>Dateien hochladen</div>
              <button onClick={resetForm} style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',borderRadius:8,padding:'4px 12px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>↺ Reset</button>
            </div>
<div style={{marginBottom:8}}>
              <label style={{...S.uploadZone, flexDirection:'row', padding:'12px 16px', justifyContent:'center', gap:10, cursor:'pointer'}} htmlFor="multi-img-upload">
                <input id="multi-img-upload" type="file" accept="image/*" multiple style={{display:'none'}} onChange={e => {
                  const files = Array.from(e.target.files)
                  Promise.all(files.map(file => compressImage(file)))
                    .then(compressed => setImgSrcs(prev => [...prev, ...compressed]))
                    .catch(err => alert('Bild konnte nicht verarbeitet werden: ' + err.message))
                  e.target.value = ''
                }} />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span style={{fontSize:13,color:'var(--text-faint)'}}>Bilder hochladen (max. 3 möglich)</span>
              </label>
            </div>
            {imgSrcs.filter(Boolean).length > 0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:8,marginBottom:8}}>
                {imgSrcs.map((src, idx) => src ? (
                  <div key={idx} style={{position:'relative',borderRadius:8,overflow:'hidden',border:'1px solid #e5e7eb'}}>
                    <img src={src} style={{width:'100%',height:80,objectFit:'cover',display:'block'}} alt="" />
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px',background:'rgba(0,0,0,0.3)',opacity:0,transition:'.15s'}}
                      onMouseEnter={e => e.currentTarget.style.opacity=1}
                      onMouseLeave={e => e.currentTarget.style.opacity=0}>
                      <button onClick={() => setImgSrcs(prev => { const n=[...prev]; if(idx>0){[n[idx-1],n[idx]]=[n[idx],n[idx-1]]}; return n })}
                        style={{background:'rgba(255,255,255,0.8)',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:12}}>←</button>
                      <button onClick={() => setImgSrcs(prev => prev.filter((_,i) => i !== idx))}
                        style={{background:'rgba(220,38,38,0.8)',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:12,color:'#fff'}}>✕</button>
                      <button onClick={() => setImgSrcs(prev => { const n=[...prev]; if(idx<n.length-1){[n[idx],n[idx+1]]=[n[idx+1],n[idx]]}; return n })}
                        style={{background:'rgba(255,255,255,0.8)',border:'none',borderRadius:4,padding:'2px 6px',cursor:'pointer',fontSize:12}}>→</button>
                    </div>
                    <div style={{position:'absolute',top:2,left:2,background:'rgba(0,0,0,0.5)',color:'#fff',fontSize:9,padding:'1px 4px',borderRadius:3}}>{idx+1}</div>
                  </div>
                ) : null)}
              </div>
            )}
            <label style={{...S.uploadZone,marginTop:8,flexDirection:'row',padding:'10px 14px',justifyContent:'flex-start',gap:10}} htmlFor="pdf-upload">
              <input id="pdf-upload" type="file" accept=".pdf" style={{display:'none'}} onChange={handlePDF} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{fontSize:12,color:'var(--text-faint)'}}>PDF hochladen (automatisch ausfüllen)</span>
            </label>
            {parseStatus && <div style={S.status(parseStatus.type)}>{parseStatus.msg}</div>}
          </div>

          <div style={S.section}>
            <div style={S.sTitle}>Angebotsdaten</div>
            <div key={formKey} style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Angebotsnummer">
                <input style={S.input} defaultValue={fRef.current.num} onChange={e => updText('num', e.target.value)} placeholder="NF-1001" />
              </Field>
              <Field label="Projekt / Kundenname">
                <input style={S.input} defaultValue={fRef.current.project} onChange={e => updText('project', e.target.value)} placeholder="z.B. Max Mustermann" />
              </Field>
              <Field label="Kunden-E-Mail">
                <input style={{...S.input, borderColor: 'var(--email-border)', background: 'var(--email-bg)'}} type="email" defaultValue={fRef.current.customerEmail} onChange={e => updText('customerEmail', e.target.value)} placeholder="kunde@email.de" />
              </Field>
              <div style={S.row2}>
                <Field label="Breite (cm)"><input style={S.input} type="number" defaultValue={fRef.current.w} onChange={e => updText('w', e.target.value)} /></Field>
                <Field label="Höhe (cm)"><input style={S.input} type="number" defaultValue={fRef.current.h} onChange={e => updText('h', e.target.value)} /></Field>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: selects.sizeWarningEnabled ? 8 : 0 }}>
                  <input type="checkbox" checked={selects.sizeWarningEnabled} onChange={e => updSelect('sizeWarningEnabled', e.target.checked)} />
                  <span style={S.label}>Mindestgröße-Hinweis anzeigen</span>
                </label>
                {selects.sizeWarningEnabled && (
                  <textarea style={{...S.input, minHeight: 90, resize: 'vertical', lineHeight: 1.5, paddingTop: 9}} defaultValue={fRef.current.sizeWarningText} onChange={e => updText('sizeWarningText', e.target.value)} placeholder="Warntext für den Kunden..." />
                )}
              </div>
              <Field label="Farbe(n) – kommagetrennt">
                <div
                  style={{position:'relative'}}
                  onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setColorDropdownOpen(false) }}
                >
                  <input
                    style={{...S.input, paddingRight: 96}}
                    defaultValue={fRef.current.color}
                    onChange={e => updText('color', e.target.value)}
                    onFocus={() => setColorDropdownOpen(true)}
                    placeholder="z.B. Soft Orange, Pink"
                  />
                  <button type="button" onClick={() => setColorDropdownOpen(o => !o)} style={{position:'absolute',right:6,top:6,bottom:6,background:'#fff',border:'1px solid #e5e7eb',borderRadius:6,padding:'0 10px',fontSize:11,fontWeight:600,color:'#374151',cursor:'pointer',fontFamily:'inherit'}}>Farbe wählen ▾</button>
                  {colorDropdownOpen && (
                    <div style={{position:'absolute',top:'100%',left:0,right:0,marginTop:4,background:'var(--panel)',border:'1px solid var(--border)',borderRadius:8,padding:6,zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,.1)',display:'flex',flexDirection:'column',gap:2,maxHeight:240,overflowY:'auto'}}>
                      {COLOR_OPTIONS.map(c => {
                        const active = fRef.current.color.split(',').map(s => s.trim().toLowerCase()).includes(c.toLowerCase())
                        return (
                          <label key={c} tabIndex={-1} style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer',padding:'6px 8px',borderRadius:6,background:active?'#f0fdf4':'transparent'}}>
                            <input type="checkbox" checked={active} onChange={() => toggleColor(c)} style={{cursor:'pointer'}} />
                            <span style={{width:9,height:9,borderRadius:'50%',background:colorDot(c),display:'inline-block',border:'1px solid rgba(0,0,0,.08)'}}></span>
                            {c}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </Field>
            </div>
          </div>

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

          <div style={S.section}>
            <div style={S.sTitle}>Preiskalkulation</div>
            <div key={formKey} style={{display:'flex',flexDirection:'column',gap:10}}>
<Field label="Listenpreis (netto)">
                <input style={S.input} type="number" step="0.01" defaultValue={priceInputs.basePrice} onChange={e => updPriceField('basePrice', e.target.value)} onBlur={e => updPrice('basePrice', e.target.value)} placeholder="0.00" />
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
                <Field label="Lieferdatum">
                  <input style={S.input} defaultValue={fRef.current.delivery} onChange={e => updText('delivery', e.target.value)} placeholder="27. Mai – 3. Juni" />
                </Field>
              </div>
              <div style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                {[['Netto',prices.net>0?`€ ${prices.net.toFixed(2)}`:'–',false],['+ MwSt.',prices.vatAmt>0?`€ ${prices.vatAmt.toFixed(2)}`:'–',false],['Endpreis',prices.total>0?`€ ${prices.total.toFixed(2)}`:'–',true]].map(([l,v,a]) => (
                  <div key={l}><div style={{fontSize:10,color:a?'#16a34a':'#9ca3af',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>{l}</div><div style={{fontSize:14,fontWeight:700,color:a?'#16a34a':'#111'}}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>

          <div style={S.section}>
            <div style={S.sTitle}>Weitere Einstellungen</div>
            <div key={formKey} style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Status">
                <select style={S.select} value={selects.status} onChange={e => updSelect('status', e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Checkout-URL (Shopify Draft Order Link)">
                <input style={S.input} defaultValue={fRef.current.url} onChange={e => updText('url', e.target.value)} placeholder="https..." />
              </Field>
              <Field label="Notizen für den Kunden">
                <textarea style={{...S.input, minHeight: 80, resize: 'vertical', lineHeight: 1.5, paddingTop: 9}} defaultValue={fRef.current.customerNote} onChange={e => updText('customerNote', e.target.value)} placeholder="z.B. Bitte überprüfen Sie die Maße nochmals..." />
              </Field>
            </div>
          </div>

<div style={S.publishArea}>
            <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#166534',lineHeight:1.5}}>
              ✅ Beim Veröffentlichen wird automatisch<br/>
              • Eine E-Mail an den Kunden gesendet
            </div>
            <button
style={{...S.btnGreen, background:'#1d4ed8', marginBottom:8, opacity: previewLoading ? 0.7 : 1, cursor: previewLoading ? 'not-allowed' : 'pointer'}}
              disabled={previewLoading}
onClick={async () => {
  setPreviewLoading(true)
  const f = { ...fRef.current, ...selects, ...priceInputs }
  try {
    const uploadedImgs = [...imgSrcs]
    for (let i = 0; i < 3; i++) {
      if (imgSrcs[i] && imgSrcs[i].startsWith('data')) {
        const blob = await (await fetch(imgSrcs[i])).blob()
        const fd = new FormData(); fd.append('file', blob, `offer-prev-${Date.now()}-${i}.jpg`); fd.append('offerId', f.num || 'preview')
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        const upData = await up.json()
        if (upData.url) uploadedImgs[i] = upData.url
      }
    }
    const payload = {
      offer_num: f.num, project: f.project,
      width: f.w, height: f.h,
      backplate: f.backplate, backplate_color: f.backplate_color, usage: f.usage,
      colors: f.color,
      base_price: parseFloat(f.basePrice) || 0, disc_type: f.discType,
      disc_val: parseFloat(f.discVal) || 0, vat_pct: parseFloat(f.vat) || 19,
      net_price: prices.net, final_price: prices.total, rrp_price: prices.rrp,
      delivery: f.delivery, checkout_url: f.url,
      customer_note: f.customerNote || null, customer_email: f.customerEmail || null,
      valid_until: f.validUntil || null, status: f.status || 'offer_sent',
      size_warning_enabled: f.sizeWarningEnabled || false, size_warning_text: f.sizeWarningText || null,
      preview_image: uploadedImgs[0], preview_image_2: uploadedImgs[1], preview_image_3: uploadedImgs[2],
      published: false,
    }
let offerId = previewOfferId
    if (offerId) {
      await fetch(`/api/offers?id=${previewOfferDbId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } else {
      const res = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      offerId = data.custom_id || data.id
      setPreviewOfferId(offerId)
      setPreviewOfferDbId(data.id)
    }
setShowPreviewModal(`${window.location.origin}/angebot/${offerId}`)
  } catch (err) { alert('Vorschau-Fehler: ' + err.message) }
  finally { setPreviewLoading(false) }
}}
            >
              {previewLoading ? '⏳ Vorschau wird erstellt...' : '👁 Vorschau öffnen'}
            </button>
            <button style={S.btnGreen} onClick={publish} disabled={publishing}>{publishing?'⏳ Wird veröffentlicht...':'Angebotsseite veröffentlichen'}</button>
            {publishedLink && (
              <div style={S.linkBox}>
                <input value={publishedLink} readOnly style={{flex:1,background:'transparent',border:'none',fontSize:12,color:'#16a34a',outline:'none',fontFamily:'monospace'}} />
                <button onClick={() => navigator.clipboard.writeText(publishedLink)} style={{...S.btnOutline,padding:'4px 10px',fontSize:11,flexShrink:0}}>Kopieren</button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
