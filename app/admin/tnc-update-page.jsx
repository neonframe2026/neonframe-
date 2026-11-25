'use client'
import { useState, useEffect, useRef } from 'react'
import AngebotPage from '../angebot/[id]/angebot-client'

// Änderung von TNC prüfen: links die echte Angebotsseite (so sieht sie der Kunde), Geändertes ist gold markiert.
// Rechts (Handy: unten) bearbeiten: Bilder ersetzen, Größe, Preis, Farbe, Rückwand, Verwendung, Notizen.
const GOLD = '#e8b130'
const r2 = n => Math.round(n * 100) / 100
const num = v => { const t = String(v ?? '').trim(); if (!t) return NaN; return t.includes(',') ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t) }
const eur = n => (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const vName = (n = '') => { const m = String(n).match(/[-_ ]v(\d+)\b/i); return m ? 'Variante v' + m[1] : 'Design' }
const tncTs = u => { const m = String(u || '').match(/3d-generations\/\d+\/(\d{4})-(\d\d)-(\d\d)-(\d\d)-(\d\d)-(\d\d)/); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null }
const proxy = u => /tnc-app\.dev/.test(u || '') ? '/api/tnc-image?url=' + encodeURIComponent(u) : u

// Was die Kundin am Ende zahlt (gleiche Rechnung wie im Server, inkl. Black Week)
function custPrice(o, fin) {
  const dType = o.disc_type || 'pct', dVal = parseFloat(o.disc_val) || 0
  const lDisc = o.black_week ? (parseFloat(o.bw_prev?.disc_val) || 20) : dVal
  const vat = 1 + (parseFloat(o.vat_pct) || 19) / 100
  const ex = (parseFloat(o.extra_disc_pct) || 0) / 100
  const base = Math.round((dType === 'pct' ? fin / vat / (1 - lDisc / 100) : fin / vat + dVal) * 10000) / 10000
  const net = (dType === 'pct' ? base * (1 - dVal / 100) : Math.max(0, base - dVal)) * (1 - ex)
  return { base, net: r2(net), final: r2(net * vat), rrp: r2(base * vat) }
}

// Eigenes Bild verkleinern (max. 2560 px), damit der Upload schnell geht
function shrink(file) {
  return new Promise((res, rej) => {
    const rd = new FileReader()
    rd.onload = () => {
      const img = new Image()
      img.onload = () => {
        const s = Math.min(1, 2560 / Math.max(img.width, img.height))
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        res(c.toDataURL('image/jpeg', 0.92))
      }
      img.onerror = rej; img.src = rd.result
    }
    rd.onerror = rej; rd.readAsDataURL(file)
  })
}

export default function TncUpdatePage2({ id, onBack, CheckoutImageField, uploadCheckoutImage }) {
  const [d, setD] = useState(null)
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [notify, setNotify] = useState(true)
  const [checkoutImg, setCheckoutImg] = useState(null)
  const [own, setOwn] = useState([null, null]) // eigene Bilder 1 und 2 (data-URL)
  const [pick, setPick] = useState([null, null]) // über „Bild auswählen“ gewählt (URL)
  const [rm, setRm] = useState([false, false]) // Bild entfernt (✕)
  const [chooser, setChooser] = useState(null) // { slot: 0|1, sel: url }
  const [pricesOpen, setPricesOpen] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [small, setSmall] = useState(false)
  const prevRef = useRef(null)

  useEffect(() => {
    const m = () => setSmall(window.innerWidth < 900)
    m(); window.addEventListener('resize', m); return () => window.removeEventListener('resize', m)
  }, [])

  useEffect(() => {
    fetch('/api/tnc-update?id=' + encodeURIComponent(id)).then(r => r.json()).then(j => {
      if (j.error) return setErr(j.error)
      setD(j)
      setF({
        width: String(j.after.width), height: String(j.after.height),
        final: String(j.after.final).replace('.', ','),
        colors: j.after.colors || '', backplate: j.after.backplate || '', usage: j.after.usage || '',
        note: j.before.customer_note || '',
      })
    }).catch(e => setErr(e.message))
  }, [id])

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const all = d ? (d.after.all || []) : []
  const pickSize = (w) => {
    const r = all.find(x => String(x.w) === String(w))
    if (r) setF(p => ({ ...p, width: String(r.w), height: String(r.h), final: String(r2(r.vk * 1.10)).replace('.', ',') }))
  }
  const tncImgs = d ? [d.after.realistic_image || '', d.after.design_image || ''] : ['', '']
  const oldImgs = d ? [d.before.offer.preview_image || null, d.before.offer.preview_image_2 || null] : [null, null]
  const imgs = [0, 1].map(i => rm[i] ? null : (own[i] || pick[i] || tncImgs[i] || oldImgs[i] || null))
  const slotSet = (i, o, p, r) => { setOwn(x => { const n = [...x]; n[i] = o; return n }); setPick(x => { const n = [...x]; n[i] = p; return n }); setRm(x => { const n = [...x]; n[i] = r; return n }) }

  // Alle Bilder zum Auswählen: alles, was TNC hochgeladen hat (alle Varianten + Vorschau), dazu die Bilder im Angebot
  const library = []
  if (d) {
    const lastV = d.before.offer.neon_variants?.versions?.slice(-1)[0]
    const prevSrc = lastV?.src || []
    const created = new Date(d.before.offer.created_at || 0).getTime()
    const isNeu = (x) => prevSrc.length ? !prevSrc.includes(x.url) : x.kind === 'real' ? (tncTs(x.url) || 0) > created : x.url === tncImgs[1]
    const add = (url, label, neu) => { if (url && !library.some(x => x.url === url)) library.push({ url, label, neu }) }
    for (const x of d.after.images || []) add(x.url, x.kind === 'real' ? 'Vorschau' : vName(x.name), isNeu(x))
    add(tncImgs[0], 'Vorschau', false); add(tncImgs[1], 'Design', false)
    oldImgs.forEach((u, i) => add(u, `Bisher Bild ${i + 1}`, false))
  }

  // Angebot so zusammenbauen, wie es nach dem Übernehmen gespeichert wird (gleiche Rechnung wie im Server)
  let preview = null
  if (d && f) {
    const o = d.before.offer
    const fin = num(f.final) > 0 ? num(f.final) : d.after.final
    const cp = custPrice(o, fin)
    const pv = imgs.filter(Boolean)
    const w = num(f.width) > 0 ? num(f.width) : d.after.width
    preview = {
      ...o, width: String(w), height: String(num(f.height) > 0 ? num(f.height) : d.after.height),
      colors: f.colors, backplate: f.backplate, usage: f.usage,
      base_price: cp.base, net_price: cp.net, final_price: cp.final, rrp_price: cp.rrp,
      size_options: all.filter(r => r.w !== w),
      preview_image: pv[0] || o.preview_image, preview_image_2: pv[1] || null,
      neon_variants: null, // Vorschau zeigt, wie die neue Variante aussieht
      customer_note: f.note.trim() || null,
    }
  }

  // Was hat sich geändert?
  const b = d?.before
  const ch = d && f && preview ? {
    img1: imgs[0] !== oldImgs[0], img2: imgs[1] !== oldImgs[1],
    size: String(preview.width) !== String(b.width) || String(preview.height) !== String(b.height),
    price: Math.abs(preview.final_price - (parseFloat(b.final) || 0)) > 0.009,
    colors: (f.colors || '') !== (b.colors || ''),
    backplate: (f.backplate || '') !== (b.backplate || ''),
    usage: (f.usage || '') !== (b.usage || ''),
    note: (f.note.trim() || '') !== (b.customer_note || '').trim(),
  } : {}
  const changedList = [ch.img1 || ch.img2 ? 'Bild' : '', ch.size ? 'Größe' : '', ch.price ? 'Preis' : '', ch.colors ? 'Farbe' : '', ch.backplate ? 'Rückwand' : '', ch.usage ? 'Verwendung' : '', ch.note ? 'Notiz' : ''].filter(Boolean)

  // Gold-Markierungen in der Angebotsseite setzen
  useEffect(() => {
    const root = prevRef.current
    if (!root || !preview) return
    const t = setTimeout(() => {
      root.querySelectorAll('[data-gold]').forEach(e => { e.removeAttribute('data-gold'); e.removeAttribute('data-gold-in') })
      const mark = (el, txt) => { if (el) el.setAttribute('data-gold', txt) }
      if (ch.img1 && preview.preview_image) root.querySelectorAll('img').forEach(i => {
        if (i.getAttribute('src') === preview.preview_image && i.getBoundingClientRect().width > 200) { mark(i.parentElement, own[0] ? 'Eigenes Bild' : 'Neues Bild'); i.parentElement.setAttribute('data-gold-in', '1') }
      })
      const byLabel = (re) => [...root.querySelectorAll('.cfg-label')].filter(l => re.test(l.textContent)).map(l => l.parentElement)
      if (ch.size) byLabel(/^Maße/).forEach(e => mark(e, `Neue Größe · vorher ${b.width} × ${b.height} cm`))
      if (ch.colors) byLabel(/^Farbe/).forEach(e => mark(e, 'Neue Farbe'))
      if (ch.backplate) byLabel(/^Rückwandform/).forEach(e => mark(e, 'Neu'))
      if (ch.usage) byLabel(/^Verwendung/).forEach(e => mark(e, 'Neu'))
      if (ch.price) root.querySelectorAll('.oc-total').forEach(e => mark(e, `Neuer Preis · vorher ${eur(b.final)}`))
      if (ch.note) [...root.querySelectorAll('div')].filter(x => x.children.length === 2 && /Notizen von NeonFrame/.test(x.firstElementChild?.textContent || '') && !/Notizen von NeonFrame/.test(x.children[1].textContent)).forEach(e => mark(e, 'Neue Notiz'))
    }, 60)
    return () => clearTimeout(t)
  })

  async function addOwn(i, file) {
    if (!file) return
    try { const u = await shrink(file); slotSet(i, u, null, false) } catch (e) { alert('Bild konnte nicht geladen werden: ' + e.message) }
  }

  async function apply() {
    setBusy(true); setErr('')
    try {
      let checkout_image = null
      if (checkoutImg) {
        checkout_image = await uploadCheckoutImage(checkoutImg, b.id)
        if (!checkout_image) throw new Error('Checkout-Bild konnte nicht hochgeladen werden')
      }
      const up = []
      for (const i of [0, 1]) {
        if (!own[i]) { up[i] = rm[i] ? null : (pick[i] || null); continue }
        up[i] = await uploadCheckoutImage(own[i], b.id)
        if (!up[i]) throw new Error(`Bild ${i + 1} konnte nicht hochgeladen werden`)
      }
      const j = await (await fetch('/api/tnc-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notify, edit: { width: f.width, height: f.height, final: f.final, colors: f.colors, backplate: f.backplate, usage: f.usage, checkout_image, img1: up[0], img2: up[1], rm1: rm[0], rm2: rm[1], customer_note: f.note } }),
      })).json()
      if (j.error) throw new Error(j.error)
      setDone(j); setSheet(false)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const inp = (gold) => ({ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${gold ? GOLD : '#2a2d36'}`, background: gold ? 'rgba(232,177,48,.08)' : '#0b0c10', color: '#f1f2f5', fontSize: 13, fontFamily: 'inherit' })
  const h4 = { margin: '0 0 8px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a8f9c', display: 'flex', justifyContent: 'space-between' }
  const gtag = (t) => <span style={{ color: GOLD, textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}>{t}</span>
  const row = (label, el, was) => (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, alignItems: 'center', marginBottom: 7 }}>
      <label style={{ color: '#8a8f9c' }}>{label}</label>{el}
      {was && <span style={{ gridColumn: 2, color: '#8a8f9c', fontSize: 11.5, marginTop: -3 }}>vorher {was}</span>}
    </div>
  )
  const obtn = { display: 'block', textAlign: 'center', border: '1px solid #22d3ee', color: '#22d3ee', borderRadius: 8, padding: '6px 8px', fontSize: 12, fontWeight: 700, marginTop: 6, cursor: 'pointer' }
  const pbtn = { background: GOLD, color: '#1d1400', border: 0, borderRadius: 10, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
  const cbtn = { background: 'none', border: '1px solid #2a2d36', color: '#f1f2f5', borderRadius: 10, padding: '11px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }

  const doneBox = done && (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: '#22c55e1a', border: '1px solid #22c55e55', color: '#22c55e', fontSize: 13.5, lineHeight: 1.6 }}>
      ✓ Angebot aktualisiert{done.mailSent ? ' und Kunde per Mail informiert' : ''}.<br />
      {done.shopifyError && <span style={{ color: '#f59e0b' }}>Shopify: {done.shopifyError}<br /></span>}
      <a href={`/angebot/${done.offerId}`} target="_blank" rel="noreferrer" style={{ color: '#22c55e' }}>Angebotsseite ansehen</a> · <span onClick={onBack} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Zur Zentrale</span>
    </div>
  )

  const panel = d && f && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={h4}>Bilder {(ch.img1 || ch.img2) && gtag(`${(ch.img1 ? 1 : 0) + (ch.img2 ? 1 : 0)} geändert`)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[0, 1].map(i => {
            const file = <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { addOwn(i, e.target.files[0]); e.target.value = '' }} />
            return (
              <div key={i} style={{ minWidth: 0 }}>
                <div style={{ position: 'relative' }}>
                  {imgs[i] ? (
                    <label title="Antippen = eigenes Bild hochladen" style={{ display: 'block', cursor: 'pointer' }}>
                      <img src={imgs[i]} alt={`Bild ${i + 1}`} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, display: 'block', border: `2px solid ${ch['img' + (i + 1)] ? GOLD : '#2a2d36'}` }} />{file}
                    </label>
                  ) : (
                    <label style={{ height: 80, borderRadius: 8, border: '2px dashed #3a3e48', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: '#8a8f9c', fontSize: 11.5, cursor: 'pointer', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: 18 }}>＋</span>Bild {i + 1} hochladen{file}
                    </label>
                  )}
                  {imgs[i] && <span onClick={() => slotSet(i, null, null, true)} title="Bild entfernen" style={{ position: 'absolute', right: 5, top: 5, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,.8)', border: '1px solid #555', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer' }}>✕</span>}
                </div>
                <div onClick={() => setChooser({ slot: i, sel: imgs[i] || null })} style={obtn}>🖼 Bild {i + 1} auswählen</div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 10 }}>
          <CheckoutImageField src={checkoutImg} onChange={setCheckoutImg} inputId="update-checkout-img" dark noUpload title="Checkout-Bild (1:1) · Variante 2" cropSrcs={[0, 1].map(i => !imgs[i] ? null : own[i] ? own[i] : proxy(imgs[i]))} />
        </div>
      </div>

      <div>
        <div style={h4}>Angebot</div>
        {row('Größe', all.length > 1
          ? <select style={inp(ch.size)} value={f.width} onChange={e => pickSize(e.target.value)}>
              {!all.some(r => String(r.w) === f.width) && <option value={f.width}>{f.width} × {f.height} cm</option>}
              {all.map(r => <option key={r.w} value={String(r.w)}>{r.w} × {r.h} cm</option>)}
            </select>
          : <div style={{ display: 'flex', gap: 6 }}><input style={inp(ch.size)} value={f.width} onChange={e => set('width', e.target.value)} inputMode="numeric" /><input style={inp(ch.size)} value={f.height} onChange={e => set('height', e.target.value)} inputMode="numeric" /></div>,
          ch.size ? `${b.width} × ${b.height} cm` : '')}
        {row(b.offer.black_week ? 'Preis vor BW' : 'Endpreis (€)', <input style={inp(ch.price)} value={f.final} onChange={e => set('final', e.target.value)} inputMode="decimal" />, ch.price ? `${eur(b.final)} · Kunde zahlt jetzt ${eur(preview.final_price)}` : '')}
        {b.offer.black_week && !ch.price && <div style={{ color: '#8a8f9c', fontSize: 11.5, margin: '-3px 0 7px 98px' }}>Kunde zahlt {eur(preview.final_price)} (Black Week)</div>}
        {row('Farbe', <input style={inp(ch.colors)} value={f.colors} onChange={e => set('colors', e.target.value)} />, ch.colors ? b.colors : '')}
        {row('Rückwand', <select style={inp(ch.backplate)} value={f.backplate} onChange={e => set('backplate', e.target.value)}>{['Ausgeschnitten', 'Quadratisch', 'Ohne'].map(o => <option key={o}>{o}</option>)}</select>, ch.backplate ? b.backplate : '')}
        {row('Verwendung', <select style={inp(ch.usage)} value={f.usage} onChange={e => set('usage', e.target.value)}>{['Innen', 'Außen IP65'].map(o => <option key={o}>{o}</option>)}</select>, ch.usage ? b.usage : '')}
      </div>

      {all.length > 0 && (() => {
        // Preisliste: standardmäßig zu, nur bei Änderungen gelb markiert
        const oldRows = Array.isArray(b.offer.size_options) ? b.offer.size_options : []
        const oldVk = w => { const r = oldRows.find(x => +x.w === +w); return r ? +r.vk : null }
        const pay = vk => custPrice(b.offer, r2(vk * 1.10)).final
        const changed = ch.price || ch.size || all.some(r => { const o = oldVk(r.w); return o != null && Math.abs(o - r.vk) > 0.009 })
        return (
          <div>
            <div onClick={() => setPricesOpen(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: pricesOpen ? '10px 10px 0 0' : 10, border: `1px solid ${changed ? GOLD : '#2a2d36'}`, background: changed ? 'rgba(232,177,48,.07)' : '#0b0c10', cursor: 'pointer' }}>
              <span style={{ minWidth: 0 }}>
                {changed
                  ? <><b style={{ color: GOLD }}>Preise geändert</b>{ch.price && <span style={{ color: '#8a8f9c', fontSize: 12 }}> · {f.width} cm: {eur(b.final)} → {eur(preview.final_price)}</span>}</>
                  : <span style={{ color: '#8a8f9c' }}>Alle Größen von TNC <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#14532d', color: '#86efac' }}>unverändert</span></span>}
              </span>
              <span style={{ color: '#8a8f9c' }}>{pricesOpen ? '▴' : '▾'}</span>
            </div>
            {pricesOpen && (
              <div style={{ border: `1px solid ${changed ? GOLD : '#2a2d36'}`, borderTop: 0, borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                {all.map((r, i) => {
                  const cur = String(r.w) === f.width
                  const o = oldVk(r.w)
                  const diff = o != null && Math.abs(o - r.vk) > 0.009
                  return (
                    <div key={r.w} onClick={() => pickSize(r.w)} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderTop: i ? '1px solid #1f2229' : 0, cursor: 'pointer', background: cur ? 'rgba(232,177,48,.08)' : 'none', color: cur ? GOLD : '#f1f2f5', fontWeight: cur ? 700 : 400 }}>
                      <span>{r.w} × {r.h} cm</span>
                      <span>{diff && <s style={{ color: '#6b7080', marginRight: 6, fontWeight: 400 }}>{eur(pay(o))}</s>}{cur && preview ? eur(preview.final_price) : eur(pay(r.vk))}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      <div>
        <div style={h4}>Notizen für den Kunden {ch.note && gtag('geändert')}</div>
        <textarea style={{ ...inp(ch.note), minHeight: 84, lineHeight: 1.5, resize: 'vertical' }} value={f.note} onChange={e => set('note', e.target.value)} placeholder="Steht im Angebot unter „Notizen von NeonFrame“. Leer lassen, wenn es nichts gibt." />
      </div>

      {err && <div style={{ padding: '10px 12px', borderRadius: 10, background: '#ef44441a', border: '1px solid #ef444455', color: '#ef4444', fontSize: 13 }}>{err}</div>}
      {done ? doneBox : (
        <div style={{ borderTop: '1px solid #2a2d36', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} disabled={!b.customer_email} /> Kunde per Mail informieren
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={apply} disabled={busy} style={{ ...pbtn, flex: 1, opacity: busy ? .6 : 1 }}>{busy ? 'Wird übernommen...' : 'Übernehmen'}</button>
            <button onClick={onBack} style={cbtn}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  )

  const chooserBox = chooser && d && (() => {
    const slot = chooser.slot
    const take = () => {
      const u = chooser.sel
      if (u) slotSet(slot, null, u === tncImgs[slot] ? null : u, false)
      setChooser(null)
    }
    return (
      <div onClick={() => setChooser(null)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: small ? 'flex-end' : 'center', justifyContent: 'center' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#15171d', color: '#f1f2f5', border: '1px solid #2a2d36', width: small ? '100%' : 620, maxHeight: small ? '86vh' : '84vh', overflowY: 'auto', borderRadius: small ? '18px 18px 0 0' : 16, padding: small ? '10px 14px 16px' : 18, boxSizing: 'border-box', fontSize: 13 }}>
          {small && <div onClick={() => setChooser(null)} style={{ width: 40, height: 4, borderRadius: 9, background: '#3a3e48', margin: '0 auto 10px' }} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <b style={{ fontSize: 15 }}>Bild {slot + 1} wählen · Bilder von TNC</b>
            <span onClick={() => setChooser(null)} style={{ color: '#8a8f9c', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: small ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 10 }}>
            {library.map(x => {
              const sel = chooser.sel === x.url, now = imgs[slot] === x.url
              return (
                <div key={x.url} onClick={() => setChooser(c => ({ ...c, sel: x.url }))} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: '#000', border: `2px solid ${sel ? '#22c55e' : now ? GOLD : '#2a2d36'}`, boxShadow: sel ? '0 0 0 3px rgba(34,197,94,.25)' : 'none' }}>
                  <img src={x.url} alt="" style={{ width: '100%', height: small ? 92 : 110, objectFit: 'cover', display: 'block' }} />
                  {sel && <span style={{ position: 'absolute', right: 6, top: 6, width: 20, height: 20, borderRadius: '50%', background: '#22c55e', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                  {now && <span style={{ position: 'absolute', left: 6, top: 6, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: GOLD, color: '#1d1400' }}>jetzt drin</span>}
                  <div style={{ padding: '5px 8px', fontSize: 11.5, color: '#c9ccd4', background: '#0b0c10' }}>{x.label}{x.neu && <b style={{ color: '#1a9bff' }}> · neu</b>}</div>
                </div>
              )
            })}
          </div>
          {!library.length && <div style={{ color: '#8a8f9c' }}>Keine Bilder gefunden.</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
            {!small && <button onClick={() => setChooser(null)} style={cbtn}>Abbrechen</button>}
            <button onClick={take} disabled={!chooser.sel} style={{ ...pbtn, flex: small ? 1 : 'none', opacity: chooser.sel ? 1 : .5 }}>Als Bild {slot + 1} nehmen</button>
          </div>
        </div>
      </div>
    )
  })()

  const SIDE = 370
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <style>{`
        .nf-prev [data-gold]{position:relative;outline:3px solid ${GOLD};outline-offset:4px;border-radius:12px;box-shadow:0 0 0 8px rgba(232,177,48,.12)}
        .nf-prev [data-gold]::before{content:attr(data-gold);position:absolute;z-index:40;left:10px;top:-14px;background:${GOLD};color:#1d1400;font:700 12px -apple-system,Segoe UI,Arial,sans-serif;padding:4px 10px;border-radius:99px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.25);pointer-events:none}
        .nf-prev .oc-total[data-gold]::before{left:auto;right:10px;top:-30px}
        .nf-prev [data-gold-in]::before{top:12px;left:12px}
        .nf-prev .sticky-buy{display:none!important}
        .nf-prev a,.nf-prev button,.nf-prev select,.nf-prev textarea{pointer-events:none}
      `}</style>

      {chooserBox}
      {/* Leiste oben */}
      <div style={{ position: 'fixed', left: 0, right: 0, top: 0, height: small ? 52 : 58, background: '#0c0d10', borderBottom: `2px solid ${GOLD}`, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 14, padding: small ? '0 12px' : '0 20px', color: '#f1f2f5', fontSize: 14 }}>
        <span onClick={onBack} style={{ cursor: 'pointer', color: '#8a8f9c', fontSize: 18 }} title="Zurück">←</span>
        <b style={{ fontSize: 15, whiteSpace: 'nowrap' }}>🔄 Änderung prüfen</b>
        {!small && b && <span style={{ color: '#8a8f9c', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>TNC {id} · {b.project || 'ohne Projekt'} · {b.customer_email || 'keine E-Mail'}</span>}
        <span style={{ flex: 1 }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: GOLD, fontWeight: 700, fontSize: 12.5, border: `1px solid ${GOLD}66`, borderRadius: 99, padding: '4px 10px', whiteSpace: 'nowrap' }}><i style={{ width: 10, height: 10, borderRadius: 3, background: GOLD }} />Gold = geändert</span>
      </div>

      {/* Angebotsseite wie beim Kunden */}
      <div ref={prevRef} className="nf-prev" style={{ position: 'absolute', top: small ? 52 : 58, left: 0, right: small ? 0 : SIDE, bottom: small ? 76 : 0, overflowY: 'auto', background: '#fff' }}>
        {!d && !err && <div style={{ padding: 40, color: '#666' }}>Neue Daten werden von TNC geladen... (ca. 10 Sek.)</div>}
        {err && !d && <div style={{ margin: 24, padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>{err}</div>}
        {preview && <AngebotPage key={preview.width + '-' + preview.height} offer={preview} />}
      </div>

      {/* Bearbeiten: Desktop rechts, Handy unten */}
      {!small && (
        <div style={{ position: 'fixed', right: 0, top: 58, bottom: 0, width: SIDE, background: '#111318', borderLeft: '1px solid #2a2d36', zIndex: 999, overflowY: 'auto', overflowX: 'hidden', padding: 18, color: '#f1f2f5', fontSize: 13, boxSizing: 'border-box' }}>
          {panel || <div style={{ color: '#8a8f9c' }}>Lädt...</div>}
        </div>
      )}
      {small && d && f && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001, background: '#111318', borderTop: `2px solid ${GOLD}`, borderRadius: '18px 18px 0 0', padding: '12px 16px 16px', color: '#f1f2f5', fontSize: 13, boxShadow: '0 -10px 30px rgba(0,0,0,.4)', maxHeight: sheet ? '82vh' : 'none', overflowY: sheet ? 'auto' : 'visible', boxSizing: 'border-box' }}>
          {sheet ? (
            <>
              <div onClick={() => setSheet(false)} style={{ width: 40, height: 4, borderRadius: 9, background: '#3a3e48', margin: '0 auto 12px', cursor: 'pointer' }} />
              <div onClick={() => setSheet(false)} style={{ textAlign: 'right', color: '#8a8f9c', marginTop: -10, marginBottom: 6, cursor: 'pointer' }}>✕ Zur Vorschau</div>
              {panel}
            </>
          ) : done ? doneBox : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{changedList.length} {changedList.length === 1 ? 'Änderung' : 'Änderungen'}</b>
                <div style={{ color: '#8a8f9c', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{changedList.join(', ') || 'nichts geändert'}</div>
              </div>
              <button onClick={() => setSheet(true)} style={cbtn}>✏️ Bearbeiten</button>
              <button onClick={apply} disabled={busy} style={{ ...pbtn, opacity: busy ? .6 : 1 }}>{busy ? '...' : 'Übernehmen'}</button>
            </div>
          )}
          {!sheet && err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{err}</div>}
        </div>
      )}
    </div>
  )
}
