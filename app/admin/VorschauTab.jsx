'use client'
import { useState, useEffect, useRef } from 'react'

// Vorschau-Szenen (Hintergruende liegen in /public/vorschau/)
// c = Mitte des Schilds, b = maximale Schildgroesse (jeweils als Anteil von Bildbreite/-hoehe)
const SCENES = [
  { key: 'bar_wand', label: 'Bar-Wand', src: '/vorschau/bar_wand.jpg', c: [0.7231, 0.4557], b: [0.3743, 0.7357] },
  { key: 'holzwand_icons', label: 'Holzwand mit Icons', src: '/vorschau/holzwand_icons.jpg', c: [0.3285, 0.2931], b: [0.3205, 0.4309] },
]
const CUSTOM_SCENE = { key: 'eigener_hintergrund', label: 'Eigener Hintergrund', src: null, c: [0.5, 0.5], b: [0.5, 0.6] }

// ==== ENGINE START ====
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)

function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('Bild konnte nicht geladen werden'))
    i.src = src
  })
}

// Design (PNG transparent ODER Neon auf Schwarz) -> zugeschnittene Emission + Alpha
function prepareDesign(img) {
  const w = img.naturalWidth, h = img.naturalHeight, n = w * h
  const c = mk(w, h), x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0)
  const id = x.getImageData(0, 0, w, h), d = id.data
  let t = 0
  for (let i = 0; i < n; i++) if (d[i * 4 + 3] < 250) t++
  const hasAlpha = t > n * 0.01
  const a = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    if (hasAlpha) {
      const al = d[p + 3], f = al / 255
      a[i] = al; d[p] *= f; d[p + 1] *= f; d[p + 2] *= f
    } else {
      a[i] = (Math.max(d[p], d[p + 1], d[p + 2]) - 15) * 255 / 64
    }
    d[p + 3] = 255
  }
  let minx = w, miny = h, maxx = -1, maxy = -1
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    if (a[y * w + xx] > 38) {
      if (xx < minx) minx = xx; if (xx > maxx) maxx = xx
      if (y < miny) miny = y; if (y > maxy) maxy = y
    }
  }
  if (maxx < 0) throw new Error('Kein Design erkannt (Bild komplett schwarz oder transparent?)')
  const pad = Math.round(0.03 * Math.max(maxx - minx, maxy - miny))
  const x0 = Math.max(minx - pad, 0), y0 = Math.max(miny - pad, 0)
  const x1 = Math.min(maxx + pad + 1, w), y1 = Math.min(maxy + pad + 1, h)
  const cw = x1 - x0, ch = y1 - y0
  x.putImageData(id, 0, 0)
  const rgb = mk(cw, ch)
  rgb.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch)
  const al = mk(cw, ch), ax = al.getContext('2d'), aid = ax.createImageData(cw, ch)
  for (let y = 0; y < ch; y++) for (let xx = 0; xx < cw; xx++) {
    const p = (y * cw + xx) * 4
    aid.data[p] = aid.data[p + 1] = aid.data[p + 2] = 255
    aid.data[p + 3] = a[(y0 + y) * w + x0 + xx]
  }
  ax.putImageData(aid, 0, 0)
  return { w: cw, h: ch, rgb, alpha: al }
}

function blurDraw(dst, src, sigma, opts = {}) {
  const c = dst.getContext('2d')
  c.save()
  c.globalCompositeOperation = opts.op || 'source-over'
  c.globalAlpha = opts.alpha ?? 1
  c.filter = sigma > 0 ? `blur(${sigma}px)` : 'none'
  c.drawImage(src, opts.dx || 0, opts.dy || 0)
  c.restore()
}
function alphaOf(cv) {
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data
  const a = new Uint8Array(cv.width * cv.height)
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]
  return a
}
function shapeCanvas(bin, W, H) {
  const c = mk(W, H), x = c.getContext('2d'), id = x.createImageData(W, H)
  for (let i = 0; i < bin.length; i++) {
    const p = i * 4
    id.data[p] = id.data[p + 1] = id.data[p + 2] = 255
    id.data[p + 3] = bin[i] ? 255 : 0
  }
  x.putImageData(id, 0, 0)
  return c
}
function fillHoles(bin, W, H) {
  const outside = new Uint8Array(W * H), st = new Int32Array(W * H)
  let sp = 0
  const push = (i) => { if (!bin[i] && !outside[i]) { outside[i] = 1; st[sp++] = i } }
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1) }
  while (sp) {
    const i = st[--sp], x = i % W, y = (i / W) | 0
    if (x > 0) push(i - 1)
    if (x < W - 1) push(i + 1)
    if (y > 0) push(i - W)
    if (y < H - 1) push(i + W)
  }
  for (let i = 0; i < bin.length; i++) if (!outside[i]) bin[i] = 1
}
function dilateCanvas(src, W, H, r, op) {
  const out = mk(W, H), c = out.getContext('2d')
  if (op === 'lighten') { c.fillStyle = '#000'; c.fillRect(0, 0, W, H) }
  c.globalCompositeOperation = op
  for (const rad of [r * 0.5, r]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 2 * Math.PI
      c.drawImage(src, Math.cos(a) * rad, Math.sin(a) * rad)
    }
  }
  c.drawImage(src, 0, 0)
  return out
}

