'use client'

import { useState, useEffect, useCallback } from 'react'

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

function parseColors(s = '') {
  return s.split(',').map(c => c.trim()).filter(Boolean)
}

const backplateImages = {
  'ausgeschnitten': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/backing-cutout_800x800.png?v=1777906190',
  'quadratisch': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/backing-square_800x800.png?v=1777580592',
  'ohne': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/backing-none_800x800.png?v=1777580593',
}
const backplateColorImages = {
  'transparent': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_02_34_00_800x800.png?v=1778719148',
  'schwarz': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_02_39_25_800x800.png?v=1778719182',
  'weiß': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_02_36_15_800x800.png?v=1778719148',
}
const usageImages = {
  'innen': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_04_05_10_800x800.png?v=1778724405',
  'außen': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_04_03_27_800x800.png?v=1778724405',
}
const colorHoverImage = 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_01_58_48_800x800.png?v=1778716750'

function getTooltipImg(val, map) {
  if (!val) return null
  const lower = val.toLowerCase()
  return map[lower] || map[Object.keys(map).find(k => lower.includes(k))] || null
}

// ─── GALLERY ────────────────────────────────────────────────────────────────
function Gallery({ images }) {
  const [current, setCurrent] = useState(0)
  const [dir, setDir] = useState(null)
  const [animating, setAnimating] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const total = images.length

  const goTo = useCallback((idx, direction) => {
    const nxt = ((idx % total) + total) % total
    if (nxt === current || animating) return
    setDir(direction); setAnimating(true)
    setTimeout(() => { setCurrent(nxt); setAnimating(false); setDir(null) }, 260)
  }, [current, total, animating])

  const prev = useCallback((e) => { e?.stopPropagation(); goTo(current - 1, 'right') }, [current, goTo])
  const next = useCallback((e) => { e?.stopPropagation(); goTo(current + 1, 'left') }, [current, goTo])

  // lock body scroll when lightbox open
  useEffect(() => {
    if (lightbox) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [lightbox])

  useEffect(() => {
    const handler = (e) => {
      if (lightbox) {
        if (e.key === 'Escape') setLightbox(false)
        if (e.key === 'ArrowLeft' && current > 0) setCurrent(c => c - 1)
        if (e.key === 'ArrowRight' && current < total - 1) setCurrent(c => c + 1)
        return
      }
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox, current, total, prev, next])

  useEffect(() => {
    const el = document.getElementById('gallery-main')
    if (!el) return
    let startX = 0
    const onStart = (e) => { startX = e.touches[0].clientX }
    const onEnd = (e) => {
      const dx = e.changedTouches[0].clientX - startX
      if (Math.abs(dx) > 40) dx < 0 ? next() : prev()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd) }
  }, [prev, next])

  if (total === 0) return (
    <div style={{ borderRadius: 18, background: '#f5f5f5', border: '1px solid #eee', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 14, color: '#ccc' }}>Vorschau-Bild</span>
    </div>
  )

  const imgStyle = {
    width: '100%', height: '100%', objectFit: 'contain', display: 'block',
    transform: animating ? (dir === 'left' ? 'translateX(-5%)' : 'translateX(5%)') : 'translateX(0)',
    opacity: animating ? 0 : 1,
    transition: 'transform 0.26s ease, opacity 0.26s ease',
  }

  return (
    <>
      {/* ── LIGHTBOX: fixed, z-index 99999, covers header + everything ── */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.96)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          {/* Close button */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(false) }}
            style={{ position: 'absolute', top: 20, right: 24, background: 'none', border: 'none', color: '#fff', fontSize: 38, cursor: 'pointer', lineHeight: 1, opacity: 0.75, zIndex: 100000 }}
          >×</button>

          {/* Image only */}
          <img
            src={images[current]}
            alt="Vollbild"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 6, display: 'block', userSelect: 'none' }}
          />

          {/* Arrows inside lightbox */}
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
          {/* Counter */}
          {total > 1 && (
            <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{current + 1} / {total}</div>
          )}
        </div>
      )}

      {/* ── MAIN GALLERY IMAGE ── */}
      <div
        id="gallery-main"
        onClick={() => setLightbox(true)}
        style={{ borderRadius: 18, overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', aspectRatio: '4/3', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in' }}
      >
        <img key={current} src={images[current]} alt={`Neon Sign ${current + 1}`} style={imgStyle} />
        {total > 1 && current > 0 && (
          <button onClick={prev} aria-label="Vorheriges Bild" style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.92)', border: '1px solid #eee', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        {total > 1 && current < total - 1 && (
          <button onClick={next} aria-label="Nächstes Bild" style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.92)', border: '1px solid #eee', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
      </div>

      {/* ── THUMBNAILS ── */}
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
    <div style={{ marginTop: 20, background: '#fff', border: '1px solid #eee', borderRadius: 16, padding: 24 }}>
      {/* Header with support icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <img
          src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_18_51_03_800x800.png?v=1778777532"
          alt="Support"
          style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 3 }}>Noch Fragen oder Änderungswünsche?</div>
          <div style={{ fontSize: 14, color: '#999', lineHeight: 1.4 }}>Teilen Sie uns diese direkt hier mit – wir melden uns schnellstmöglich.</div>
        </div>
      </div>
      <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="z.B. Kann die Farbe noch angepasst werden? Ich benötige Expressversand..." rows={3} style={{ width: '100%', background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 10, padding: '13px 15px', fontSize: 14, color: '#111', resize: 'vertical', minHeight: 88, fontFamily: 'inherit', outline: 'none', display: 'block', marginBottom: 12, boxSizing: 'border-box' }} />
      <button onClick={send} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 22px', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.5 : 1 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,12 2,6" /></svg>
        {loading ? 'Wird gesendet...' : 'Per E-Mail senden'}
      </button>
      {status === 'ok' && <div style={{ fontSize: 13, marginTop: 10, padding: '9px 13px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>Nachricht gesendet! Wir melden uns bald.</div>}
      {status === 'err' && <div style={{ fontSize: 13, marginTop: 10, padding: '9px 13px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>{msg.trim() ? 'Fehler. Bitte direkt an info@neonframe.de schreiben.' : 'Bitte eine Nachricht eingeben.'}</div>}
    </div>
  )
}

// ─── DROPDOWN ROW for Produktbeschreibung ────────────────────────────────────
function DescRow({ icon, title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 32px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#fff' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#60c8f0" strokeWidth="2" style={{ width: 16, height: 16 }}>{icon}</svg>
        </div>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#111' }}>{title}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ width: 16, height: 16, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div style={{ padding: '0 32px 20px 82px', fontSize: 14, color: '#555', lineHeight: 1.8 }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function AngebotPage({ offer }) {
  const net = parseFloat(offer.net_price) || 0
  const vatPct = parseFloat(offer.vat_pct) || 19
  const final = parseFloat(offer.final_price) || 0
  const base = parseFloat(offer.base_price) || 0
  const discType = offer.disc_type || 'pct'
  const discVal = parseFloat(offer.disc_val) || 0
  const vatAmt = final - net
  const discAmt = discType === 'pct' ? base * (discVal / 100) : discVal
  const discDisplay = discType === 'pct' ? `${discVal}%` : `€ ${discVal.toFixed(2)}`
  const colors = parseColors(offer.colors)
  const displayId = offer.offer_num || offer.custom_id || offer.id?.slice(0, 8)

  const images = []
  if (offer.preview_image) images.push(offer.preview_image)
  if (offer.preview_image_2) images.push(offer.preview_image_2)
  if (offer.preview_image_3) images.push(offer.preview_image_3)

  const backplateImg = getTooltipImg(offer.backplate, backplateImages)
  const backplateColorImg = getTooltipImg(offer.backplate_color, backplateColorImages)
  const usageImg = getTooltipImg(offer.usage, usageImages)

  return (
    <>
      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111; background:#fff; -webkit-font-smoothing:antialiased; }
        .hdr { background:#0a0a0a; padding:0 52px; height:96px; display:flex; align-items:center; justify-content:space-between; z-index:100; }
        @media(max-width:900px){ .hdr { padding:0 20px; height:76px; } }
        .hdr-badge { background:rgba(96,200,240,.12); border:1px solid rgba(96,200,240,.3); color:#60c8f0; font-size:14px; font-weight:600; padding:9px 22px; border-radius:20px; }
        .page-wrap { max-width:1380px; margin:0 auto; padding:52px 52px 60px; display:grid; grid-template-columns:1.15fr 1fr; gap:64px; align-items:start; }
        @media(max-width:960px){ .page-wrap { grid-template-columns:1fr; gap:32px; padding:28px 20px; } }
        .cfg-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#111; display:block; margin-bottom:6px; }
        .cfg-group { margin-bottom:16px; }
        .cfg-row { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:22px; align-items:flex-end; }
        .cfg-pill { display:inline-flex; align-items:center; gap:7px; background:#f5f5f5; border:1px solid #e8e8e8; border-radius:20px; padding:8px 16px; font-size:14px; font-weight:500; color:#333; }
        .color-dot { width:11px; height:11px; border-radius:50%; border:1.5px solid rgba(0,0,0,.08); display:inline-block; flex-shrink:0; }
        .img-tt { position:relative; display:inline-flex; }
        .img-tt-box { display:none; position:absolute; bottom:calc(100% + 10px); left:50%; transform:translateX(-50%); background:#fff; border:1px solid #eee; border-radius:12px; padding:6px; box-shadow:0 8px 30px rgba(0,0,0,.12); z-index:200; pointer-events:none; }
        .img-tt-box img { display:block; border-radius:8px; }
        .img-tt-box.square img { width:260px; height:260px; object-fit:cover; }
        .img-tt-box.wide img { width:550px; height:auto; object-fit:contain; }
        .img-tt:hover .img-tt-box { display:block; }
        .tt { position:relative; display:inline; }
        .tt-t { border-bottom:1px dashed #ccc; cursor:default; }
        .tt-box { display:none; position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%); background:#111; color:#f0f0f0; font-size:12px; padding:9px 13px; border-radius:8px; white-space:nowrap; z-index:50; pointer-events:none; line-height:1.6; }
        .tt-box::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:5px solid transparent; border-top-color:#111; }
        .tt:hover .tt-box { display:block; }
        .prod-title { font-size:30px; font-weight:800; line-height:1.2; color:#111; margin-bottom:10px; letter-spacing:-.02em; }
        .stars-row { display:flex; align-items:center; gap:8px; margin-bottom:16px; }
        .checks { margin-bottom:24px; display:flex; flex-direction:column; gap:10px; }
        .check-row { display:flex; align-items:flex-start; gap:10px; font-size:15px; color:#555; line-height:1.5; }
        .check-icon { width:20px; height:20px; flex-shrink:0; margin-top:2px; color:#60c8f0; }
        .price-section { background:#fff; border:1px solid #e8e8e8; border-radius:16px; padding:24px; margin-bottom:18px; }
        .price-table { width:100%; border-collapse:collapse; }
        .price-table td { padding:6px 0; font-size:15px; vertical-align:middle; color:#111; }
        .price-table td:last-child { text-align:right; font-weight:500; }
        .pr-disc td { color:#16a34a !important; font-weight:600; }
        .pr-divider td { border-top:1px solid #f0f0f0; padding-top:14px; }
        .pr-total td:first-child { font-size:16px; font-weight:700; color:#111; padding-top:6px; }
        .pr-total td:last-child { font-size:28px; font-weight:800; color:#111; padding-top:6px; letter-spacing:-.02em; }
        .pr-total-note { font-size:11px; color:#111; text-align:right; margin-top:3px; }
        .ship-box { background:#f0fbff; border:1px solid #b8e8f8; border-radius:13px; padding:15px 18px; display:flex; align-items:flex-start; gap:13px; margin-bottom:8px; }
        .ship-icon { width:22px; height:22px; flex-shrink:0; margin-top:2px; color:#60c8f0; }
        .ship-text strong { display:block; font-size:15px; font-weight:700; color:#111; margin-bottom:3px; }
        .ship-text span { font-size:13px; color:#888; }
        .express-row { display:flex; align-items:center; gap:7px; font-size:14px; color:#999; margin-bottom:22px; margin-top:8px; }
        .express-icon { width:16px; height:16px; color:#f59e0b; flex-shrink:0; }
        .cta-btn { width:100%; background:#16a34a; color:#fff; border:none; border-radius:13px; padding:19px; font-size:18px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:16px; font-family:inherit; transition:background .15s, transform .1s; text-decoration:none; }
        .cta-btn:hover { background:#15803d; transform:translateY(-1px); }
        .cta-btn svg { width:22px; height:22px; }
        .features { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px; }
        .feat { background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; display:flex; align-items:flex-start; gap:12px; transition:border-color .15s; }
        .feat:hover { border-color:#b8e8f8; }
        .feat-icon-wrap { width:38px; height:38px; background:#f0fbff; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid #d0f0fc; }
        .feat-icon-wrap svg { width:20px; height:20px; color:#60c8f0; }
        .feat-title { display:block; font-size:14px; font-weight:700; color:#111; margin-bottom:4px; }
        .feat-sub { font-size:12px; color:#888; line-height:1.5; }
        .desc-section { max-width:1380px; margin:0 auto; padding:0 52px 90px; }
        @media(max-width:960px){ .desc-section { padding:0 20px 60px; } }
        .desc-wrap { border:1px solid #eee; border-radius:18px; overflow:hidden; }
        .desc-header { padding:24px 32px; border-bottom:1px solid #f0f0f0; background:#fafafa; display:flex; align-items:center; justify-content:space-between; }
        .desc-header h2 { font-size:20px; font-weight:800; color:#111; }
        .desc-badge-pill { font-size:12px; color:#888; background:#fff; border:1px solid #eee; border-radius:20px; padding:5px 14px; white-space:nowrap; }
      `}</style>

      {/* HEADER — not sticky */}
      <header className="hdr">
        <a href="https://neonframe.de">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" style={{ height: 72, display: 'block' }} />
        </a>
        {displayId && <div className="hdr-badge">Angebot #{displayId}</div>}
      </header>

      <div className="page-wrap">
        {/* LEFT — NOT sticky */}
        <div>
          <Gallery images={images} />
          <ContactCard displayId={displayId} projectName={offer.project || ''} />
        </div>

        {/* RIGHT */}
        <div>
          <h1 className="prod-title">Individuelles LED-Neon-Schild –<br />personalisiert nach Wunsch</h1>

          {/* STERNE — 4 voll + halber fünfter */}
          <div className="stars-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {[...Array(4)].map((_, i) => (
                <span key={i} style={{ color: '#f59e0b', fontSize: 20, lineHeight: 1 }}>★</span>
              ))}
              {/* halber Stern */}
              <span style={{ position: 'relative', display: 'inline-block', width: 20, height: 20, fontSize: 20, lineHeight: '20px', color: '#e5e7eb' }}>
                ★
                <span style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', overflow: 'hidden', color: '#f59e0b', lineHeight: '20px' }}>★</span>
              </span>
            </div>
            <span style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>4,5/5 Sternen</span>
          </div>

          {/* BADGE — hellgrauer Hintergrund, "Individuell angefertigt für" schwarz, Name gold, alles in einer Reihe */}
          {offer.project && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: '#f3f3f3', border: '1px solid #e8e8e8', borderRadius: 12, padding: '11px 18px', marginBottom: 22 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fff', border: '1.5px solid #c9a84c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap' }}>Individuell angefertigt für</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#c9a84c', letterSpacing: '.01em' }}>{offer.project}</span>
              </div>
            </div>
          )}

          {/* MAßE */}
          {(offer.width || offer.height) && (
            <div className="cfg-group">
              <span className="cfg-label">Maße (Breite × Höhe)</span>
              <div className="cfg-pill" style={{ display: 'inline-flex', marginTop: 2 }}>
                {offer.width && offer.height ? `${offer.width} × ${offer.height} cm` : offer.width || offer.height}
              </div>
            </div>
          )}

          {/* FARBEN */}
          {colors.length > 0 && (
            <div className="cfg-group">
              <span className="cfg-label">Farbe</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                {colors.map((c, i) => (
                  <div key={i} className="img-tt">
                    <div className="cfg-pill"><span className="color-dot" style={{ background: colorDot(c) }} />{c}</div>
                    <div className="img-tt-box wide"><img src={colorHoverImage} alt="Farbbeispiel" /></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RÜCKWAND */}
          <div className="cfg-row" style={{ marginBottom: 22 }}>
            {offer.backplate && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="cfg-label">Rückwandform</span>
                <div className="img-tt">
                  <div className="cfg-pill">{offer.backplate}</div>
                  {backplateImg && <div className="img-tt-box square"><img src={backplateImg} alt={offer.backplate} /></div>}
                </div>
              </div>
            )}
            {offer.backplate_color && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="cfg-label">Rückwandfarbe</span>
                <div className="img-tt">
                  <div className="cfg-pill">{offer.backplate_color}</div>
                  {backplateColorImg && <div className="img-tt-box square"><img src={backplateColorImg} alt={offer.backplate_color} /></div>}
                </div>
              </div>
            )}
            {offer.usage && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="cfg-label">Verwendungszweck</span>
                <div className="img-tt">
                  <div className="cfg-pill">{offer.usage}</div>
                  {usageImg && <div className="img-tt-box square"><img src={usageImg} alt={offer.usage} /></div>}
                </div>
              </div>
            )}
          </div>

          {/* CHECKS */}
          <div className="checks">
            {[
              <>Einfach zu installieren mit dem mitgelieferten <span className="tt"><span className="tt-t">Montagematerial</span><span className="tt-box">Inklusive Schrauben, Dübel und Abstandhalter.<br />(Aufhängkabel auf Anfrage)</span></span></>,
              <>Inklusive Fernbedienung, 3 Meter Stromkabel, Adapter und Dimmer</>,
              <>Entwickelt für eine langlebige und hochwertige Nutzung</>,
            ].map((text, i) => (
              <div key={i} className="check-row">
                <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* CTA — sofort sichtbar, vor Preis */}
          <a href={offer.checkout_url || '#'} className="cta-btn" target={offer.checkout_url ? '_blank' : undefined} rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            Angebot annehmen
          </a>

          {/* PRICE */}
          <div className="price-section">
            <table className="price-table">
              <tbody>
                {base > 0 && <tr><td>Listenpreis (netto)</td><td>€ {base.toFixed(2)}</td></tr>}
                {discAmt > 0 && <tr className="pr-disc"><td style={{ paddingTop: 8 }}>− Rabatt ({discDisplay})</td><td style={{ paddingTop: 8 }}>− € {discAmt.toFixed(2)}</td></tr>}
                {net > 0 && <tr><td style={{ paddingTop: 6 }}>Netto-Preis nach Rabatt</td><td style={{ paddingTop: 6 }}>€ {net.toFixed(2)}</td></tr>}
                {vatAmt > 0 && <tr><td>+ MwSt. ({vatPct}%)</td><td>+ € {vatAmt.toFixed(2)}</td></tr>}
                <tr className="pr-divider"><td colSpan={2}></td></tr>
                <tr className="pr-total"><td>Gesamtbetrag</td><td>{final > 0 ? `€ ${final.toFixed(2)}` : '–'}</td></tr>
              </tbody>
            </table>
            {final > 0 && <div className="pr-total-note">(inkl. MwSt.)</div>}
          </div>

          {/* SHIPPING */}
          <div className="ship-box">
            <svg className="ship-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" /><rect x="9" y="11" width="14" height="10" rx="2" /><circle cx="12" cy="21" r="1" /><circle cx="20" cy="21" r="1" /></svg>
            <div className="ship-text">
              <strong>Kostenloser Versand</strong>
              <span>{offer.delivery ? `Geliefert zwischen ${offer.delivery}` : 'Lieferzeit 2–3 Wochen'}</span>
            </div>
          </div>
          <div className="express-row">
            <svg className="express-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
            <span className="tt"><span className="tt-t">Expressversand anfordern</span><span className="tt-box">Expressversand: ca. 7–10 Werktage.<br />Bitte im Anpassungsfeld anfordern.</span></span>
          </div>

          {/* FEATURES */}
          <div className="features">
            {[
              [<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>, 'Qualitätsgarantie', 'Hochwertige LED-Neonfertigung mit präziser Handarbeit'],
              [<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>, 'Komplettpaket', 'Inklusive Netzteil, Dimmer, Fernbedienung und Montagematerial'],
              [<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>, 'Einfache Installation', 'Montieren Sie Ihr Neon Sign in wenigen Minuten'],
              [<><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>, 'Extrem langlebig', 'Energieeffiziente LEDs mit bis zu 100.000 Stunden Lebensdauer'],
            ].map(([pathEl, title, sub], i) => (
              <div key={i} className="feat">
                <div className="feat-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{pathEl}</svg></div>
                <div><span className="feat-title">{title}</span><span className="feat-sub">{sub}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRODUKTBESCHREIBUNG — Design B mit Dropdowns + vollem Text ── */}
      <div className="desc-section">
        <div className="desc-wrap">
          <div className="desc-header">
            <h2>Produktbeschreibung</h2>
            <div className="desc-badge-pill">PowerLEDs™ Technologie</div>
          </div>

          <DescRow icon={<><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></>} title="Premium-Beleuchtung">
            <p>Die LED-Neon-Röhren sorgen für ein gleichmäßiges, helles Leuchten ohne Flackern oder sichtbare Lichtpunkte. Dank unserer patentierten PowerLEDs™ Technologie ist das Neon-Schild energieeffizient, langlebig und sicher im Gebrauch. Unsere LEDs erreichen eine Lebensdauer von bis zu 100.000 Stunden – das entspricht über 11 Jahren Dauerbetrieb.</p>
          </DescRow>

          <DescRow icon={<><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>} title="Rückplatte & Finish">
            <p>Das Neon-Schild wird auf einer stabilen Acryl-Rückplatte montiert. Je nach Design wählen Sie zwischen:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li style={{ marginBottom: 6 }}><strong>Ausgeschnittene Rückplatte:</strong> Folgt exakt der Form Ihres Designs – minimalistisch und modern. Ideal für organische Logos und Schriftzüge.</li>
              <li style={{ marginBottom: 6 }}><strong>Quadratische Rückplatte:</strong> Rahmt das gesamte Design für einen klassischen, aufgeräumten Look. Besonders beliebt für Wanddekoration.</li>
              <li><strong>Ohne Rückplatte:</strong> Vollständig schwebender Effekt – das Neon scheint frei in der Luft zu leuchten.</li>
            </ul>
            <p style={{ marginTop: 10 }}>Standardmäßig transparent – auf Wunsch auch in Schwarz oder Weiß erhältlich. UV-Beständig und kratzfest.</p>
          </DescRow>

          <DescRow icon={<><circle cx="13.5" cy="6.5" r="2.5" /><circle cx="19" cy="4" r="1" /><circle cx="6" cy="17" r="3" /><path d="M12 20h9M4.2 19.8l1.4-1.4" /></>} title="Farben & UV-Druck">
            <p>Wählen Sie aus einer Vielzahl von Farben oder entscheiden Sie sich für die <strong>Full Color Option (+15%)</strong>. Unsere Farbpalette umfasst unter anderem: Warmweiß, Eisblau, Soft Orange, Pink, Lila, Rot, Grün, Gelb und viele mehr.</p>
            <p style={{ marginTop: 10 }}>Mit unserem <strong>UV-Druck</strong> drucken wir Ihr Design haarscharf direkt auf die Acryl-Rückplatte – ideal für Logos mit Farbverläufen, Fotos oder komplexe Grafiken. Der UV-Druck ist lichtecht, kratzfest und wetterfest.</p>
          </DescRow>

          <DescRow icon={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>} title="Verwendung – Innen & Außen">
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 6 }}><strong>Innen (Standard):</strong> Für alle Innenräume geeignet – Wohnzimmer, Büro, Restaurant, Eventlocation. Normaler IP-Schutz.</li>
              <li><strong>Außen IP65:</strong> Vollständig wasserdicht und UV-beständig. Geeignet für Außenfassaden, Schaufenster, Terrassen und wettergeschützte Außenbereiche.</li>
            </ul>
          </DescRow>

          <DescRow icon={<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>} title="Garantie">
            <p><strong>2 Jahre Garantie</strong> auf Innen-Neon-Schilder – wir stehen für die Qualität unserer Produkte.</p>
            <p style={{ marginTop: 8 }}><strong>1 Jahr Garantie</strong> auf Außen-Neon-Schilder (IP65). Bei Defekten innerhalb der Garantiezeit ersetzen wir das Schild oder die betroffenen Komponenten kostenlos.</p>
          </DescRow>

          <DescRow icon={<><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></>} title="Was ist in der Box?">
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 4 }}>Handgefertigtes, maßgeschneidertes LED-Neon-Schild</li>
              <li style={{ marginBottom: 4 }}>Netzteil (passend für Ihr Land)</li>
              <li style={{ marginBottom: 4 }}>Dimmer – stufenlos einstellbar</li>
              <li style={{ marginBottom: 4 }}>Fernbedienung – zum Ein-/Ausschalten und für verschiedene Lichteffekte</li>
              <li style={{ marginBottom: 4 }}>Stromkabel 300 cm (auf Anfrage auch länger erhältlich)</li>
              <li>Komplettes Montagematerial – Schrauben, Dübel und Abstandshalter (Aufhängkabel auf Anfrage)</li>
            </ul>
          </DescRow>

          <DescRow icon={<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>} title="Weitere Informationen & Kontakt">
            <p>Haben Sie Fragen zu Ihrem individuellen Neon-Schild? Wir helfen Ihnen gerne weiter und beraten Sie persönlich zu Ihrem Wunschdesign, Farben, Maßen und Optionen.</p>
            <p style={{ marginTop: 10 }}>📧 <a href="mailto:info@neonframe.de" style={{ color: '#60c8f0', textDecoration: 'none', fontWeight: 600 }}>info@neonframe.de</a></p>
            <p style={{ marginTop: 6, color: '#888', fontSize: 13 }}>Wir melden uns in der Regel innerhalb von 24 Stunden bei Ihnen.</p>
          </DescRow>
        </div>
      </div>
    </>
  )
}
