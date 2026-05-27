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
  const num = get([/Angebots(nummer|nr\.?|#)[\s•#]+([A-Z0-9-]{3,20})/i])
  const project = get([/(Projekt|Project)[\s•]+([^\n•]{2,60})(\s[•\n]|$)/i, /(Kunde|für)[\s]+([^\n]{2,50})/i])
  let w = '', h = ''
  for (const p of [/(\d+)\s[xX×]\s(\d+)\scm/, /Abmessungen[^\d]*(\d+)\s[xX×]\s(\d+)/i]) { const m = txt.match(p); if (m) { w = m[1]; h = m[2]; break } }
  const colors = get([/Farbe[n]?\s[(\w)a-z]\s[•-]\s([^\n•]{2,60})(\s(Gesamt|MwSt|\n))/i])
  let price = ''
  for (const p of [/Gesamt[^€\d]*€\s([\d.,]+)/i, /€\s([\d.,]+)\s(netto|zzgl)/i, /(\d{2,6}[.,]\d{2})\s€/]) { const m = txt.match(p); if (m) { price = m[1].replace(',', '.'); break } }
  return { num, project, w, h, colors, price }
}

const BACKPLATE_OPTIONS = ['Ausgeschnitten', 'Quadratisch', 'Ohne']
const BACKPLATE_COLOR_OPTIONS = ['Transparent', 'Schwarz', 'Weiß']
const USAGE_OPTIONS = ['Innen', 'Außen IP65']

// Payment icons as simple SVG/styled divs matching the screenshot exactly
const PAYMENT_ICONS_HTML = `
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
  <!-- PayPal -->
  <div style="background:#003087;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <svg width="36" height="20" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg"><text x="4" y="22" font-size="16" font-weight="800" font-family="Arial,sans-serif" fill="#009cde">P</text><text x="14" y="22" font-size="16" font-weight="800" font-family="Arial,sans-serif" fill="#012169">ay</text><text x="28" y="22" font-size="16" font-weight="800" font-family="Arial,sans-serif" fill="#009cde">Pa</text></svg>
  </div>
  <!-- Klarna -->
  <div style="background:#ffb3c7;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <span style="font-weight:900;font-size:11px;color:#17120e;font-family:Arial,sans-serif;letter-spacing:-0.5px">klarna</span>
  </div>
  <!-- Visa -->
  <div style="background:#1a1f71;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <span style="font-weight:900;font-size:16px;color:#fff;font-family:Arial,sans-serif;font-style:italic;letter-spacing:-1px">VISA</span>
  </div>
  <!-- Mastercard -->
  <div style="background:#fff;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <svg width="36" height="22" viewBox="0 0 36 22"><circle cx="13" cy="11" r="10" fill="#eb001b"/><circle cx="23" cy="11" r="10" fill="#f79e1b"/><path d="M18 4a10 10 0 0 1 0 14A10 10 0 0 1 18 4z" fill="#ff5f00"/></svg>
  </div>
  <!-- Apple Pay -->
  <div style="background:#000;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #333">
    <svg width="38" height="16" viewBox="0 0 60 26" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 5.2c-.8 1-2.1 1.7-3.3 1.6-.2-1.3.5-2.6 1.2-3.4C10.2 2.5 11.6 1.8 12.7 1.8c.1 1.3-.4 2.5-1.2 3.4zM12.7 7c-1.8-.1-3.4 1-4.2 1s-2.2-1-3.6-1C2.9 7 1 8.5.3 10.7c-1.4 2.5.4 7.8 1.9 10.4.7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7s1.7.7 2.9.7c1.2 0 2-1.1 2.7-2.2.8-1.3 1.2-2.6 1.2-2.6s-2.3-.9-2.3-3.5c0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.7-1.7-3.2-1.7h-.1z" fill="white"/><text x="18" y="19" font-size="13" font-weight="500" font-family="-apple-system,BlinkMacSystemFont,sans-serif" fill="white"> Pay</text></svg>
  </div>
  <!-- Google Pay -->
  <div style="background:#fff;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <svg width="40" height="16" viewBox="0 0 60 22" xmlns="http://www.w3.org/2000/svg"><text x="0" y="16" font-size="12" font-family="Arial,sans-serif" font-weight="500"><tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan fill="#FBBC05">o</tspan><tspan fill="#4285F4">g</tspan><tspan fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan></text><text x="38" y="16" font-size="12" font-family="Arial,sans-serif" font-weight="500" fill="#5f6368"> Pay</text></svg>
  </div>
  <!-- Amex -->
  <div style="background:#007bc1;border-radius:6px;width:52px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb">
    <span style="font-weight:900;font-size:8px;color:#fff;font-family:Arial,sans-serif;letter-spacing:0.2px;text-align:center;line-height:1.2">AMERICAN<br>EXPRESS</span>
  </div>
  <!-- Maestro -->
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
  })
  const [saving, setSaving] = useState(false)
  const [imgSrcs, setImgSrcs] = useState([
    offer.preview_image || null,
    offer.preview_image_2 || null,
    offer.preview_image_3 || null,
  ])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const prices = calcPrices(form.base_price, form.disc_type, form.disc_val, form.vat_pct)

  function handleImage(e, idx) {
    const file = e.target.files[0]; if (!file) return
    const r = new FileReader()
    r.onload = ev => setImgSrcs(prev => { const next = [...prev]; next[idx] = ev.target.result; return next })
    r.readAsDataURL(file)
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

  const inp = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', color: '#111', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }
  const sel = { ...inp, cursor: 'pointer' }
  const lbl = { fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Angebot bearbeiten</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>#{offer.custom_id || offer.id.slice(0,8)}{offer.project ? ` · ${offer.project}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#9ca3af', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Bilder */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Vorschaubilder</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[0,1,2].map(idx => (
                <label key={idx} htmlFor={`edit-img-${idx}`} style={{ border: '1px dashed #e5e7eb', borderRadius: 10, padding: 8, textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: '#fafafa' }}>
                  <input id={`edit-img-${idx}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImage(e, idx)} />
                  {imgSrcs[idx]
                    ? <img src={imgSrcs[idx]} style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 6 }} alt="" />
                    : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span style={{ fontSize: 10, color: '#9ca3af' }}>Bild {idx+1}</span></>
                  }
                </label>
              ))}
            </div>
          </div>

          {/* Angebotsdaten */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Angebotsdaten</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Angebotsnummer</label><input style={inp} value={form.offer_num} onChange={e => set('offer_num', e.target.value)} /></div>
                <div><label style={lbl}>Projekt / Kundenname</label><input style={inp} value={form.project} onChange={e => set('project', e.target.value)} /></div>
              </div>
              <div><label style={lbl}>Kunden-E-Mail</label><input style={{...inp, borderColor: '#60c8f044', background: '#f0fbff'}} type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} placeholder="kunde@email.de" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Breite (cm)</label><input style={inp} type="number" value={form.width} onChange={e => set('width', e.target.value)} /></div>
                <div><label style={lbl}>Höhe (cm)</label><input style={inp} type="number" value={form.height} onChange={e => set('height', e.target.value)} /></div>
              </div>
              <div><label style={lbl}>Farbe(n) – kommagetrennt</label><input style={inp} value={form.colors} onChange={e => set('colors', e.target.value)} /></div>
            </div>
          </div>

          {/* Konfiguration */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Konfiguration</div>
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

          {/* Preis */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Preiskalkulation</div>
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

          {/* Weitere Einstellungen */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Weitere Einstellungen</div>
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

        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 10, padding: 12, fontWeight: 500, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Abbrechen</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Wird gespeichert...' : '✓ Änderungen speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState(false)
  const [tab, setTab] = useState('manage')
  const [previewTab, setPreviewTab] = useState('angebot')
  const [offers, setOffers] = useState([])
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [editingOffer, setEditingOffer] = useState(null)

  const fRef = useRef({
    num: '', project: '', customerEmail: '', customerNote: '', w: '', h: '',
    backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen',
    color: '', basePrice: '', discType: 'pct', discVal: '20', vat: '19',
    delivery: '', url: '', validUntil: '', status: 'offer_sent',
  })

  const [selects, setSelects] = useState({ backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen', discType: 'pct', status: 'offer_sent' })
  const [priceInputs, setPriceInputs] = useState({ basePrice: '', discVal: '20', vat: '19' })
  const [imgSrcs, setImgSrcs] = useState([null, null, null])
  const [parseStatus, setParseStatus] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [publishedLink, setPublishedLink] = useState(null)
  const iframeRef = useRef(null)
  const emailIframeRef = useRef(null)

  const prices = calcPrices(priceInputs.basePrice, selects.discType, priceInputs.discVal, priceInputs.vat)

  const updText = (k, v) => { fRef.current[k] = v; schedulePreview() }
  const updSelect = (k, v) => { fRef.current[k] = v; setSelects(p => ({ ...p, [k]: v })) }
  const updPrice = (k, v) => { fRef.current[k] = v; setPriceInputs(p => ({ ...p, [k]: v })) }

  function resetForm() {
    fRef.current = {
      num: '', project: '', customerEmail: '', customerNote: '', w: '', h: '',
      backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen',
      color: '', basePrice: '', discType: 'pct', discVal: '20', vat: '19',
      delivery: '', url: '', validUntil: '', status: 'offer_sent',
    }
    setSelects({ backplate: 'Ausgeschnitten', backplate_color: 'Transparent', usage: 'Innen', discType: 'pct', status: 'offer_sent' })
    setPriceInputs({ basePrice: '', discVal: '20', vat: '19' })
    setImgSrcs([null, null, null])
    setPublishedLink(null)
    setParseStatus(null)
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

    const validBadge = f.validUntil
      ? `<div style="display:flex;align-items:center;gap:6px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35);color:#d97706;font-size:11px;font-weight:600;padding:6px 12px;border-radius:20px;margin-bottom:8px;width:fit-content">📅 Gültig bis ${new Date(f.validUntil).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>`
      : ''

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
      if (p.price) { fRef.current.basePrice = p.price; setPriceInputs(prev => ({ ...prev, basePrice: p.price })) }
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
        preview_image: uploadedImgs[0], preview_image_2: uploadedImgs[1], preview_image_3: uploadedImgs[2],
        published: true,
      }

      const res = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const offerId = data.custom_id || data.id
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
          await fetch(`/api/offers?id=${data.id}`, {
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
    app: {display:'flex',flexDirection:'column',height:'100vh',background:'#fff',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'},
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
    right: {flex:1,position:'relative',overflow:'hidden',background:'#f3f4f6',display:'flex',flexDirection:'column'},
    iframe: {width:'100%',flex:1,border:'none',display:'block',background:'#fff'},
  }

  const Field = ({ label, children }) => (
    <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={S.label}>{label}</label>{children}</div>
  )

  if (tab === 'manage') return (
    <div style={S.app}>
      {editingOffer && (
        <EditModal
          offer={editingOffer}
          onClose={() => setEditingOffer(null)}
          onSaved={() => { setEditingOffer(null); loadOffers() }}
        />
      )}
      <div style={S.topbar}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div style={{background:'#0a0a0a',padding:'6px 10px',borderRadius:8}}><img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NF" style={{height:24,display:'block'}} /></div>
          <div style={S.tabs}>
            <button style={S.tab(false)} onClick={() => setTab('create')}>Erstellen</button>
            <button style={{...S.tab(true), position:'relative'}}>
              Verwalten
              {(() => { const n = offers.filter(o => { const d = Math.floor((Date.now() - new Date(o.created_at).getTime())/(1000*60*60*24)); return d >= 4 && o.status !== 'recontacted' && o.status !== 'confirmed' }).length; return n > 0 ? <span style={{position:'absolute',top:-6,right:-8,background:'#dc2626',color:'#fff',borderRadius:'50%',minWidth:18,height:18,fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',lineHeight:1}}>{n}</span> : null })()}
            </button>
          </div>
        </div>
        <button style={S.btnOutline} onClick={() => setAuthed(false)}>Abmelden</button>
      </div>
      <div style={{padding:32,overflowY:'auto',flex:1,background:'#f9fafb'}}>
        <div style={{maxWidth:900,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
            <h2 style={{fontSize:20,fontWeight:700}}>Alle Angebote {offers.length > 0 && <span style={{fontSize:14,fontWeight:500,color:'#9ca3af'}}>({offers.length})</span>}</h2>
            <button style={S.btnDark} onClick={loadOffers}>Aktualisieren</button>
          </div>
          {loadingOffers ? <div style={{textAlign:'center',padding:60,color:'#9ca3af',fontSize:14}}>Wird geladen...</div>
           : offers.length === 0 ? <div style={{textAlign:'center',padding:60,color:'#9ca3af',fontSize:14}}>Noch keine Angebote.</div>
           : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {offers.map(o => {
                const id = o.custom_id || o.id.slice(0,8)
                const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/angebot/${o.custom_id || o.id}`
                return (
                  <div key={o.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:12,padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr auto',alignItems:'center',gap:16}}>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
                        <span style={{fontSize:15,fontWeight:700}}>#{id}</span>
                        {o.project && <span style={{fontSize:14,color:'#6b7280'}}>{o.project}</span>}
                        <span style={{fontSize:12,fontWeight:600,padding:'3px 10px',borderRadius:20,background:o.published?'#f0fdf4':'#f3f4f6',color:o.published?'#166534':'#6b7280',border:`1px solid ${o.published?'#bbf7d0':'#e5e7eb'}`}}>{o.published?'Aktiv':'Inaktiv'}</span>
                        {o.created_at && (() => {
                          const daysDiff = Math.floor((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24))
                          const needsContact = daysDiff >= 4 && o.status !== 'recontacted' && o.status !== 'confirmed'
                          return (
                            <span style={{display:'flex',alignItems:'center',gap:6}}>
                              <span style={{fontSize:12,color:needsContact?'#dc2626':'#9ca3af',fontWeight:needsContact?700:400}}>
                                📅 {new Date(o.created_at).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}
                              </span>
                              {needsContact && (
                                <span
onClick={async () => {
  if (!o.customer_email) {
    alert('Keine E-Mail hinterlegt. Bitte im Bearbeiten-Menü ergänzen.')
    return
  }
  if (!confirm(`Erinnerungs-E-Mail an ${o.customer_email} senden?`)) return
  
  try {
    const offerLink = `${window.location.origin}/angebot/${o.custom_id || o.id}`
    const res = await fetch('/api/recontact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offerId: o.id,
        customerEmail: o.customer_email,
        customerName: o.project,
        offerLink,
        price: o.final_price,
        width: o.width,
        height: o.height,
        colors: o.colors,
      }),
    })
    const data = await res.json()
    if (data.success) {
      alert('✅ E-Mail gesendet & Status aktualisiert!')
      loadOffers()
    } else {
      alert('Fehler: ' + data.error)
    }
  } catch (err) {
    alert('Fehler: ' + err.message)
  }
}}
                                  title={o.customer_email ? 'E-Mail kopieren: ' + o.customer_email : 'Keine E-Mail hinterlegt'}
                                  style={{display:'inline-flex',alignItems:'center',gap:4,background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,whiteSpace:'nowrap',cursor:'pointer',userSelect:'none'}}
                                >
                                  ↩ Nochmals kontaktieren
                                </span>
                              )}
                            </span>
                          )
                        })()}
                      </div>
                      <div style={{fontSize:13,color:'#9ca3af',display:'flex',gap:16,flexWrap:'wrap'}}>
                        {o.width && o.height && <span>{o.width} × {o.height} cm</span>}
                        {o.colors && <span>{o.colors}</span>}
                        {o.final_price > 0 && <span style={{fontWeight:600,color:'#374151'}}>€ {parseFloat(o.final_price).toFixed(2)}</span>}
                        {o.valid_until && <span>Gültig bis {new Date(o.valid_until).toLocaleDateString('de-DE')}</span>}
                      </div>
                      <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:12,color:'#6b7280',fontWeight:500}}>Status</span>
                        <select
                          value={o.status || 'offer_sent'}
                          onChange={e => updateStatus(o.id, e.target.value)}
                          style={{fontSize:12,fontWeight:600,padding:'4px 10px',borderRadius:8,border:'1px solid #e5e7eb',background:'#f9fafb',color:'#111',cursor:'pointer',fontFamily:'inherit'}}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
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
                      <button onClick={() => setEditingOffer(o)} style={{background:'#eff6ff',border:'1px solid #bfdbfe',color:'#2563eb',borderRadius:8,padding:'9px 14px',fontWeight:500,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✏️ Bearbeiten</button>
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
          <div style={S.tabs}>
            <button style={S.tab(true)}>Erstellen</button>
            <button style={{...S.tab(false), position:'relative'}} onClick={() => setTab('manage')}>
              Verwalten
              {(() => { const n = offers.filter(o => { const d = Math.floor((Date.now() - new Date(o.created_at).getTime())/(1000*60*60*24)); return d >= 4 && o.status !== 'recontacted' && o.status !== 'confirmed' }).length; return n > 0 ? <span style={{position:'absolute',top:-6,right:-8,background:'#dc2626',color:'#fff',borderRadius:'50%',minWidth:18,height:18,fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px',lineHeight:1}}>{n}</span> : null })()}
            </button>
          </div>
        </div>
        <button style={S.btnOutline} onClick={() => setAuthed(false)}>Abmelden</button>
      </div>

      <div style={S.main}>
        {/* LEFT FORM */}
        <div style={S.left}>
          {/* BILDER */}
          <div style={S.section}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <div style={S.sTitle}>Dateien hochladen</div>
              <button onClick={resetForm} style={{background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',borderRadius:8,padding:'4px 12px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>↺ Reset</button>
            </div>
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

          {/* ANGEBOTSDATEN */}
          <div style={S.section}>
            <div style={S.sTitle}>Angebotsdaten</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Angebotsnummer">
                <input style={S.input} defaultValue={fRef.current.num} onChange={e => updText('num', e.target.value)} placeholder="NF-1001" />
              </Field>
              <Field label="Projekt / Kundenname">
                <input style={S.input} defaultValue={fRef.current.project} onChange={e => updText('project', e.target.value)} placeholder="z.B. Max Mustermann" />
              </Field>
              <Field label="Kunden-E-Mail">
                <input style={{...S.input, borderColor: '#60c8f044', background: '#f0fbff'}} type="email" defaultValue={fRef.current.customerEmail} onChange={e => updText('customerEmail', e.target.value)} placeholder="kunde@email.de" />
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

          {/* KONFIGURATION */}
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

          {/* PREIS */}
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

          {/* WEITERE EINSTELLUNGEN */}
          <div style={S.section}>
            <div style={S.sTitle}>Weitere Einstellungen</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <Field label="Angebot gültig bis">
                <input style={S.input} type="date" defaultValue={fRef.current.validUntil} onChange={e => updText('validUntil', e.target.value)} />
              </Field>
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
            <button style={S.btnGreen} onClick={publish} disabled={publishing}>{publishing?'Wird veröffentlicht...':'Angebotsseite veröffentlichen'}</button>
            {publishedLink && (
              <div style={S.linkBox}>
                <input value={publishedLink} readOnly style={{flex:1,background:'transparent',border:'none',fontSize:12,color:'#16a34a',outline:'none',fontFamily:'monospace'}} />
                <button onClick={() => navigator.clipboard.writeText(publishedLink)} style={{...S.btnOutline,padding:'4px 10px',fontSize:11,flexShrink:0}}>Kopieren</button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PREVIEW */}
        <div style={S.right}>
          <div style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'0 20px',display:'flex',alignItems:'center',gap:4,height:44,flexShrink:0}}>
            <button onClick={() => setPreviewTab('angebot')} style={{...S.tab(previewTab==='angebot'),fontSize:12,padding:'4px 14px'}}>Angebotsseite</button>
            <button onClick={() => setPreviewTab('email')} style={{...S.tab(previewTab==='email'),fontSize:12,padding:'4px 14px'}}>Kunden-E-Mail</button>
            <div style={{marginLeft:'auto',fontSize:11,color:'#9ca3af'}}>Live-Vorschau</div>
          </div>
          <iframe ref={iframeRef} style={{...S.iframe, display: previewTab === 'angebot' ? 'block' : 'none'}} title="Angebotsvorschau" />
          <iframe ref={emailIframeRef} style={{...S.iframe, display: previewTab === 'email' ? 'block' : 'none'}} title="E-Mail Vorschau" />
        </div>
      </div>
    </div>
  )
}