function renderMockup({ bg, design, center, box, glow = 1, scale = 1 }) {
  const probe = mk(1, 1).getContext('2d')
  if (!('filter' in probe)) throw new Error('Dieser Browser unterstuetzt die Glow-Berechnung nicht. Bitte Chrome oder Edge verwenden.')
  const W = Math.round(bg.naturalWidth * scale), H = Math.round(bg.naturalHeight * scale)
  const s = Math.min((box[0] * scale) / design.w, (box[1] * scale) / design.h)
  const nw = Math.max(2, Math.round(design.w * s)), nh = Math.max(2, Math.round(design.h * s))
  const size = Math.max(nw, nh)
  const x0 = Math.round(center[0] * scale - nw / 2), y0 = Math.round(center[1] * scale - nh / 2)

  // Szene
  const scene = mk(W, H), sx = scene.getContext('2d', { willReadFrequently: true })
  sx.drawImage(bg, 0, 0, W, H)
  const sceneId = sx.getImageData(0, 0, W, H), sd = sceneId.data

  // Design platzieren
  let emit = mk(W, H)
  { const c = emit.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.imageSmoothingQuality = 'high'; c.drawImage(design.rgb, x0, y0, nw, nh) }
  let alphaC = mk(W, H)
  { const c = alphaC.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(design.alpha, x0, y0, nw, nh) }

  // Duenne Linien auf Roehrenstaerke bringen
  {
    const cx0 = Math.max(x0, 0), cy0 = Math.max(y0, 0), cx1 = Math.min(x0 + nw, W), cy1 = Math.min(y0 + nh, H)
    const rw = cx1 - cx0, rh = cy1 - cy0
    if (rw > 4 && rh > 4) {
      const ad = alphaC.getContext('2d', { willReadFrequently: true }).getImageData(cx0, cy0, rw, rh).data
      const m = (x, y) => ad[(y * rw + x) * 4 + 3] > 76
      let area = 0, perim = 0
      for (let y = 1; y < rh - 1; y++) for (let x = 1; x < rw - 1; x++) {
        if (!m(x, y)) continue
        area++
        if (!m(x - 1, y) || !m(x + 1, y) || !m(x, y - 1) || !m(x, y + 1)) perim++
      }
      if (perim > 0) {
        const tEst = (2 * area) / perim, tWant = size * 0.014
        if (tEst < tWant) {
          const r = Math.min(Math.round((tWant - tEst) / 2), Math.round(size * 0.02))
          if (r >= 1) { emit = dilateCanvas(emit, W, H, r, 'lighten'); alphaC = dilateCanvas(alphaC, W, H, r, 'source-over') }
        }
      }
    }
  }

  // Roehren: Farbe + heisser Kern
  const n = W * H
  const hot = new Uint8ClampedArray(n * 3)
  {
    const ex = emit.getContext('2d', { willReadFrequently: true }), eid = ex.getImageData(0, 0, W, H), e = eid.data
    for (let i = 0; i < n; i++) {
      const p = i * 4
      const r = e[p] / 255, g = e[p + 1] / 255, b = e[p + 2] / 255
      const lum = Math.max(r, g, b)
      if (lum < 0.004) continue
      const core = clamp((lum - 0.72) / 0.28)
      const tr = clamp(Math.pow(r, 1.08) * 1.1), tg = clamp(Math.pow(g, 1.08) * 1.1), tb = clamp(Math.pow(b, 1.08) * 1.1)
      e[p] = tr * 255; e[p + 1] = tg * 255; e[p + 2] = tb * 255
      hot[i * 3] = (tr + core * 0.3 * (1 - tr)) * 255
      hot[i * 3 + 1] = (tg + core * 0.3 * (1 - tg)) * 255
      hot[i * 3 + 2] = (tb + core * 0.3 * (1 - tb)) * 255
    }
    ex.putImageData(eid, 0, 0)
  }

  // Glow (mehrere Radien)
  const glowC = mk(W, H)
  { const c = glowC.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, W, H) }
  for (const [sig, w] of [[0.004, 0.9], [0.010, 0.8], [0.025, 0.65], [0.06, 0.5], [0.14, 0.38]]) {
    blurDraw(glowC, emit, sig * size, { op: 'lighter', alpha: w })
  }
  const gd = glowC.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data

  // Acryl-Rueckplatte
  const k = Math.max(3, size * 0.035)
  const b1 = mk(W, H); blurDraw(b1, alphaC, k / 1.28)
  const a1 = alphaOf(b1)
  const bin = new Uint8Array(n)
  for (let i = 0; i < n; i++) bin[i] = a1[i] > 26 ? 1 : 0
  const b2 = mk(W, H); blurDraw(b2, shapeCanvas(bin, W, H), k)
  const a2 = alphaOf(b2)
  for (let i = 0; i < n; i++) bin[i] = a2[i] > 127 ? 1 : 0
  fillHoles(bin, W, H)
  const boardC = shapeCanvas(bin, W, H)
  const bs = mk(W, H); blurDraw(bs, boardC, 1.5)
  const Bs = alphaOf(bs)
  const bb = mk(W, H); blurDraw(bb, boardC, 4)
  const Bb = alphaOf(bb)
  const off = Math.max(4, size * 0.012)
  const shC = mk(W, H); blurDraw(shC, boardC, size * 0.012, { dx: off, dy: off / 2 })
  const Sh = alphaOf(shC)

  // Zusammensetzen
  let mean = 0
  for (let i = 0; i < n; i++) { const p = i * 4; mean += 0.299 * sd[p] + 0.587 * sd[p + 1] + 0.114 * sd[p + 2] }
  mean = mean / n / 255 + 1e-4
  for (let i = 0; i < n; i++) {
    const p = i * 4
    let r = sd[p] / 255, g = sd[p + 1] / 255, b = sd[p + 2] / 255
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const tex = clamp(0.8 + 0.35 * (lum / mean - 1), 0.6, 1.3)
    const sh = 0.55 * Sh[i] / 255
    r *= 1 - sh; g *= 1 - sh; b *= 1 - sh
    const B = Bs[i] / 255, kb = 1 - 0.25 * B
    r = r * kb + B * 0.035; g = g * kb + B * 0.035; b = b * kb + B * 0.035
    const e = clamp((Bs[i] - Bb[i]) / 255 * 2) * 0.5
    r += e * 0.30; g += e * 0.28; b += e * 0.26
    const kg = glow * 0.85 * tex / 255
    r = 1 - (1 - clamp(r)) * (1 - clamp(gd[p] * kg))
    g = 1 - (1 - clamp(g)) * (1 - clamp(gd[p + 1] * kg))
    b = 1 - (1 - clamp(b)) * (1 - clamp(gd[p + 2] * kg))
    const hr = hot[i * 3] / 255, hg = hot[i * 3 + 1] / 255, hb = hot[i * 3 + 2] / 255
    r = 1 - (1 - r) * (1 - (hr + hr * 0.2 - hr * hr * 0.2))
    g = 1 - (1 - g) * (1 - (hg + hg * 0.2 - hg * hg * 0.2))
    b = 1 - (1 - b) * (1 - (hb + hb * 0.2 - hb * hb * 0.2))
    sd[p] = r * 255; sd[p + 1] = g * 255; sd[p + 2] = b * 255; sd[p + 3] = 255
  }
  sx.putImageData(sceneId, 0, 0)
  return scene
}
// ==== ENGINE END ====

