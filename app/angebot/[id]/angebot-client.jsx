'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

function colorDot(s = '') {
  const c = s.toLowerCase()
  if (c.includes('ice blue')) return '#38bdf8'
  if (c.includes('lake blue')) return '#2ee6d6'
  if (c.includes('blue') || c.includes('blau')) return '#2f3dff'
  if (c.includes('warm white') || c.includes('warm')) return '#fde7a8'
  if (c.includes('white') || c.includes('weiß')) return '#e5e7eb'
  if (c.includes('peachy')) return '#fb7185'
  if (c.includes('soft pink')) return '#f9a8d4'
  if (c.includes('pink')) return '#ec4899'
  if (c.includes('red') || c.includes('rot')) return '#ef4444'
  if (c.includes('light green')) return '#a3e635'
  if (c.includes('green') || c.includes('grün')) return '#22c55e'
  if (c.includes('purple') || c.includes('lila')) return '#8b2cf5'
  if (c.includes('yellow') || c.includes('gelb')) return '#facc15'
  if (c.includes('soft orange')) return '#fdba74'
  if (c.includes('orange')) return '#f97316'
  return '#9ca3af'
}

// ─── INFO-I mit Bild/Text (Hover am PC, Antippen am Handy) ──────────────────
function tipText(text = '') {
  const i = text.indexOf('Kleiner gewünscht?')
  if (i <= 0) return text
  return <>{text.slice(0, i).trim()}<span style={{ display: 'block' }}>{text.slice(i)}</span></>
}

function InfoTip({ img, text, wide, warn }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [pos, setPos] = useState(null)
  const iconRef = useRef(null)
  const popRef = useRef(null)

  // Popup immer komplett im sichtbaren Bereich platzieren
  const place = useCallback(() => {
    const ic = iconRef.current, pop = popRef.current
    if (!ic || !pop) return
    const r = ic.getBoundingClientRect()
    const pw = pop.offsetWidth, ph = pop.offsetHeight
    const vw = window.innerWidth, vh = window.innerHeight, m = 12
    let left = r.left - 10
    if (left + pw > vw - m) left = vw - m - pw
    if (left < m) left = m
    let top = r.bottom + 10
    if (top + ph > vh - m) top = r.top - 10 - ph
    if (top < m) top = Math.max(m, vh - m - ph)
    setPos({ left, top })
  }, [])

  useEffect(() => {
    if (!hover) { setPos(null); return }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [hover, place])

  const content = img ? <img src={img} alt="" onLoad={place} /> : <span className="ii-txt">{tipText(text)}</span>
  return (
    <span className="ii-wrap">
      <span
        ref={iconRef}
        className={warn ? 'ii ii-warn' : 'ii'}
        role="button"
        tabIndex={0}
        onMouseEnter={() => { if (window.matchMedia('(hover:hover) and (min-width:961px)').matches) setHover(true) }}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => { e.stopPropagation(); setHover(false); setOpen(true) }}
      >{warn ? '!' : 'i'}</span>
      {hover && (
        <span ref={popRef} className={`ii-pop${wide === 'x' ? ' xwide' : wide === 'c' ? ' cwide' : wide === 'u' ? ' uwide' : wide ? ' wide' : ''}`} style={pos ? { left: pos.left, top: pos.top, visibility: 'visible' } : { left: 0, top: 0, visibility: 'hidden' }}>
          {content}
        </span>
      )}
      {open && (
        <span className="ii-modal" onClick={() => setOpen(false)}>
          <span className="ii-modal-box" onClick={(e) => e.stopPropagation()}>
            {img ? <img src={img} alt="" /> : <span className="ii-txt">{tipText(text)}</span>}
            <button type="button" onClick={() => setOpen(false)}>Schließen</button>
          </span>
        </span>
      )}
    </span>
  )
}

// Größen: Endpreis (brutto, nach Rabatt) je Breite.
// Feste Punkte: Mindestbreite = Empf. VK + 10 % · Originalgröße = Angebots-Endpreis · 300 cm = Empf. VK + 10 %
// Dazwischen linear. Daraus wird der Listenpreis (netto, vor Rabatt) zurückgerechnet.
const VK_AUFSCHLAG = 1.10
function sizeModel(offer) {
  // NEU: feste Größen aus dem Admin (Breite, Höhe, Empf. VK) – exakte Preise
  const rows = Array.isArray(offer.size_options) ? offer.size_options.filter(r => +r.w > 0 && +r.h > 0 && +r.vk > 0) : []
  if (rows.length) {
    const W0 = parseFloat(offer.width) || 0, H0 = parseFloat(offer.height) || 0, base0 = parseFloat(offer.base_price) || 0
    const dType = offer.disc_type || 'pct', dVal = parseFloat(offer.disc_val) || 0
    const vat = 1 + (parseFloat(offer.vat_pct) || 19) / 100
    const toBase = (f) => (dType === 'pct' ? f / vat / (1 - dVal / 100) : f / vat + dVal)
    const map = new Map()
    rows.forEach(r => map.set(+r.w, { h: +r.h, base: toBase(+r.vk * VK_AUFSCHLAG) }))
    if (W0) map.set(W0, { h: H0, base: base0 })
    const widths = [...map.keys()].sort((a, b) => a - b)
    const minW = Math.min(...rows.map(r => +r.w), W0 || Infinity)
    return { enabled: widths.length > 1, W0, H0, minW, widths, listAt: (w) => (map.get(w) || { base: base0 }).base, heightFor: (w) => (map.get(w) || { h: H0 }).h }
  }

  const W0 = parseFloat(offer.width) || 0
  const H0 = parseFloat(offer.height) || 0
  const minW = parseFloat(offer.size_min_width) || 0
  const pMin = parseFloat(offer.tnc_price_min) || 0
  const pMax = parseFloat(offer.tnc_price_max) || 0
  const base0 = parseFloat(offer.base_price) || 0
  const dType = offer.disc_type || 'pct'
  const dVal = parseFloat(offer.disc_val) || 0
  const vat = 1 + (parseFloat(offer.vat_pct) || 19) / 100
  const toFinal = (b) => (dType === 'pct' ? b * (1 - dVal / 100) : Math.max(0, b - dVal)) * vat
  const toBase = (f) => (dType === 'pct' ? f / vat / (1 - dVal / 100) : f / vat + dVal)
  const enabled = W0 > 0 && H0 > 0 && minW > 0 && minW < 300 && pMin > 0 && pMax > 0 && base0 > 0 && !(dType === 'pct' && dVal >= 100)
  const pts = [[minW, pMin * VK_AUFSCHLAG], [300, pMax * VK_AUFSCHLAG]]
  if (W0 > minW && W0 < 300) pts.splice(1, 0, [W0, toFinal(base0)])
  const listAt = (w) => {
    if (!enabled || w === W0) return base0
    for (let k = 0; k < pts.length - 1; k++) {
      const [x1, y1] = pts[k], [x2, y2] = pts[k + 1]
      if (w <= x2 || k === pts.length - 2) return toBase(y1 + (y2 - y1) * (w - x1) / (x2 - x1))
    }
    return base0
  }
  const heightFor = (w) => (W0 ? Math.round(w * H0 / W0) : H0)
  const widths = []
  for (let w = 30; w <= 300; w += 10) widths.push(w)
  if (W0 && !widths.includes(W0)) widths.push(W0)
  widths.sort((x, y) => x - y)
  return { enabled, W0, H0, minW, widths, listAt, heightFor }
}

function parseColors(s = '') {
  return s.split(',').map(c => c.trim()).filter(Boolean)
}

const backplateFormImageUrl = '/email/rueckwand-form.jpg'
const backplateColorImageUrl = '/email/rueckwand-farbe.jpg'
const usageImages = {
  'innen': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/Logo-Neonschild.png?v=1789479108',
  'außen': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_04_03_27.png?v=1778724405',
}
const colorHoverImage = '/email/neon-farben.jpg'

const customerGalleryImages = [
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as1_800x800.jpg?v=1789570862',
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as5_800x800.png?v=1789570860',
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as7_800x800.jpg?v=1789570859',
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as10_800x800.jpg?v=1789570858',
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as6_800x800.jpg?v=1789570858',
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as8_800x800.jpg?v=1789570858',
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as4_800x800.jpg?v=1789570857',
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as9_800x800.jpg?v=1789570857',
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as3_800x800.jpg?v=1789570858',
  'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/as2_800x800.jpg?v=1789570856',
]

const compareRows = [
  { feature: 'LED Technologie', brandValue: 'Ultra Power LED', otherValue: 'Standard LED' },
  { feature: 'Garantie', brandValue: '24-36 Monate', otherValue: 'max. 12 Monate' },
  { feature: 'LED Lebensdauer', brandValue: '100.000 Stunden', otherValue: '50.000 Stunden' },
  { feature: 'Stromverbrauch', brandValue: 'Bis zu 40% geringerer Stromverbrauch', otherValue: 'Sehr hoher Energieverbrauch' },
  { feature: 'Helligkeit', brandValue: '1000-1400 Lumen', otherValue: '400-600 Lumen' },
  { feature: 'Qualitäts- und Sicherheitsprüfung', brandIcon: 'yes', otherValue: 'optional' },
  { feature: 'Dimmer und Fernbedienung', brandIcon: 'yes', otherValue: 'optional' },
  { feature: '100% geräuschlos', brandIcon: 'yes', otherIcon: 'no' },
]

const faqCategories = [
  { id: 'order-payment', label: 'Bestellung & Zahlung', icon: '💳' },
  { id: 'shipping-delivery', label: 'Versand & Lieferung', icon: '📦' },
  { id: 'product-usage', label: 'Produkt & Nutzung', icon: '💡' },
  { id: 'installation', label: 'Montage', icon: '🛠️' },
  { id: 'warranty-return', label: 'Garantie & Rückgabe', icon: '🛡️' },
]

const faqItems = [
  { id: 0, category: 'order-payment', question: 'Welche Zahlungsarten werden akzeptiert?', answer: 'Wir akzeptieren Zahlungen per PayPal, Klarna, Visa, Mastercard, Apple Pay, Google Pay, American Express und Maestro. Alle Zahlungen werden direkt verarbeitet, sodass wir deine Bestellung schnellstmöglich anfertigen und versenden können.' },
  { id: 1, category: 'order-payment', question: 'Bietet ihr Mengenrabatte für Events oder Businesses an?', answer: 'Ja! Für größere Bestellungen (z. B. Firmen oder Events) bieten wir individuelle Angebote an. Kontaktiere uns einfach direkt per E-Mail: info@neonframe.de' },
  { id: 2, category: 'shipping-delivery', question: 'Wie lange dauert die Lieferzeit?', answer: 'Die Lieferzeit beträgt in der Regel 2-3 Wochen nach Auftragsbestätigung.' },
  { id: 3, category: 'shipping-delivery', question: 'Bietet ihr auch Express-Versand an?', answer: 'Es ist möglich, eine Eilbestellung zu machen und in vielen Fällen können wir bereits innerhalb von 10 Tagen liefern. Bitte kontaktieren Sie uns, um weiteres zu besprechen: info@neonframe.de' },
  { id: 4, category: 'shipping-delivery', question: 'Kann ich mein Paket verfolgen?', answer: 'Sobald die Produktion abgeschlossen ist und dein Neonschild verschickt wurde, erhältst du eine E-Mail mit deiner Sendungsnummer. Mit dieser ist es möglich, die Sendung zu verfolgen.' },
  { id: 5, category: 'shipping-delivery', question: 'Wie wird mein Neonschild verpackt?', answer: 'Die Neonschilder werden mit Schutzecken geliefert, um so gut wie möglich Transportschäden zu meiden. Die Neonschilder sind in Luftpolsterfolie verpackt und das externe Zubehör wie das Montagematerial, Adapter, Dimmer und Kontroller sind in einem stabilen Karton verpackt.' },
  { id: 6, category: 'shipping-delivery', question: 'Muss ich für den internationalen Versand Steuern zahlen?', answer: 'Innerhalb der EU fallen keine zusätzlichen Einfuhrgebühren an. Die Mehrwertsteuer ist bereits im Preis enthalten. Bei Lieferungen aus Nicht-EU-Ländern können Einfuhrsteuern und ggf. Zollgebühren anfallen. Diese sind vom Empfänger zu tragen und hängen vom Warenwert und Zielland ab.' },
  { id: 7, category: 'product-usage', question: 'Für welche Anlässe eignen sich die LED-Schilder?', answer: 'Unsere personalisierten LED-Schilder sind perfekt für Hochzeiten, Geburtstage, Kinderzimmer, Gaming-Setups, Unternehmen, Events oder als besonderes Geschenk.' },
  { id: 8, category: 'product-usage', question: 'Sind die LED-Schilder sicher und energiesparend?', answer: 'Ja! Unsere LED-Schilder sind energieeffizient, langlebig und werden nicht heiß wie herkömmliche Neonröhren. Sie sind sicher für Wohnräume, Events etc.' },
  { id: 9, category: 'product-usage', question: 'Kann ich die Neonschilder auch draußen im Freien verwenden?', answer: 'Ja, Sie können bei der Konfiguration drinnen oder draußen wählen. Unsere Outdoor-Modelle haben die Schutzart IP65.' },
  { id: 10, category: 'installation', question: 'Muss ich für die Montage handwerklich begabt sein?', answer: 'Nein, da die Leuchtreklamen einschließlich sämtlichen Zubehörs gebrauchsfertig geliefert und an einer Acryl-Trägerplatte befestigt werden, sind keine technischen Kenntnisse erforderlich. Die Rückplatte selbst ist bereits mit Befestigungspunkten versehen.' },
  { id: 11, category: 'warranty-return', question: 'Sind personalisierte Neonschilder vom Austausch ausgeschlossen?', answer: 'Da es sich um eine individuelle Sonderanfertigung handelt, sind personalisierte Produkte vom Widerruf ausgeschlossen. Sollte aber eine Beschädigung oder ein Fehler vorhanden sein, finden wir selbstverständlich eine schnelle Lösung.' },
  { id: 12, category: 'warranty-return', question: 'Gibt es eine Garantie?', answer: 'Ja, die Garantie auf unsere LED-Neonschilder für den Innenbereich umfasst eine Garantie von 2 Jahren. Die Garantie auf die Außenleuchtreklamen hat eine Garantie von 1 Jahr.' },
]

function getTooltipImg(val, map) {
  if (!val) return null
  const lower = val.toLowerCase()
  return map[lower] || map[Object.keys(map).find(k => lower.includes(k))] || null
}