function SceneCard({ scene, design, designName, glow }) {
  const isCustom = !scene.src
  const [bg, setBg] = useState(null)
  const [pos, setPos] = useState(scene.c)
  const [size, setSize] = useState(1)
  const [err, setErr] = useState('')
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!scene.src) return
    loadImg(scene.src).then(setBg).catch(() => setErr(`Hintergrund fehlt: ${scene.src} (Datei in public/vorschau hochladen)`))
  }, [scene.src])

  useEffect(() => {
    if (!bg || !design) return
    const t = setTimeout(() => {
      try {
        const W = bg.naturalWidth, H = bg.naturalHeight
        const out = renderMockup({
          bg, design, glow,
          center: [pos[0] * W, pos[1] * H],
          box: [scene.b[0] * W * size, scene.b[1] * H * size],
          scale: Math.min(1, 1100 / W),
        })
        const cv = canvasRef.current
        if (!cv) return
        cv.width = out.width; cv.height = out.height
        cv.getContext('2d').drawImage(out, 0, 0)
        setErr('')
      } catch (e) { setErr(e.message) }
    }, 90)
    return () => clearTimeout(t)
  }, [bg, design, pos, size, glow, scene.b])

  const onBg = async (file) => {
    if (!file) return
    try { setBg(await loadImg(URL.createObjectURL(file))); setErr('') } catch (e) { setErr(e.message) }
  }
  const place = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    setPos([clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)])
  }
  const download = () => {
    try {
      const W = bg.naturalWidth, H = bg.naturalHeight
      const out = renderMockup({
        bg, design, glow,
        center: [pos[0] * W, pos[1] * H],
        box: [scene.b[0] * W * size, scene.b[1] * H * size],
        scale: 1,
      })
      out.toBlob((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${designName}_${scene.key}.jpg`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 3000)
      }, 'image/jpeg', 0.93)
    } catch (e) { setErr(e.message) }
  }

  const btn = { background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{scene.label}</div>
        <button style={{ ...btn, opacity: bg && design ? 1 : 0.4 }} disabled={!bg || !design} onClick={download}>Herunterladen (JPG)</button>
      </div>
      {isCustom && (
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          Hintergrundfoto (Wand, Raum ohne Schild)
          <input id="vorschau-bg-upload" type="file" accept="image/*" onChange={(e) => onBg(e.target.files[0])} style={{ fontSize: 12, color: 'var(--text)' }} />
        </label>
      )}
      <div style={{ position: 'relative', background: '#111', borderRadius: 12, overflow: 'hidden', minHeight: 120 }}>
        {bg && design ? (
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 'auto', display: 'block', cursor: dragging ? 'grabbing' : 'crosshair', touchAction: 'none' }}
            onPointerDown={(e) => { setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); place(e) }}
            onPointerMove={(e) => { if (dragging) place(e) }}
            onPointerUp={() => setDragging(false)}
          />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
            {!design ? 'Erst oben ein Design hochladen' : isCustom ? 'Hintergrundfoto auswählen' : 'Lädt…'}
          </div>
        )}
      </div>
      {err && <div style={{ fontSize: 12, color: '#dc2626' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
        <span style={{ whiteSpace: 'nowrap' }}>Größe</span>
        <input type="range" min="0.4" max="1.6" step="0.02" value={size} onChange={(e) => setSize(parseFloat(e.target.value))} style={{ flex: 1 }} />
        <span style={{ width: 40, textAlign: 'right' }}>{Math.round(size * 100)}%</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>Klicken oder ziehen im Bild verschiebt das Schild.</div>
    </div>
  )
}

export default function VorschauTab() {
  const [design, setDesign] = useState(null)
  const [designName, setDesignName] = useState('design')
  const [glow, setGlow] = useState(1)
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)

  const onDesign = async (file) => {
    if (!file) return
    try {
      const img = await loadImg(URL.createObjectURL(file))
      setDesign(prepareDesign(img))
      setDesignName((file.name || 'design').replace(/\.[^.]+$/, '').replace(/[^\w\-äöüÄÖÜß]+/g, '_'))
      setErr('')
    } catch (e) { setErr(e.message) }
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '24px 20px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onDesign(e.dataTransfer.files[0]) }}
        style={{ border: `2px dashed ${over ? '#16a34a' : 'var(--border)'}`, background: 'var(--input-bg)', borderRadius: 16, padding: '22px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Neon-Design hochladen</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
            PNG mit transparentem Hintergrund oder Neon-Design auf schwarzem Hintergrund. Hierher ziehen oder Datei wählen.
          </div>
          {design && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 6 }}>✓ {designName} geladen</div>}
          {err && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{err}</div>}
        </div>
        <input id="vorschau-design-upload" type="file" accept="image/*" onChange={(e) => onDesign(e.target.files[0])} style={{ fontSize: 12, color: 'var(--text)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>Glow</span>
          <input type="range" min="0.5" max="1.6" step="0.05" value={glow} onChange={(e) => setGlow(parseFloat(e.target.value))} />
          <span style={{ width: 36 }}>{Math.round(glow * 100)}%</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        {SCENES.map((s) => <SceneCard key={s.key} scene={s} design={design} designName={designName} glow={glow} />)}
        <SceneCard scene={CUSTOM_SCENE} design={design} designName={designName} glow={glow} />
      </div>
    </div>
  )
}