// ─── GALLERY ─────────────────────────────────────────────────────────────────
function Gallery({ images }) {
  const [current, setCurrent] = useState(0)
  const [next, setNext] = useState(null)
  const [slideDir, setSlideDir] = useState(null)
  const [animating, setAnimating] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [lbVisible, setLbVisible] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 } })
  const ZOOM = 1.6
  const total = images.length
  const DURATION = 320

  const goTo = useCallback((idx, dir) => {
    if (animating) return
    const nxt = ((idx % total) + total) % total
    if (nxt === current) return
    setNext(nxt); setSlideDir(dir); setAnimating(true)
    setTimeout(() => { setCurrent(nxt); setNext(null); setSlideDir(null); setAnimating(false) }, DURATION)
  }, [current, total, animating])

  const goPrev = useCallback((e) => { e?.stopPropagation(); goTo(current - 1, 'right') }, [current, goTo])
  const goNext = useCallback((e) => { e?.stopPropagation(); goTo(current + 1, 'left') }, [current, goTo])

  useEffect(() => {
    if (lightbox) {
      document.body.style.overflow = 'hidden'
      let raf2
      const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setLbVisible(true)) })
      return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); document.body.style.overflow = '' }
    }
    setLbVisible(false)
    document.body.style.overflow = ''
  }, [lightbox])

  useEffect(() => { setZoomed(false); setPan({ x: 0, y: 0 }) }, [current, lightbox])

  useEffect(() => {
    const handler = (e) => {
      if (lightbox) {
        if (e.key === 'Escape') setLightbox(false)
        if (e.key === 'ArrowLeft' && current > 0) setCurrent(c => c - 1)
        if (e.key === 'ArrowRight' && current < total - 1) setCurrent(c => c + 1)
        return
      }
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox, current, total, goPrev, goNext])

  // Handy: Bild folgt dem Finger beim Wischen
  const mainRef = useRef(null)
  const tRef = useRef({ x: 0, y: 0, dir: null, swiped: false })
  const [drag, setDrag] = useState(0)
  const [snap, setSnap] = useState(null) // Ziel-Offset in % während der Einrast-Animation
  useEffect(() => {
    const el = mainRef.current
    if (!el || total < 2) return
    const onStart = (e) => { if (animating) return; tRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dir: null, swiped: false }; setSnap(null) }
    const onMove = (e) => {
      const t = tRef.current
      const dx = e.touches[0].clientX - t.x, dy = e.touches[0].clientY - t.y
      if (!t.dir) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; t.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v' }
      if (t.dir !== 'h') return
      e.preventDefault()
      let d = dx
      if ((current === 0 && d > 0) || (current === total - 1 && d < 0)) d = d / 3 // Rand: leicht gebremst
      setDrag(d)
    }
    const onEnd = () => {
      const t = tRef.current
      if (t.dir !== 'h') return
      t.swiped = true
      const w = el.offsetWidth || 1
      const d = drag
      if (d < -w * 0.18 && current < total - 1) { setSnap(-100); setTimeout(() => { setCurrent(c => c + 1); setSnap(null); setDrag(0) }, 260) }
      else if (d > w * 0.18 && current > 0) { setSnap(100); setTimeout(() => { setCurrent(c => c - 1); setSnap(null); setDrag(0) }, 260) }
      else { setSnap(0); setTimeout(() => { setSnap(null); setDrag(0) }, 260) }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd) }
  }, [current, total, animating, drag])
  const swiping = drag !== 0 || snap !== null
  const stripX = snap !== null ? `${snap}%` : `${drag}px`

  if (total === 0) return (
    <div style={{ borderRadius: 18, background: '#f5f5f5', border: '1px solid #eee', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 14, color: '#ccc' }}>Vorschau-Bild</span>
    </div>
  )

  return (
    <>
      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(false)} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.96)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <div style={{ position: 'absolute', top: 20, left: 24, display: 'flex', alignItems: 'center', gap: 14, zIndex: 2, color: '#fff' }}>
            {total > 1 && <span style={{ fontSize: 13, opacity: 0.75 }}>{current + 1} / {total}</span>}
                       <button onClick={(e) => { e.stopPropagation(); setPan({ x: 0, y: 0 }); setZoomed(z => !z) }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: '#fff' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.75 }}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
            </button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setLightbox(false) }} style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: '#fff', fontSize: 38, cursor: 'pointer', lineHeight: 1, opacity: 0.75, zIndex: 2 }}>×</button>
          <img
            src={images[current]}
            alt="Vollbild"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => {
              e.stopPropagation()
              if (!zoomed) return
              dragRef.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, startPan: { ...pan } }
              setIsDragging(true)
            }}
            onMouseMove={(e) => {
              if (!dragRef.current.dragging) return
              const dx = e.clientX - dragRef.current.startX
              const dy = e.clientY - dragRef.current.startY
              if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true
              const maxPanX = (window.innerWidth * (ZOOM - 1)) / 2
              const maxPanY = (window.innerHeight * (ZOOM - 1)) / 2
              setPan({
                x: Math.max(-maxPanX, Math.min(maxPanX, dragRef.current.startPan.x + dx)),
                y: Math.max(-maxPanY, Math.min(maxPanY, dragRef.current.startPan.y + dy)),
              })
            }}
            onMouseUp={(e) => {
              e.stopPropagation()
              const wasDragging = dragRef.current.moved
              dragRef.current.dragging = false
              setIsDragging(false)
              if (!zoomed) { setZoomed(true); return }
              if (!wasDragging) { setZoomed(false); setPan({ x: 0, y: 0 }) }
            }}
            onMouseLeave={() => { if (dragRef.current.dragging) { dragRef.current.dragging = false; setIsDragging(false) } }}
            style={{
              height: '100vh',
              width: 'auto',
              maxWidth: '100vw',
              objectFit: 'contain',
              display: 'block',
              userSelect: 'none',
              cursor: zoomed ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${(lbVisible ? 1 : 0.9) * (zoomed ? ZOOM : 1)})`,
              opacity: lbVisible ? 1 : 0,
              transition: isDragging ? 'none' : (zoomed ? 'transform .25s ease' : 'transform .28s cubic-bezier(.2,.8,.2,1), opacity .28s ease'),
            }}
          />
          {total > 1 && current > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setCurrent(c => c - 1) }} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          {total > 1 && current < total - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setCurrent(c => c + 1) }} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
        </div>
      )}

      {/* MAIN */}
      <div ref={mainRef} onClick={() => { if (tRef.current.swiped) { tRef.current.swiped = false; return } setLightbox(true) }} style={{ borderRadius: 18, overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', aspectRatio: '4/3', position: 'relative', cursor: 'zoom-in', touchAction: 'pan-y' }}>
        {swiping && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, transform: `translateX(${stripX})`, transition: snap !== null ? 'transform 260ms ease' : 'none' }}>
            {current > 0 && <img src={images[current - 1]} alt="" style={{ position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%', objectFit: 'cover' }} />}
            <img src={images[current]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            {current < total - 1 && <img src={images[current + 1]} alt="" style={{ position: 'absolute', top: 0, left: '100%', width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
        )}
        <img src={images[current]} alt={`Neon Sign ${current + 1}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: animating ? (slideDir === 'left' ? 'translateX(-100%)' : 'translateX(100%)') : 'translateX(0)', transition: animating ? `transform ${DURATION}ms ease` : 'none', zIndex: 1 }} />
        {animating && next !== null && (
          <img src={images[next]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', animation: `slideIn${slideDir === 'left' ? 'Right' : 'Left'} ${DURATION}ms ease forwards`, zIndex: 2 }} />
        )}
        <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}@keyframes slideInLeft{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
        {total > 1 && current > 0 && <button onClick={goPrev} style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.92)', border: '1px solid #eee', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg></button>}
        {total > 1 && current < total - 1 && <button onClick={goNext} style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.92)', border: '1px solid #eee', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg></button>}
      </div>

      {total > 1 && (
        <div className="g-dots">{images.map((_, i) => <span key={i} className={i === current ? 'on' : ''} />)}</div>
      )}

      {/* THUMBNAILS */}
      {total > 1 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          {images.map((src, i) => (
            <div key={i} onClick={() => goTo(i, i > current ? 'left' : 'right')} style={{ width: 80, height: 60, borderRadius: 10, overflow: 'hidden', border: `2px solid ${i === current ? '#60c8f0' : 'transparent'}`, cursor: 'pointer', transition: 'border-color 0.15s', flexShrink: 0, background: '#f5f5f5' }}>
              <img src={src} alt={`Vorschau ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── CONTACT CARD ────────────────────────────────────────────────────────────
function ContactCard({ displayId, projectName }) {
  const [msg, setMsg] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const send = async () => {
    if (!msg.trim()) { setStatus('err'); return }
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, offerNum: displayId, customerName: projectName }) })
      const data = await res.json()
      if (data.success) { setStatus('ok'); setMsg('') } else throw new Error()
    } catch { setStatus('err') }
    setLoading(false)
  }

  return (
    <div className="contact-card" style={{ marginTop: 20, background: '#fff', border: '1px solid #eee', borderRadius: 16, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_19_21_39_800x800.png?v=1778783280" alt="Support" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 3 }}>Noch Fragen oder Änderungswünsche?</div>
          <div style={{ fontSize: 14, color: '#999', lineHeight: 1.4 }}>Teilen Sie uns diese direkt hier mit – wir melden uns schnellstmöglich.</div>
        </div>
      </div>
      <textarea className="contact-ta" value={msg} onChange={e => setMsg(e.target.value)} placeholder="z.B. Kann die Farbe noch angepasst werden? Ich benötige Expressversand..." rows={3} style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 10, padding: '13px 15px', fontSize: 14, color: '#111', resize: 'vertical', minHeight: 88, fontFamily: 'inherit', outline: 'none', display: 'block', marginBottom: 12, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={send} disabled={loading} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 22px', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.5 : 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,12 2,6" /></svg>
          {loading ? 'Wird gesendet...' : 'Per E-Mail senden'}
        </button>
        {/* ✅ WhatsApp-Link fix: +49 statt 49 */}
        <a href="https://wa.me/+4917656197641" target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 17, height: 17 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.833L.057 23.077a.75.75 0 0 0 .916.932l5.453-1.431A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.712 9.712 0 0 1-4.953-1.355l-.355-.21-3.676.964.983-3.589-.23-.368A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
          Per WhatsApp senden
        </a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 1 }}>Oder rufen Sie uns an</div>
          <a href="tel:+4917656197641" style={{ fontSize: 14, fontWeight: 600, color: '#111', textDecoration: 'none' }}>+49 176 56197641</a>
        </div>
      </div>
      {status === 'ok' && <div style={{ fontSize: 13, marginTop: 10, padding: '9px 13px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>Nachricht gesendet! Wir melden uns bald.</div>}
      {status === 'err' && <div style={{ fontSize: 13, marginTop: 10, padding: '9px 13px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>{msg.trim() ? 'Fehler. Bitte direkt an info@neonframe.de schreiben.' : 'Bitte eine Nachricht eingeben.'}</div>}
    </div>
  )
}

// ─── DESC ROW (always open) ───────────────────────────────────────────────────
function DescRow({ icon, title, children }) {
  return (
    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 32px 10px' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#fff' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#60c8f0" strokeWidth="2" style={{ width: 16, height: 16 }}>{icon}</svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{title}</span>
      </div>
      <div style={{ padding: '0 32px 20px 82px', fontSize: 14, color: '#555', lineHeight: 1.8 }}>{children}</div>
    </div>
  )
}

// ─── SECURE PAYMENT ───────────────────────────────────────────────────────────
function SecurePayment() {
  return (
    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
      <span style={{ fontSize: 13, color: '#555' }}>Sichere Zahlung · Alle gängigen Zahlungsmethoden akzeptiert</span>
    </div>
  )
}

// ─── STEPPER ─────────────────────────────────────────────────────────────────
const STATUS_INDEX = { offer_sent: 1, confirmed: 2, in_production: 3, shipped: 4 }

function Stepper({ status }) {
  const steps = ['Anfrage gesendet', 'Angebot erhalten', 'Bestellt', 'In Produktion', 'Lieferung']
  const activeIdx = STATUS_INDEX[status] ?? 1

  return (
    <div style={{ background: '#f9fafb', borderBottom: '1px solid #eee', padding: '14px 52px' }} className="stepper-bar">
      <style>{`@media(max-width:900px){.stp-lbl{display:none!important}.stepper-bar{display:none!important}}`}</style>
      <div style={{ maxWidth: 1380, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
        {steps.map((step, i) => {
          const done = i <= activeIdx
          return (
            <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: done ? '#16a34a' : '#e5e7eb', border: `2px solid ${done ? '#16a34a' : '#d1d5db'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {done
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
                    : <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9ca3af', display: 'block' }} />
                  }
                </div>
                <span className="stp-lbl" style={{ fontSize: 12, fontWeight: done ? 600 : 400, color: done ? '#15803d' : '#9ca3af', whiteSpace: 'nowrap' }}>{step}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < activeIdx ? '#16a34a' : '#e5e7eb', margin: '0 10px' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
function FaqSection() {
  const [activeCat, setActiveCat] = useState('order-payment')
  const [openIds, setOpenIds] = useState([])

  const toggleOpen = (id) => {
    setOpenIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const visibleItems = activeCat === 'all' ? faqItems : faqItems.filter(f => f.category === activeCat)

  return (
    <div className="faq-section">
      <div className="faq-header">
        <h2>FAQ</h2>
        <p>Alles, was du über dein Neon-Schild wissen musst.</p>
      </div>
      <div className="faq-filters">
        {faqCategories.map(cat => (
          <button key={cat.id} className={`faq-filter${activeCat === cat.id ? ' active' : ''}`} onClick={() => setActiveCat(cat.id)}>
            {cat.icon} {cat.label}
          </button>
        ))}
        <button className={`faq-filter${activeCat === 'all' ? ' active' : ''}`} onClick={() => setActiveCat('all')}>✨ Alle</button>
      </div>
      <div className="faq-list">
        {visibleItems.length === 0 ? (
          <div className="faq-empty">Keine Fragen in dieser Kategorie.</div>
        ) : (
          visibleItems.map((item) => {
            const isOpen = openIds.includes(item.id)
            return (
              <div key={item.id} className={`faq-item${isOpen ? ' open' : ''}`}>
                <button className="faq-question" onClick={() => toggleOpen(item.id)}>
                  {item.question}
                  <span className="faq-plus">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && <div className="faq-answer">{item.answer}</div>}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function AngebotPage({ offer }) {
  const [descOpen, setDescOpen] = useState(false)
  const sm = sizeModel(offer)
  const [selW, setSelW] = useState(sm.W0)
  const [accepting, setAccepting] = useState(false)
  const [step, setStep] = useState(0)
  const ctaRef = useRef(null)
  const [showBar, setShowBar] = useState(false)
  useEffect(() => {
    const el = ctaRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const sizeInfo = sm.enabled
    ? `Für dieses Design beträgt die Mindestgröße ${sm.minW}\u00a0x\u00a0${sm.heightFor(sm.minW)}\u00a0CM. Kleiner gewünscht? Kontaktiere uns - wir können dein Design eventuell vereinfachen.`
    : (offer.size_warning_enabled && offer.size_warning_text) || ''
  const selH = sm.enabled ? sm.heightFor(selW) : sm.H0

const base = sm.enabled ? sm.listAt(selW) : (parseFloat(offer.base_price) || 0)
const discType = offer.disc_type || 'pct'
const discVal = parseFloat(offer.disc_val) || 0
const vatPct = parseFloat(offer.vat_pct) || 19
const discAmt = discType === 'pct' ? base * (discVal / 100) : discVal
const net = discType === 'pct' ? base * (1 - discVal / 100) : Math.max(0, base - discVal)
const vatAmt = net * (vatPct / 100)
const final = net + vatAmt
  const discDisplay = discType === 'pct' ? `${discVal}%` : `€ ${discVal.toFixed(2)}`
  const colors = parseColors(offer.colors)
  const displayId = offer.offer_num || offer.custom_id || offer.id?.slice(0, 8)

  const angebotsDatum = offer.created_at
    ? new Date(offer.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const images = []
  if (offer.preview_image) images.push(offer.preview_image)
  if (offer.preview_image_2) images.push(offer.preview_image_2)
  if (offer.preview_image_3) images.push(offer.preview_image_3)

  const backplateImg = offer.backplate ? backplateFormImageUrl : null
  const backplateColorImg = offer.backplate_color ? backplateColorImageUrl : null
  const usageImg = offer.usage ? '/email/verwendung.jpg' : null
  const listBrutto = base * (1 + vatPct / 100)
  const discBrutto = discAmt * (1 + vatPct / 100)
  const eur = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const multiPart = (sm.enabled ? selW : (parseFloat(offer.width) || 0)) > 100
  const sizeChanged = sm.enabled && selW !== sm.W0

  async function accept(e) {
    if (!sizeChanged) return // gleiche Größe: normaler Checkout-Link
    e.preventDefault()
    if (accepting) return
    setAccepting(true)
    setStep(0)
    const wait = (ms) => new Promise(r => setTimeout(r, ms))
    const t1 = setTimeout(() => setStep(s => Math.max(s, 1)), 450)
    const t2 = setTimeout(() => setStep(s => Math.max(s, 2)), 900)
    try {
      const r = await fetch('/api/offer-size', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerId: offer.id, width: selW }) })
      const d = await r.json()
      if (d.checkoutUrl) {
        clearTimeout(t1); clearTimeout(t2)
        setStep(3); await wait(500)
        setStep(4); await wait(350)
        window.location.href = d.checkoutUrl
        return
      }
      alert('Da ist etwas schiefgelaufen. Bitte versuche es nochmal oder schreib uns an info@neonframe.de.')
    } catch { alert('Da ist etwas schiefgelaufen. Bitte versuche es nochmal.') }
    clearTimeout(t1); clearTimeout(t2)
    setAccepting(false); setStep(0)
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        html, body { overflow-x:hidden; max-width:100%; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111; background:#fff; -webkit-font-smoothing:antialiased; }
        /* Info-i */
        .ii-wrap { position:relative; display:inline-flex; vertical-align:middle; }
        .ii { width:16px; height:16px; border-radius:50%; background:#b4b4bb; color:#fff; font-size:10px; font-weight:800; font-style:italic; font-family:Georgia,serif; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; text-transform:none; letter-spacing:0; }
        .ii:hover { background:#71717a; }
        .ii.ii-warn { background:#dc2626; font-style:normal; font-family:inherit; animation: warnPulse 1.8s ease-in-out infinite; }
        .ii-pop { display:block; position:fixed; z-index:99999; pointer-events:none; background:#fff; border:1px solid #eee; border-radius:12px; padding:6px; box-shadow:0 12px 34px rgba(0,0,0,.18); }
        .ii-pop img { display:block; width:360px; max-width:calc(100vw - 40px); max-height:calc(100vh - 40px); object-fit:contain; height:auto; border-radius:8px; }
        .ii-pop.wide img { width:620px; max-width:calc(100vw - 40px); } .ii-pop.cwide img { width:640px; max-width:calc(100vw - 40px); } .ii-pop.uwide img { width:640px; max-width:calc(100vw - 40px); } .ii-pop.xwide img { width:860px; max-width:calc(100vw - 40px); }
        .ii-txt { display:block; width:470px; max-width:80vw; padding:8px 10px; font-size:13px; line-height:1.5; color:#333; text-transform:none; letter-spacing:0; font-weight:400; white-space:normal; }
        .ii-modal { position:fixed; inset:0; z-index:99998; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; padding:16px; }
        .ii-modal-box { background:#fff; border-radius:14px; padding:10px; max-width:94vw; display:flex; flex-direction:column; gap:10px; }
        .ii-modal-box img { display:block; max-width:calc(94vw - 20px); max-height:70vh; height:auto; border-radius:8px; }
        .ii-modal-box button { border:0; background:#111; color:#fff; border-radius:10px; padding:11px; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; }
        @media (hover:hover) and (min-width:961px) { .ii-modal { display:none; } }
        /* Angebots-Karte */
        .offer-card { border:1px solid #e8e8e8; border-radius:18px; box-shadow:0 10px 30px rgba(0,0,0,.05); margin-bottom:14px; }
        .oc-head { border-radius:17px 17px 0 0; background:linear-gradient(90deg,#0a0a0a,#13303a); color:#fff; padding:15px 20px; display:flex; align-items:center; gap:14px; }
        .oc-head small { display:block; font-size:10px; letter-spacing:.18em; color:#60c8f0; font-weight:800; }
        .oc-head b { display:block; font-size:21px; font-weight:800; line-height:1.2; word-break:break-word; }
        .oc-star { font-size:24px; color:#60c8f0; text-shadow:0 0 12px rgba(96,200,240,.7); }
        .oc-body { padding:18px 20px 20px; }
        .cfg-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 22px; margin-bottom:16px; }
        .cfg-label { display:flex !important; align-items:center; gap:6px; }
        .size-sel { appearance:none; -webkit-appearance:none; height:40px; padding:0 38px 0 14px; border:1.5px solid #d4d4d8; border-radius:10px; font-size:14px; font-weight:600; font-family:inherit; color:#111; background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 13px center; cursor:pointer; max-width:100%; }
        .size-sel:focus { outline:none; border-color:#60c8f0; }
        .multi-tip { margin-top:8px; font-size:12px; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:6px 10px; line-height:1.45; }
        .oc-price { border-top:1px solid #f0f0f0; padding-top:12px; margin-bottom:14px; }
        .oc-row { display:flex; justify-content:space-between; gap:12px; font-size:14px; color:#555; padding:3px 0; }
        .oc-row.disc { color:#16a34a; font-weight:600; }
        .oc-total { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-top:8px; }
        .oc-total span { font-size:15px; font-weight:700; }
        .oc-total b { font-size:28px; font-weight:900; letter-spacing:-.02em; white-space:nowrap; }
        .oc-vat { text-align:right; font-size:11.5px; color:#888; }
        .offer-card .cta-btn { margin-bottom:0; }
        .oc-legal { text-align:center; font-size:11px; color:#9ca3af; margin-top:8px; }
        /* Sticky-Karte (Option 3): schwingt von unten rein und wieder raus */
        .sticky-buy { position:fixed; left:50%; bottom:18px; z-index:500; width:min(1180px, calc(100% - 32px)); background:rgba(255,255,255,.97); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border:1px solid #e5e7eb; border-radius:22px; box-shadow:0 16px 44px rgba(0,0,0,.16); display:flex; align-items:center; gap:18px; padding:12px 12px 12px 14px; transform:translate(-50%, calc(100% + 40px)); opacity:0; pointer-events:none; transition:transform .45s cubic-bezier(.36,0,.66,-.56), opacity .3s ease .12s; }
        .sticky-buy.show { transform:translate(-50%, 0); opacity:1; pointer-events:auto; transition:transform .65s cubic-bezier(.34,1.56,.64,1), opacity .2s ease; }
        .sb-thumb { width:54px; height:54px; border-radius:12px; object-fit:cover; flex-shrink:0; background:#0b1730; }
        .sb-info { flex:1; min-width:0; }
        .sb-title { font-size:15px; font-weight:800; line-height:1.3; color:#111; }
        .sb-title span { color:#0891b2; }
        .sb-note { font-size:12px; color:#888; margin-top:3px; }
        .sb-badge { background:#dcfce7; color:#166534; font-size:12px; font-weight:800; border-radius:20px; padding:4px 10px; white-space:nowrap; }
        .sb-price { display:flex; flex-direction:column; align-items:flex-end; }
        .sb-price s { font-size:12px; color:#9ca3af; }
        .sb-price b { font-size:23px; font-weight:900; white-space:nowrap; line-height:1.1; }
        .sticky-buy .cta-btn { width:auto; margin:0; padding:15px 28px; font-size:16px; border-radius:16px; }
        .sb-row { display:contents; }
                .sb-space { height:100px; background:#0a0a0a; }
        /* Design E */
        .ve-wrap { margin-top:16px; display:flex; flex-direction:column; }
        .ve-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .ve-ship { background:#f0fbff; border:1px solid #b8e8f8; border-radius:14px; padding:16px; display:flex; flex-direction:column; }
        .ve-ic { width:26px; height:26px; color:#0891b2; margin-bottom:8px; }
        .ve-ship strong, .ve-incl strong { font-size:15px; font-weight:800; color:#111; }
        .ve-ship > span { font-size:13px; color:#666; margin-top:3px; }
        .ve-express { display:flex; align-items:center; gap:6px; margin-top:auto; padding-top:10px; font-size:13px; font-weight:700; color:#0891b2; }
        .ve-express svg { width:15px; height:15px; color:#f59e0b; }
        .ve-express .tt-t { border-bottom-color:#7dd3e8; }
        .tt-box.tt-light { background:#fff; color:#111; font-weight:400; border:1px solid #e5e7eb; box-shadow:0 8px 24px rgba(0,0,0,.12); }
        .tt-box.tt-light::after, .tt-box.tt-light::before { border-top-color:#fff !important; }
        .ve-incl { border:1px solid #eee; border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:8px; }
        .ve-ck { display:flex; align-items:center; gap:8px; font-size:13.5px; color:#444; }
        .ve-ck svg { width:15px; height:15px; color:#16a34a; flex-shrink:0; }
        .ve-strip { display:flex; justify-content:space-between; gap:10px; margin-top:14px; padding-top:13px; border-top:1px solid #eee; }
        .ve-strip span { display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; color:#444; }
        .ve-strip svg { width:17px; height:17px; color:#0891b2; flex-shrink:0; }
        @media(min-width:961px){
          .col-right { display:flex !important; flex-direction:column; }
          .ve-wrap { flex:1; }
          .ve-grid { flex:1; }
        }
        @media(max-width:960px){
          .ve-strip { display:grid; grid-template-columns:1fr 1fr; gap:12px 10px; }
          .ve-ship, .ve-incl { padding:13px; }
          .ve-ck { font-size:12.5px; }
        }
        /* Lade-Fenster */
        .ld-ov { position:fixed; inset:0; z-index:100000; background:rgba(10,10,12,.55); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:16px; animation:ldFade .2s ease; }
        .ld-card { background:#fff; border-radius:22px; box-shadow:0 30px 80px rgba(0,0,0,.35); width:100%; max-width:420px; padding:30px 30px 26px; text-align:center; animation:ldPop .35s cubic-bezier(.34,1.56,.64,1); }
        .ld-h { font-size:21px; font-weight:900; color:#111; }
        .ld-p { font-size:13.5px; color:#666; margin-top:4px; }
        .ld-steps { text-align:left; margin-top:20px; display:flex; flex-direction:column; gap:12px; }
        .ld-st { display:flex; align-items:center; gap:11px; font-size:14px; font-weight:600; color:#111; transition:color .25s; }
        .ld-st b { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; transition:all .25s; }
        .ld-st.ok b { background:#16a34a; color:#fff; animation:ldPop .3s ease; }
        .ld-st.now b { border:3px solid #22d3ee; border-top-color:transparent; animation:ldSpin .8s linear infinite; }
        .ld-st.wait { color:#aaa; }
        .ld-st.wait b { border:2px solid #ddd; }
        @keyframes ldSpin { to { transform:rotate(360deg); } }
        @keyframes ldFade { from { opacity:0; } to { opacity:1; } }
        @keyframes ldPop { from { transform:scale(.85); opacity:0; } to { transform:scale(1); opacity:1; } }
        @media(max-width:960px){ .ld-card { max-width:330px; padding:24px 20px 22px; } .ld-h { font-size:18px; } .ld-st { font-size:13px; } }
        /* Desktop: links und rechts gleich lang – Fragen-Box wächst bis zur Unterkante */
        @media(min-width:961px){
          .page-wrap { align-items:stretch !important; }
          .col-left { display:flex !important; flex-direction:column; }
          .col-left .contact-card { flex:1; display:flex; flex-direction:column; }
          .col-left .contact-ta { flex:1; resize:none !important; }
        }
        @media(max-width:960px){ .sb-space { display:none; } }
        @media(max-width:960px){
          .cfg-grid { gap:14px 14px; }
          .oc-total b { font-size:24px; }
          .sticky-buy { left:10px; right:10px; width:auto; bottom:calc(12px + env(safe-area-inset-bottom)); flex-direction:column; align-items:stretch; gap:9px; padding:12px; border-radius:20px; transform:translateY(calc(100% + 40px)); }
          .sticky-buy.show { transform:translateY(0); }
          .sb-thumb, .sb-note, .sb-badge { display:none; }
          .sb-title { font-size:12.5px; }
          .sb-row { display:flex; align-items:center; gap:12px; }
          .sb-price { align-items:flex-start; }
          .sb-price s { font-size:11px; }
          .sb-price b { font-size:19px; }
          .sticky-buy .cta-btn { flex:1; padding:13px; font-size:15px; border-radius:13px; }
          .site-footer { padding-bottom:150px; }
        }
        .hdr { background:#0a0a0a; padding:0 52px; height:96px; display:flex; align-items:center; justify-content:space-between; position:relative; z-index:100; }
        @media(max-width:900px){ .hdr { padding:0 16px; height:64px; } }
        .hdr-badge { background:rgba(96,200,240,.12); border:1px solid rgba(96,200,240,.3); color:#60c8f0; font-size:14px; font-weight:600; padding:9px 18px; border-radius:20px; display:flex; align-items:center; gap:6px; white-space:nowrap; }
        .valid-badge { background:rgba(96,200,240,.12); border:1px solid rgba(96,200,240,.3); color:#60c8f0; font-size:14px; font-weight:600; padding:9px 18px; border-radius:20px; display:flex; align-items:center; gap:6px; white-space:nowrap; }
        .hdr-logo { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); }
        @media(max-width:900px){ .hdr-logo img { height:46px !important; } .hdr-badge { font-size:11px; padding:6px 10px; } .valid-badge { font-size:11px; padding:6px 10px; } }
        @media(max-width:900px){ .hdr img { height:52px !important; } }
        /* Desktop layout */
        .page-wrap { max-width:1380px; margin:0 auto; padding:52px 52px 60px; display:grid; grid-template-columns:1.3fr 1fr; gap:72px; align-items:start; }
        /* Mobile layout */
        @media(max-width:960px){
          .page-wrap { grid-template-columns:1fr; gap:0; padding:14px 14px 0; }
          .col-left { display:none; }
          .col-right { display:flex; flex-direction:column; }
          .mob-gallery { display:block !important; }
          .mob-contact { display:block !important; margin-top:24px; margin-bottom:28px; }
        @media(max-width:960px){
          .desc-section { margin-top:24px; }
          .desc-header { flex-wrap:wrap; gap:8px; align-items:center; }
          .desc-badge-pill { font-size:11px; }
        }
        }
        .mob-gallery { display:none; }
        .g-dots { display:none; }
        @media(max-width:960px){ .g-dots { display:flex; justify-content:center; gap:6px; margin-top:10px; } .g-dots span { width:7px; height:7px; border-radius:50%; background:#d4d4d8; transition:all .2s; } .g-dots span.on { width:20px; border-radius:4px; background:#60c8f0; } }
        .mob-contact { display:none; }
        /* Config */
        .cfg-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#111; display:block; margin-bottom:5px; }
        .cfg-pill { display:inline-flex; align-items:center; gap:7px; background:#f5f5f5; border:1px solid #e8e8e8; border-radius:20px; padding:7px 14px; font-size:13px; font-weight:500; color:#333; }
        .color-dot { width:11px; height:11px; border-radius:50%; border:1.5px solid rgba(0,0,0,.08); display:inline-block; flex-shrink:0; animation: dotGlow 2.2s ease-in-out infinite; }
        .color-dot.rgb { border:none; animation: colorCycleRGB 6s ease-in-out infinite, dotGlow 2.2s ease-in-out infinite; }
        @keyframes dotGlow { 0%,100% { box-shadow:0 0 0 0 currentColor; } 50% { box-shadow:0 0 7px 2px currentColor; } }
        @keyframes colorCycleRGB {
          0%   { background:#ff0055; color:#ff0055; }
          16%  { background:#ff9900; color:#ff9900; }
          33%  { background:#ffee00; color:#ffee00; }
          50%  { background:#33ff00; color:#33ff00; }
          66%  { background:#00eeff; color:#00eeff; }
          83%  { background:#3300ff; color:#3300ff; }
          100% { background:#ff0055; color:#ff0055; }
        }
        .img-tt { position:relative; display:inline-flex; }
        .img-tt-box { display:none; opacity:0; visibility:hidden; position:absolute; top:calc(100% + 10px); left:50%; transform:translateX(-50%) translateY(-6px); background:#fff; border:1px solid #eee; border-radius:12px; padding:6px; box-shadow:0 8px 30px rgba(0,0,0,.12); z-index:200; pointer-events:none; transition: opacity .18s ease, transform .18s ease, visibility .38s; }
        .img-tt-box::after { content:''; position:absolute; bottom:100%; left:50%; transform:translateX(-50%); border:8px solid transparent; border-bottom-color:#fff; }
        .img-tt-box img { display:block; border-radius:8px; }
        .img-tt-box.square { background:#000; }
        .img-tt-box.square img { width:700px; height:300px; object-fit:cover; object-position:center bottom; }
        .img-tt-box.plain img { width:350px; height:350px; object-fit:contain; }
        .img-tt-box.wide img { width:650px; height:auto; object-fit:contain; }
        .img-tt:hover .img-tt-box { opacity:1; visibility:visible; transform:translateX(-50%) translateY(0); }
        .tt { position:relative; display:inline; }
        .tt-t { border-bottom:1px dashed #ccc; cursor:default; }
        .tt-box { display:none; position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%); background:#111; color:#f0f0f0; font-size:12px; padding:9px 13px; border-radius:8px; white-space:nowrap; z-index:50; pointer-events:none; line-height:1.6; }
        .tt-box::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:5px solid transparent; border-top-color:#111; }
        .tt:hover .tt-box { display:block; }
        .tt-box.warn-box { white-space:normal; width:260px; text-align:left; background:#fff; color:#111; font-size:14px; border:1px solid #eee; box-shadow:0 8px 24px rgba(0,0,0,.12); }
        .tt-box.warn-box::after { border-top-color:#fff; }
        .size-warn-badge { display:inline-flex; align-items:center; justify-content:center; width:15px; height:15px; border-radius:50%; background:#dc2626; color:#fff; font-size:10px; font-weight:800; cursor:help; flex-shrink:0; animation: warnPulse 1.8s ease-in-out infinite; }
        @keyframes warnPulse { 0%,100% { box-shadow:0 0 0 0 rgba(220,38,38,.5); } 50% { box-shadow:0 0 0 5px rgba(220,38,38,0); } }
        .prod-title { font-size:30px; font-weight:800; line-height:1.2; color:#111; margin-bottom:10px; letter-spacing:-.02em; }
        @media(max-width:960px){ .prod-title { font-size:24px; } }
        .stars-row { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
        .checks { margin-bottom:20px; display:flex; flex-direction:column; gap:9px; }
        .check-row { display:flex; align-items:flex-start; gap:10px; font-size:14px; color:#555; line-height:1.5; }
        .check-icon { width:18px; height:18px; flex-shrink:0; margin-top:2px; color:#22c55e; }
        /* Price */
        .price-section { background:#fff; border:1px solid #e8e8e8; border-radius:14px; padding:18px 20px; margin-bottom:14px; }
        .price-table { width:100%; border-collapse:collapse; }
        .price-table td { padding:4px 0; font-size:14px; vertical-align:middle; color:#111; }
        .price-table td:last-child { text-align:right; font-weight:500; }
        .pr-disc td { color:#16a34a !important; font-weight:600; }
        .pr-divider td { border-top:1px solid #f0f0f0; padding-top:10px; }
        .pr-total td:first-child { font-size:15px; font-weight:700; color:#111; padding-top:4px; }
        .pr-total td:last-child { font-size:22px; font-weight:800; color:#111; padding-top:4px; letter-spacing:-.02em; white-space:nowrap; }
        /* Ship */
        .ship-box { background:#f0fbff; border:1px solid #b8e8f8; border-radius:13px; padding:13px 16px; display:flex; align-items:flex-start; gap:12px; margin-bottom:7px; }
        .ship-icon { width:20px; height:20px; flex-shrink:0; margin-top:2px; color:#60c8f0; }
        .ship-text strong { display:block; font-size:14px; font-weight:700; color:#111; margin-bottom:2px; }
        .ship-text span { font-size:12px; color:#888; }
        .express-row { display:flex; align-items:center; gap:7px; font-size:13px; color:#999; margin-bottom:18px; margin-top:6px; }
        .express-icon { width:14px; height:14px; color:#f59e0b; flex-shrink:0; }
        /* CTA */
        .cta-btn { width:100%; background:#16a34a; color:#fff; border:none; border-radius:13px; padding:18px; font-size:17px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:8px; font-family:inherit; transition:background .15s, transform .1s; text-decoration:none; }
        .cta-btn:hover { background:#15803d; transform:translateY(-1px); }
        .cta-btn svg { width:20px; height:20px; }
        /* Features */
        .features { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
        .feat { background:#fff; border:1px solid #eee; border-radius:12px; padding:14px; display:flex; align-items:flex-start; gap:11px; }
        .feat:hover { border-color:#b8e8f8; }
        .feat-icon-wrap { width:36px; height:36px; background:#f0fbff; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid #d0f0fc; }
        .feat-icon-wrap svg { width:18px; height:18px; color:#60c8f0; }
        .feat-title { display:block; font-size:13px; font-weight:700; color:#111; margin-bottom:3px; }
        .feat-sub { font-size:11px; color:#888; line-height:1.5; }
        /* Produktbeschreibung */
        .desc-section { max-width:1380px; margin:0 auto; padding:0 52px 90px; }
        @media(max-width:960px){ .desc-section { padding:0 14px 60px; } }
        .desc-wrap { border:1px solid #eee; border-radius:18px; overflow:hidden; }
        .desc-header { padding:22px 32px; border-bottom:1px solid #f0f0f0; background:#fafafa; display:flex; align-items:center; justify-content:space-between; }
        .desc-header h2 { font-size:20px; font-weight:800; color:#111; }
        .desc-badge-pill { font-size:12px; color:#888; background:#fff; border:1px solid #eee; border-radius:20px; padding:5px 14px; }
        /* Fade + Mehr anzeigen */
        .pb-fade { max-height:72px; overflow:hidden; position:relative; font-size:14px; color:#555; line-height:1.8; }
        .pb-fade::after { content:''; position:absolute; bottom:0; left:0; right:0; height:40px; background:linear-gradient(to bottom,transparent,#fff); pointer-events:none; }
        .mehr-btn { display:inline-flex; align-items:center; gap:7px; background:none; border:1.5px solid #60c8f0; color:#60c8f0; border-radius:24px; padding:8px 20px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; margin-top:14px; transition:background .15s,color .15s; }
        .mehr-btn:hover { background:#60c8f0; color:#fff; }
        .weniger-btn { display:inline-flex; align-items:center; gap:7px; background:none; border:1.5px solid #60c8f0; color:#60c8f0; border-radius:24px; padding:8px 20px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; margin-top:14px; transition:background .15s,color .15s; }
        .weniger-btn:hover { background:#60c8f0; color:#fff; }
        .gallery-section { max-width:1380px; margin:0 auto; padding:0 52px 90px; }
        @media(max-width:960px){ .gallery-section { padding:0 14px 60px; } }
        .gallery-wrap { border:1px solid #eee; border-radius:18px; overflow:hidden; }
        .gallery-header { padding:22px 32px; border-bottom:1px solid #f0f0f0; background:#fafafa; display:flex; align-items:center; justify-content:space-between; }
        .gallery-header h2 { font-size:20px; font-weight:800; color:#111; }
        .gallery-badge-pill { font-size:12px; color:#888; background:#fff; border:1px solid #eee; border-radius:20px; padding:5px 14px; }
        .customer-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; padding:28px 32px; }
        .customer-tile { position:relative; aspect-ratio:1/1; border-radius:12px; overflow:hidden; border:1px solid #eee; background:#f5f5f5; }
        .customer-tile.tall { grid-row:span 2; aspect-ratio:1/2; }
        .customer-tile img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .4s ease; }
        .customer-tile:hover img { transform:scale(1.06); }
        @media(max-width:960px){
          .customer-grid { grid-template-columns:repeat(2,1fr); padding:20px; }
          .customer-tile.tall { grid-row:span 1; aspect-ratio:1/1; }
        }
        .compare-section { max-width:1380px; margin:0 auto; padding:0 52px 60px; }
        @media(max-width:960px){ .compare-section { padding:0 14px 40px; } }
        .compare-header { text-align:center; margin-bottom:28px; }
        .compare-header h2 { font-size:clamp(26px,4vw,36px); font-weight:900; color:#111; letter-spacing:-.02em; margin-bottom:10px; }
        .compare-header .brand-accent { background:linear-gradient(90deg,#60c8f0,#0091c9); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .compare-header p { max-width:600px; margin:0 auto; font-size:14.5px; color:#6b6b6b; line-height:1.6; }
        .compare-table { border:1px solid #eaeaea; border-radius:18px; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,.03), 0 12px 32px rgba(0,0,0,.04); }
        .compare-row { display:grid; grid-template-columns:1.4fr 1fr 1fr; padding:18px 28px; align-items:center; gap:12px; border-bottom:1px solid #f4f4f4; }
        .compare-row:last-child { border-bottom:none; }
        .compare-row-head { background:#fafafa; }
        .compare-row-head .cmp-cell { font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#999; }
        .cmp-brand { color:#0091c9; }
        .cmp-feat { font-size:14px; font-weight:600; color:#111; }
        .cmp-brand-val { font-size:14px; font-weight:700; color:#111; }
        .cmp-other-val { font-size:14px; color:#9a9a9a; }
        .cmp-icon { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; font-size:11px; font-weight:900; }
        .cmp-check { background:#60c8f0; color:#fff; box-shadow:0 0 0 4px rgba(96,200,240,.14); }
        .cmp-cross { background:#f0f0f0; color:#bbb; }
        @media(max-width:960px){
          .compare-row, .compare-row-head { grid-template-columns:1.2fr 1fr 1fr; padding-left:16px; padding-right:16px; }
          .cmp-feat, .cmp-brand-val, .cmp-other-val { font-size:12.5px; }
        }
        .video-section { max-width:1380px; margin:0 auto; padding:0 52px 60px; }
        @media(max-width:960px){ .video-section { padding:0 14px 40px; } }
        .video-card { display:grid; grid-template-columns:1.1fr 1fr; border:1px solid #eaeaea; border-radius:18px; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,.03), 0 12px 32px rgba(0,0,0,.04); }
        .video-wrap { position:relative; background:#000; }
        .montage-video { width:100%; height:100%; display:block; object-fit:cover; }
        .video-text { padding:36px 40px; display:flex; flex-direction:column; justify-content:center; }
        .video-badge { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; color:#0091c9; background:rgba(96,200,240,.12); padding:5px 12px; border-radius:20px; width:fit-content; margin-bottom:14px; text-transform:uppercase; letter-spacing:.05em; }
        .video-text h3 { font-size:22px; font-weight:800; margin:0 0 14px; letter-spacing:-.01em; color:#111; }
        .video-steps { display:flex; flex-direction:column; gap:12px; margin:0; padding:0; list-style:none; }
        .video-steps li { display:flex; align-items:flex-start; gap:12px; font-size:14px; color:#444; line-height:1.5; }
        .step-num { width:24px; height:24px; border-radius:50%; background:#60c8f0; color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
        @media(max-width:760px){
          .video-card { grid-template-columns:1fr; }
          .montage-video { aspect-ratio:16/9; }
          .video-text { padding:26px 24px; }
        }
        .faq-section { max-width:1380px; margin:0 auto; padding:0 52px 90px; }
        @media(max-width:960px){ .faq-section { padding:0 14px 60px; } }
        .faq-header { text-align:center; margin-bottom:26px; }
        .faq-header h2 { font-size:clamp(26px,4vw,36px); font-weight:900; color:#111; letter-spacing:-.02em; margin-bottom:8px; }
        .faq-header p { font-size:14.5px; color:#6b6b6b; }
        .faq-filters { display:flex; flex-wrap:wrap; justify-content:center; gap:10px; margin-bottom:28px; }
        .faq-filter { border:1px solid #e0e0e0; background:#fff; color:#111; border-radius:999px; padding:10px 16px; font-size:13.5px; font-weight:700; cursor:pointer; transition:.2s; display:inline-flex; align-items:center; gap:7px; font-family:inherit; }
        .faq-filter:hover { border-color:#60c8f0; color:#0091c9; background:#f0fbff; }
        .faq-filter.active { background:linear-gradient(90deg,#60c8f0,#0091c9); color:#fff; border-color:transparent; }
        .faq-list { display:flex; flex-direction:column; gap:12px; }
        .faq-item { border:1px solid #eee; border-radius:14px; overflow:hidden; background:#fff; }
        .faq-question { width:100%; background:#fafafa; border:none; padding:18px 22px; display:flex; justify-content:space-between; align-items:center; gap:16px; cursor:pointer; color:#111; font-size:15px; font-weight:700; text-align:left; font-family:inherit; }
        .faq-item.open .faq-question { background:#fff; border-bottom:1px solid #f0f0f0; }
        .faq-plus { flex-shrink:0; color:#0091c9; font-size:18px; font-weight:700; }
        .faq-answer { padding:16px 22px 20px; font-size:14px; color:#555; line-height:1.7; }
        .faq-empty { text-align:center; padding:24px; color:#999; font-size:14px; }
        @media(max-width:960px){
          .faq-filter { font-size:12.5px; padding:9px 13px; }
          .faq-question { font-size:14px; padding:15px 18px; }
          .faq-answer { font-size:13.5px; padding:14px 18px 18px; }
        }
        .site-footer { background:#0a0a0a; }
        .footer-inner { max-width:1380px; margin:0 auto; padding:44px 52px 40px; display:grid; grid-template-columns:1.2fr 1fr; gap:32px; }
        @media(max-width:960px){ .footer-inner { padding:32px 14px 30px; } }
        .footer-logo { margin-bottom:14px; }
        .footer-logo-text { font-size:28px; font-weight:800; letter-spacing:-.01em; }
        .footer-logo-text .neon { color:#fff; }
        .footer-logo-text .frame { color:#60c8f0; text-shadow:0 0 18px rgba(96,200,240,.55); }
        .footer-tagline { font-size:13px; color:#999; margin:0 0 18px; line-height:1.6; max-width:340px; }
        .footer-contact { display:flex; flex-direction:column; gap:8px; }
        .footer-contact-row { display:flex; align-items:center; gap:9px; font-size:13.5px; color:#ccc; text-decoration:none; }
        .footer-contact-row svg { width:15px; height:15px; color:#60c8f0; flex-shrink:0; }
        .footer-right { border-left:1px solid rgba(255,255,255,.1); padding-left:32px; }
        .footer-col-title { font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#666; margin-bottom:12px; }
        .footer-links { display:flex; flex-direction:column; gap:9px; }
        .footer-links a { font-size:13.5px; color:#ccc; text-decoration:none; }
        .footer-links a:hover { color:#60c8f0; }
        .footer-copy { font-size:12px; color:#555; padding-top:24px; margin-top:28px; border-top:1px solid rgba(255,255,255,.08); grid-column:1/-1; text-align:center; }
        @media(max-width:760px){
          .footer-inner { grid-template-columns:1fr; }
          .footer-right { border-left:none; border-top:1px solid rgba(255,255,255,.1); padding-left:0; padding-top:24px; }
        }
      `}</style>

      {/* HEADER */}
      <header className="hdr">
        <a href="https://neonframe.de">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" style={{ height: 78, display: 'block' }} />
        </a>
        {displayId && <div className="hdr-badge">Angebot #{displayId}</div>}
      </header>



      <div className="page-wrap">
        {/* LEFT col — desktop only */}
        <div className="col-left">
          <Gallery images={images} />
          {offer.customer_note && (
            <div style={{ marginTop: 20, background: '#f5f5f5', border: '1px solid #e8e8e8', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 10 }}>❗ Notizen von NeonFrame:</div>
              <div style={{ fontSize: 14, color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{offer.customer_note}</div>
            </div>
          )}
          <ContactCard displayId={displayId} projectName={offer.project || ''} />
        </div>

        {/* RIGHT col — also contains mobile-only elements */}
        <div className="col-right">

          {/* 1 — Titel */}
          <h1 className="prod-title mob-title">Individuelles LED-Neon-Schild –<br />personalisiert nach Wunsch</h1>

          {/* 2 — Sterne */}
          <div className="stars-row mob-stars">
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {[...Array(4)].map((_, i) => <span key={i} style={{ color: '#f59e0b', fontSize: 20, lineHeight: 1 }}>★</span>)}
              <span style={{ position: 'relative', display: 'inline-block', width: 20, height: 20, fontSize: 20, lineHeight: '20px', color: '#e5e7eb' }}>
                ★<span style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', overflow: 'hidden', color: '#f59e0b', lineHeight: '20px' }}>★</span>
              </span>
            </div>
            <span style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>4,5/5 Sternen</span>
          </div>

          {/* MOBILE ONLY gallery */}
          <div className="mob-gallery" style={{ marginBottom: 16 }}>
            <Gallery images={images} />
          </div>

          {/* ANGEBOTS-KARTE: Name + Konfiguration + Preis + Button */}
          <div className="offer-card">
            {offer.project && (
              <div className="oc-head">
                <span className="oc-star">✦</span>
                <div><small>INDIVIDUELL ANGEFERTIGT FÜR</small><b>{offer.project}</b></div>
              </div>
            )}
            <div className="oc-body">
              <div className="cfg-grid">
                {(offer.width || offer.height) && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span className="cfg-label">Maße (Breite × Höhe)
                      {sizeInfo && <InfoTip text={sizeInfo} />}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      {sm.enabled ? (
                        <select className="size-sel" value={selW} onChange={e => setSelW(Number(e.target.value))}>
                          {sm.widths.map(w => (
                            <option key={w} value={w} disabled={w < sm.minW && w !== sm.W0}>{w} × {sm.heightFor(w)} cm</option>
                          ))}
                        </select>
                      ) : (
                        <div className="cfg-pill">{offer.width && offer.height ? `${offer.width} × ${offer.height} cm` : offer.width || offer.height}</div>
                      )}
                      {multiPart && <InfoTip warn text="Schilder ab 110 cm Breite können aus mehreren Teilen bestehen." />}
                    </div>
                  </div>
                )}
                {colors.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span className="cfg-label">Farbe{colors.length > 1 ? '(n)' : ''} <InfoTip img={colorHoverImage} wide="c" /></span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {colors.map((c, i) => (
                        <div key={i} className="cfg-pill">
                          {c.toLowerCase().includes('full color')
                            ? <span className="color-dot rgb" />
                            : <span className="color-dot" style={{ background: colorDot(c), color: colorDot(c) }} />}
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {offer.backplate && (
                  <div>
                    <span className="cfg-label">Rückwandform {backplateImg && <InfoTip img={backplateImg} wide="x" />}</span>
                    <div className="cfg-pill" style={{ marginTop: 4 }}>{offer.backplate}</div>
                  </div>
                )}
                {offer.backplate_color && offer.backplate?.toLowerCase() !== 'ohne' && (
                  <div>
                    <span className="cfg-label">Rückwandfarbe {backplateColorImg && <InfoTip img={backplateColorImg} wide="x" />}</span>
                    <div className="cfg-pill" style={{ marginTop: 4 }}>{offer.backplate_color}</div>
                  </div>
                )}
                {offer.usage && (
                  <div>
                    <span className="cfg-label">Verwendung {usageImg && <InfoTip img={usageImg} wide="u" />}</span>
                    <div className="cfg-pill" style={{ marginTop: 4 }}>{offer.usage}</div>
                  </div>
                )}
              </div>

              <div className="oc-price">
                {discAmt > 0 && <div className="oc-row"><span>Listenpreis</span><s>{eur(listBrutto)}</s></div>}
                {discAmt > 0 && <div className="oc-row disc"><span>Dein Rabatt ({discDisplay})</span><span>− {eur(discBrutto)}</span></div>}
                <div className="oc-total"><span>Gesamtbetrag</span><b>{final > 0 ? eur(final) : '–'}</b></div>
                <div className="oc-vat">inkl. {vatPct} % MwSt.</div>
              </div>

              <a ref={ctaRef} href={offer.checkout_url || '#'} onClick={accept} className="cta-btn" target={offer.checkout_url && !sizeChanged ? '_blank' : undefined} rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                {accepting ? 'Einen Moment …' : 'Angebot annehmen'}
              </a>
              <div className="oc-legal">Individuelle Anfertigung – kein Widerrufsrecht (§ 312g BGB)</div>
            </div>
          </div>

          {/* Versand | Inklusive + Vorteile (Design E) */}
          <div className="ve-wrap">
            <div className="ve-grid">
              <div className="ve-ship">
                <svg className="ve-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                <strong>Kostenloser Versand</strong>
                <span>{offer.delivery ? `Geliefert zwischen ${offer.delivery}` : 'Lieferzeit 2–3 Wochen'}</span>
                <div className="ve-express">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                  <span className="tt"><span className="tt-t">Express anfragen</span><span className="tt-box tt-light">Expressversand: ca. 7–10 Werktage.<br />Bitte im Anpassungsfeld anfordern.</span></span>
                </div>
              </div>
              <div className="ve-incl">
                <strong>Inklusive</strong>
                {['Montagematerial', 'Fernbedienung & Dimmer', '3 m Kabel + Adapter'].map(t => (
                  <div key={t} className="ve-ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>{t}</div>
                ))}
              </div>
            </div>
            <div className="ve-strip">
              {[
                [<path key="a" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />, 'Qualitätsgarantie'],
                [<><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></>, 'Komplettpaket'],
                [<polygon key="c" points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />, 'Schnelle Montage'],
                [<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>, '100.000 Std. Lebensdauer'],
              ].map(([icon, label], k) => (
                <span key={k}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>{label}</span>
              ))}
            </div>
          </div>

          {/* 12 — Mobile-only contact */}
          <div className="mob-contact">
            {offer.customer_note && (
              <div style={{ marginBottom: 16, background: '#f5f5f5', border: '1px solid #e8e8e8', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 10 }}>Notizen von NeonFrame ❗</div>
                <div style={{ fontSize: 14, color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{offer.customer_note}</div>
              </div>
            )}
            <ContactCard displayId={displayId} projectName={offer.project || ''} />
          </div>

        </div>
      </div>

      {/* PRODUKTBESCHREIBUNG */}
      <div className="desc-section">
        <div className="desc-wrap">
          <div className="desc-header">
            <h2>Produktbeschreibung</h2>
            <div className="desc-badge-pill">PowerLEDs™ Technologie</div>
          </div>

          <div style={{ borderBottom: descOpen ? 'none' : '1px solid #f0f0f0', padding: '18px 32px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#fff' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#60c8f0" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Premium-Beleuchtung</span>
            </div>
            {!descOpen && (
              <div className="pb-fade">
                <p>Die LED-Neon-Röhren sorgen für ein gleichmäßiges, helles Leuchten ohne Flackern oder sichtbare Lichtpunkte. Dank unserer patentierten PowerLEDs™ Technologie ist das Neon-Schild energieeffizient, langlebig und sicher im Gebrauch. Unsere LEDs erreichen eine Lebensdauer von bis zu 100.000 Stunden – das entspricht über 11 Jahren Dauerbetrieb.</p>
              </div>
            )}
            {descOpen && (
              <div style={{ fontSize: 14, color: '#555', lineHeight: 1.8 }}>
                <p>Die LED-Neon-Röhren sorgen für ein gleichmäßiges, helles Leuchten ohne Flackern oder sichtbare Lichtpunkte. Dank unserer patentierten PowerLEDs™ Technologie ist das Neon-Schild energieeffizient, langlebig und sicher im Gebrauch. Unsere LEDs erreichen eine Lebensdauer von bis zu 100.000 Stunden – das entspricht über 11 Jahren Dauerbetrieb.</p>
              </div>
            )}
            {!descOpen && (
              <button className="mehr-btn" onClick={() => setDescOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                Mehr anzeigen
              </button>
            )}
          </div>

          {descOpen && (
            <>
              <DescRow icon={<><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>} title="Rückplatte & Finish">
                <p>Das Neon-Schild wird auf einer stabilen Acryl-Rückplatte montiert. Je nach Design wählen Sie zwischen:</p>
                <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                  <li style={{ marginBottom: 6 }}><strong>Ausgeschnittene Rückplatte:</strong> Folgt exakt der Form Ihres Designs – minimalistisch und modern. Ideal für organische Logos und Schriftzüge.</li>
                  <li style={{ marginBottom: 6 }}><strong>Quadratische Rückplatte:</strong> Rahmt das gesamte Design für einen klassischen, aufgeräumten Look.</li>
                  <li><strong>Ohne Rückplatte:</strong> Vollständig schwebender Effekt.</li>
                </ul>
                <p style={{ marginTop: 10 }}>Standardmäßig transparent – auf Wunsch auch in Schwarz oder Weiß. UV-Beständig und kratzfest.</p>
              </DescRow>
              <DescRow icon={<><circle cx="13.5" cy="6.5" r="2.5" /><circle cx="19" cy="4" r="1" /><circle cx="6" cy="17" r="3" /><path d="M12 20h9M4.2 19.8l1.4-1.4" /></>} title="Farben & UV-Druck">
                <p>Wählen Sie aus einer Vielzahl von Farben oder entscheiden Sie sich für die <strong>Full Color Option (+15%)</strong>. Unsere Farbpalette: Warmweiß, Eisblau, Soft Orange, Pink, Lila, Rot, Grün, Gelb und viele mehr.</p>
                <p style={{ marginTop: 10 }}>Mit unserem <strong>UV-Druck</strong> drucken wir Ihr Design haarscharf direkt auf die Acryl-Rückplatte – lichtecht, kratzfest und wetterfest.</p>
              </DescRow>
              <DescRow icon={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>} title="Verwendung – Innen & Außen">
                <ul style={{ paddingLeft: 20 }}>
                  <li style={{ marginBottom: 6 }}><strong>Innen (Standard):</strong> Für alle Innenräume geeignet.</li>
                  <li><strong>Außen IP65:</strong> Vollständig wasserdicht und UV-beständig.</li>
                </ul>
              </DescRow>
              <DescRow icon={<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>} title="Garantie">
                <p><strong>2 Jahre</strong> auf Innen · <strong>1 Jahr</strong> auf Außen-Neon-Schilder (IP65). Bei Defekten ersetzen wir das Schild kostenlos.</p>
              </DescRow>
              <DescRow icon={<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></>} title="Was ist in der Box?">
                <ul style={{ paddingLeft: 20 }}>
                  <li style={{ marginBottom: 4 }}>Handgefertigtes LED-Neon-Schild</li>
                  <li style={{ marginBottom: 4 }}>Netzteil · Dimmer · Fernbedienung</li>
                  <li style={{ marginBottom: 4 }}>Stromkabel 300 cm (auf Anfrage länger)</li>
                  <li>Montagematerial – Schrauben, Dübel, Abstandshalter</li>
                </ul>
              </DescRow>
              <DescRow icon={<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>} title="Kontakt">
                <p>📧 <a href="mailto:info@neonframe.de" style={{ color: '#60c8f0', fontWeight: 600, textDecoration: 'none' }}>info@neonframe.de</a> – wir antworten innerhalb von 24 Stunden.</p>
              </DescRow>
              <div style={{ padding: '8px 32px 24px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #f5f5f5' }}>
                <button className="weniger-btn" onClick={() => { setDescOpen(false); document.querySelector('.desc-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                  Weniger anzeigen
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* VERGLEICH */}
      <div className="compare-section">
        <div className="compare-header">
          <h2><span className="brand-accent">NeonFrame</span> vs. andere Anbieter</h2>
          <p>Ein klarer Vergleich – damit du sofort siehst, worauf es bei LED-Schildern wirklich ankommt.</p>
        </div>
        <div className="compare-table">
          <div className="compare-row compare-row-head">
            <div className="cmp-cell">Feature</div>
            <div className="cmp-cell cmp-brand">NeonFrame</div>
            <div className="cmp-cell">Andere Anbieter</div>
          </div>
          {compareRows.map((row, i) => (
            <div key={i} className="compare-row">
              <div className="cmp-cell cmp-feat">{row.feature}</div>
              <div className="cmp-cell cmp-brand-val">
                {row.brandIcon === 'yes' ? <span className="cmp-icon cmp-check">✓</span> : row.brandValue}
              </div>
              <div className="cmp-cell cmp-other-val">
                {row.otherIcon === 'no' ? <span className="cmp-icon cmp-cross">✕</span> : row.otherValue}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MONTAGE VIDEO */}
      <div className="video-section">
        <div className="video-card">
          <div className="video-wrap">
            <video className="montage-video" autoPlay muted loop playsInline>
              <source src="https://cdn.shopify.com/videos/c/o/v/b0a9e0702e6d4969aee87f2499310f52.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="video-text">
            <span className="video-badge">In 3 Schritten montiert</span>
            <h3>So einfach geht's</h3>
            <ul className="video-steps">
              <li><span className="step-num">1</span><span>Schild auspacken und Position an der Wand markieren</span></li>
              <li><span className="step-num">2</span><span>Mit dem mitgelieferten Montagematerial befestigen</span></li>
              <li><span className="step-num">3</span><span>Netzteil anschließen – fertig zum Leuchten</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* KUNDENGALERIE */}
      <div className="gallery-section">
        <div className="gallery-wrap">
          <div className="gallery-header">
            <h2>Projekte in Aktion</h2>
          </div>
          <div className="customer-grid">
            {customerGalleryImages.map((src, i) => (
              <div key={i} className={`customer-tile${i % 3 === 0 ? ' tall' : ''}`}>
                <img src={src} alt={`Kundenprojekt ${i + 1}`} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <FaqSection />

      {/* Lade-Fenster beim Ändern der Größe */}
      {accepting && sizeChanged && (
        <div className="ld-ov">
          <div className="ld-card">
            <div className="ld-h">Einen Moment bitte</div>
            <div className="ld-p">Wir bereiten deinen Checkout vor</div>
            <div className="ld-steps">
              {[
                `Größe übernommen (${selW} × ${selH} cm)`,
                `Preis berechnet (${eur(final)})`,
                step >= 3 ? 'Checkout erstellt' : 'Checkout wird erstellt …',
                'Weiterleitung zum Checkout',
              ].map((t, i) => {
                const st = i + 1 <= step ? 'ok' : (i === step ? 'now' : 'wait')
                return (
                  <div key={i} className={`ld-st ${st}`}>
                    <b>{st === 'ok' ? '✓' : ''}</b>{t}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}


      {/* Preis + Button unten, sobald der Button in der Karte nicht sichtbar ist */}
      <div className={`sticky-buy${showBar ? ' show' : ''}`} aria-hidden={!showBar}>
        {images[0] && <img className="sb-thumb" src={images[0]} alt="" />}
        <div className="sb-info">
          <div className="sb-title">Individuelles LED-Neon-Schild – personalisiert nach Wunsch{offer.project ? <> <span>für {offer.project}</span></> : null}</div>
          <div className="sb-note">Kostenloser Versand · {offer.delivery ? `Geliefert zwischen ${offer.delivery}` : 'Lieferzeit 2–3 Wochen'}</div>
        </div>
        <div className="sb-row">
          {discAmt > 0 && <span className="sb-badge">−{discDisplay}</span>}
          <div className="sb-price">{discAmt > 0 && <s>{eur(listBrutto)}</s>}<b>{final > 0 ? eur(final) : '–'}</b></div>
          <a href={offer.checkout_url || '#'} onClick={accept} className="cta-btn" tabIndex={showBar ? 0 : -1} target={offer.checkout_url && !sizeChanged ? '_blank' : undefined} rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            {accepting ? 'Einen Moment …' : 'Angebot annehmen'}
          </a>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <div className="footer-logo">
              <span className="footer-logo-text"><span className="neon">NEON</span><span className="frame">FRAME</span></span>
            </div>
            <p className="footer-tagline">Handgefertigte LED-Neon-Schilder – individuell für dich designed. Fragen? Wir sind für dich da.</p>
            <div className="footer-contact">
              <a href="mailto:info@neonframe.de" className="footer-contact-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,12 2,6" /></svg>
                info@neonframe.de
              </a>
              <a href="tel:+4917656197641" className="footer-contact-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                +49 176 56197641
              </a>
            </div>
          </div>
          <div className="footer-right">
            <div className="footer-col-title">Rechtliches</div>
            <div className="footer-links">
              <a href="https://neonframe.de/pages/impressum" target="_blank" rel="noopener noreferrer">Impressum</a>
              <a href="https://neonframe.de/pages/datenschutz" target="_blank" rel="noopener noreferrer">Datenschutz</a>
              <a href="https://neonframe.de/pages/agb" target="_blank" rel="noopener noreferrer">AGB</a>
              <a href="https://neonframe.de/pages/widerrufsrecht" target="_blank" rel="noopener noreferrer">Widerrufsrecht</a>
            </div>
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} NeonFrame. Alle Rechte vorbehalten.</div>
        </div>
      </footer>
      <div className="sb-space" />
    </>
  )
}
