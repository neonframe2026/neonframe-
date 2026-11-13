'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// Clara · Content-Planung: Wochenkalender, Posts für Instagram + Facebook planen, Clara schreibt Captions.
// Gepostet wird vom Cron (/api/content?run=1) zum Termin.
const BLAU = '#38bdf8'
const pad = (n) => String(n).padStart(2, '0')
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x }
const kw = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7) }
const hm = (s) => { const d = new Date(s); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

async function api(method, body, qs = '') {
  const { data: s } = await authClient().auth.getSession()
  const r = await fetch('/api/content' + qs, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s.session?.access_token || '') }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'Fehler')
  return j
}

const BTN = { borderRadius: 10, padding: '9px 13px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', border: 'none', whiteSpace: 'nowrap' }
const PRI = { ...BTN, background: BLAU, color: '#04121c' }
const GHOST = { ...BTN, background: 'transparent', border: '1px solid #2a3b52', color: '#b9c7d6' }
const IN = { width: '100%', background: '#0a101b', border: '1px solid #2a3b52', borderRadius: 10, padding: '9px 12px', color: '#e6edf5', fontFamily: 'inherit', fontSize: 13 }
const CHIP = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, borderRadius: 7, padding: '3px 7px' }
const IG = <span style={{ ...CHIP, background: '#e1306c22', color: '#f472b6' }}>IG</span>
const FB = <span style={{ ...CHIP, background: '#1877f222', color: '#60a5fa' }}>FB</span>
function Status({ s }) {
  if (s === 'geplant') return <span style={{ ...CHIP, background: BLAU + '22', color: '#7dd3fc' }}>● Geplant</span>
  if (s === 'gepostet') return <span style={{ ...CHIP, background: '#22c55e22', color: '#4ade80' }}>✓ Gepostet</span>
  if (s === 'fehler') return <span style={{ ...CHIP, background: '#ef444422', color: '#f87171' }}>⚠ Fehler</span>
  return <span style={{ ...CHIP, background: '#1b2738', color: '#b9c7d6' }}>✎ Entwurf</span>
}

function CSS() {
  return <style>{`
    .ct-wrap{max-width:1180px;margin:0 auto;padding:24px 24px 50px}
    .ct-card{background:#0e1522;border:1px solid #1b2738;border-radius:18px;padding:16px}
    .ct-lbl{font-size:10.5px;font-weight:800;letter-spacing:1.2px;color:#6f8399;text-transform:uppercase}
    .ct-week{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:16px}
    .ct-day{background:#0b111c;border:1px solid #1b2738;border-radius:12px;padding:8px;min-height:200px;display:flex;flex-direction:column;gap:8px}
    .ct-day.today{background:${BLAU}12;border:2px solid ${BLAU};box-shadow:0 0 18px ${BLAU}33}
    .ct-day.past{opacity:.55}
    .ct-post{cursor:pointer;border-radius:10px;padding:4px;transition:background .15s}
    .ct-post:hover{background:#ffffff08}
    .ct-thumb{width:100%;height:90px;border-radius:9px;object-fit:cover;background:#0a101b;display:block}
    .ct-add{background:none;border:none;color:#55677c;font-size:12px;cursor:pointer;font-family:inherit;padding:6px;margin-top:auto}
    .ct-add:hover{color:${BLAU}}
    .ct-modal{display:grid;grid-template-columns:260px 1fr;gap:16px;margin-top:14px}
    @media (max-width: 760px){
      .ct-wrap{padding:14px 12px 40px}
      .ct-week{grid-template-columns:1fr;gap:6px}
      .ct-day{min-height:0;flex-direction:row;align-items:center;flex-wrap:wrap}
      .ct-day .ct-lbl{width:62px;flex:none}
      .ct-post{display:flex;gap:10px;align-items:center;flex:1}
      .ct-thumb{width:46px;height:46px}
      .ct-add{margin:0}
      .ct-head{flex-direction:column;align-items:stretch !important}
      .ct-only-d{display:none !important}
      .ct-modal{grid-template-columns:1fr}
      .ct-btns{flex-direction:column}
    }
  `}</style>
}

function Media({ url, type, style }) {
  if (!url) return <div style={{ ...style, background: '#0a101b' }} />
  if (type === 'video') return <div style={{ position: 'relative', ...style }}><video src={url} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: style?.borderRadius || 9, display: 'block' }} /><span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', textShadow: '0 0 6px #000' }}>▶</span></div>
  return <img src={url} alt="" style={{ objectFit: 'cover', display: 'block', ...style }} />
}

function Editor({ post, preset, onClose, onSaved }) {
  const d0 = post?.post_at ? new Date(post.post_at) : null
  const [f, setF] = useState({
    path: post?.media_path || '', url: post?.media_url || '', type: post?.media_type || 'image', name: '',
    caption: post?.caption || '', nets: post?.nets || ['instagram', 'facebook'],
    date: d0 ? isoDay(d0) : (preset || isoDay(new Date(Date.now() + 864e5))), time: d0 ? hm(d0) : '18:00',
  })
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const ro = post?.status === 'gepostet'
  const set = (o) => setF(x => ({ ...x, ...o }))

  async function writeCaption(over) {
    const x = { ...f, ...over }
    if (!x.path) return
    setBusy('cap'); setErr('')
    try { const j = await api('POST', { action: 'caption', path: x.path, type: x.type, name: x.name, wish, caption: x.caption }); set({ caption: j.caption }); setWish('') }
    catch (e) { setErr(e.message) }
    setBusy('')
  }
  async function pick(file) {
    if (!file) return
    const vid = /^video\//.test(file.type)
    if (!/^(image\/(jpeg|png)|video\/(mp4|quicktime))$/.test(file.type)) { setErr('Bitte ein Bild (JPG/PNG) oder Video (MP4/MOV) wählen'); return }
    if (file.size > 100 * 1024 * 1024) { setErr('Datei ist zu groß (max. 100 MB)'); return }
    setBusy('up'); setErr('')
    try {
      const { path, token, url } = await api('POST', { action: 'upload', name: file.name })
      const { error } = await authClient().storage.from('offer-images').uploadToSignedUrl(path, token, file, { contentType: file.type })
      if (error) throw new Error(error.message)
      const next = { path, url, type: vid ? 'video' : 'image', name: file.name }
      set(next)
      setBusy('')
      if (!f.caption.trim()) await writeCaption(next)
    } catch (e) { setErr(e.message); setBusy('') }
  }
  async function save(status) {
    setBusy(status); setErr('')
    try {
      const at = f.date && f.time ? new Date(`${f.date}T${f.time}:00`).toISOString() : null
      await api('POST', { action: 'save', id: post?.id, path: f.path, type: f.type, caption: f.caption, nets: f.nets, post_at: at, status })
      onSaved()
    } catch (e) { setErr(e.message) }
    setBusy('')
  }
  async function del() {
    if (!confirm('Post wirklich löschen?' + (ro ? ' (Er bleibt auf Instagram und Facebook online, nur hier wird er entfernt.)' : ''))) return
    setBusy('del')
    try { await api('POST', { action: 'delete', id: post.id }); onSaved() } catch (e) { setErr(e.message); setBusy('') }
  }
  const tog = (n) => set({ nets: f.nets.includes(n) ? f.nets.filter(x => x !== n) : [...f.nets, n] })
  const netBtn = (n, label, c) => {
    const on = f.nets.includes(n)
    return <button disabled={ro} onClick={() => tog(n)} style={{ ...BTN, background: on ? c + '22' : 'transparent', color: on ? c : '#6f8399', border: `1px solid ${on ? c + '66' : '#2a3b52'}` }}>{on ? '✓ ' : ''}{label}</button>
  }

  return (
    <div onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} className="ct-card" style={{ width: '100%', maxWidth: 740, borderColor: BLAU + '55', padding: 20, maxHeight: '96vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 17 }}>{ro ? 'Gepostet' : post ? 'Post bearbeiten' : '+ Neuer Post'}</b>
          {post && <Status s={post.status} />}
        </div>
        {post?.status === 'fehler' && post.error && <div style={{ marginTop: 10, color: '#f87171', fontSize: 12.5 }}>⚠ {post.error}. Prüfe den Post und plane ihn neu ein.</div>}
        <div className="ct-modal">
          <div>
            <label style={{ display: 'block', cursor: ro || busy ? 'default' : 'pointer' }}>
              <input type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" disabled={ro || !!busy} onChange={e => pick(e.target.files?.[0])} style={{ display: 'none' }} />
              {f.url ? <Media url={f.url} type={f.type} style={{ width: '100%', aspectRatio: '4/5', borderRadius: 12, border: '1px solid #2a3b52' }} />
                : <div style={{ aspectRatio: '4/5', borderRadius: 12, border: `1.5px dashed ${BLAU}88`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: BLAU }}>
                  <span style={{ fontSize: 30 }}>{busy === 'up' ? '⏳' : '+'}</span><b style={{ fontSize: 13 }}>{busy === 'up' ? 'Lädt hoch …' : 'Bild oder Video wählen'}</b><span style={{ color: '#7d8fa3', fontSize: 11 }}>JPG, PNG, MP4 · max. 100 MB</span></div>}
            </label>
            {f.url && !ro && <div style={{ color: '#7d8fa3', fontSize: 11.5, marginTop: 6, textAlign: 'center' }}>{busy === 'up' ? 'Lädt hoch …' : <>Klick aufs Bild zum <span style={{ color: '#7dd3fc' }}>Ändern</span></>}</div>}
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="ct-lbl">Caption</div>
              {!ro && <button disabled={!f.path || !!busy} onClick={() => writeCaption()} style={{ background: 'none', border: 'none', color: '#7dd3fc', fontWeight: 700, fontSize: 12, cursor: f.path ? 'pointer' : 'default', fontFamily: 'inherit', opacity: f.path ? 1 : .4 }}>{busy === 'cap' ? 'Clara schreibt …' : '✨ Clara schreibt neu'}</button>}
            </div>
            <textarea value={f.caption} readOnly={ro} rows={7} onChange={e => set({ caption: e.target.value })} placeholder={f.path ? 'Clara schreibt gleich die Caption …' : 'Erst ein Bild oder Video wählen, dann schreibt Clara die Caption.'} style={{ ...IN, marginTop: 6, resize: 'vertical', lineHeight: 1.5 }} />
            {!ro && <input value={wish} onChange={e => setWish(e.target.value)} onKeyDown={e => e.key === 'Enter' && writeCaption()} placeholder="Wünsche an Clara, z. B. „lockerer“, „mit Black-Week-Hinweis“ … (Enter)" style={{ ...IN, marginTop: 8, fontSize: 12 }} />}
            <div className="ct-lbl" style={{ margin: '14px 0 6px' }}>Posten auf</div>
            <div style={{ display: 'flex', gap: 8 }}>{netBtn('instagram', 'Instagram', '#f472b6')}{netBtn('facebook', 'Facebook', '#60a5fa')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <div><div className="ct-lbl" style={{ marginBottom: 5 }}>Datum</div><input type="date" disabled={ro} value={f.date} onChange={e => set({ date: e.target.value })} style={{ ...IN, colorScheme: 'dark' }} /></div>
              <div><div className="ct-lbl" style={{ marginBottom: 5 }}>Uhrzeit</div><input type="time" disabled={ro} value={f.time} onChange={e => set({ time: e.target.value })} style={{ ...IN, colorScheme: 'dark' }} /></div>
            </div>
            {!ro && <div style={{ color: '#55677c', fontSize: 11, marginTop: 5 }}>Tipp von Clara: abends zwischen 18 und 20 Uhr erreichst du die meisten.</div>}
          </div>
        </div>
        {err && <div style={{ color: '#f87171', fontSize: 12.5, marginTop: 12 }}>{err}</div>}
        <div className="ct-btns" style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          {!ro && <button disabled={!!busy || !f.path} onClick={() => save('geplant')} style={{ ...PRI, flex: 1, padding: 12, fontSize: 14, opacity: !f.path ? .5 : 1 }}>{busy === 'geplant' ? 'Speichert …' : '✓ Einplanen'}</button>}
          {!ro && <button disabled={!!busy || !f.path} onClick={() => save('entwurf')} style={{ ...GHOST, padding: '12px 16px', fontSize: 14 }}>{busy === 'entwurf' ? 'Speichert …' : 'Als Entwurf speichern'}</button>}
          {post && <button disabled={!!busy} onClick={del} style={{ ...GHOST, padding: '12px 16px', fontSize: 14, color: '#f87171', borderColor: '#ef444455' }}>🗑 Löschen</button>}
          <button disabled={!!busy} onClick={onClose} style={{ ...GHOST, padding: '12px 16px', fontSize: 14 }}>{ro ? 'Schließen' : 'Abbrechen'}</button>
        </div>
      </div>
    </div>
  )
}

export default function ContentPage({ onBack }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [week, setWeek] = useState(() => monday(new Date()))
  const [edit, setEdit] = useState(null) // { post } oder { preset: 'YYYY-MM-DD' }
  const [busy, setBusy] = useState('')
  const load = () => api('GET').then(setD).catch(e => setErr(e.message))
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [])

  const today = isoDay(new Date())
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const x = new Date(week); x.setDate(x.getDate() + i); return x }), [week])
  const end = days[6]
  const posts = d?.posts || []
  const byDay = (k) => posts.filter(p => p.post_at && isoDay(new Date(p.post_at)) === k).sort((a, b) => a.post_at.localeCompare(b.post_at))
  const drafts = posts.filter(p => !p.post_at)
  const nextPost = posts.filter(p => p.status === 'geplant' && p.post_at > new Date().toISOString())[0]
  const thisWeek = isoDay(week) === isoDay(monday(new Date()))
  const move = (n) => setWeek(w => { const x = new Date(w); x.setDate(x.getDate() + 7 * n); return x })

  async function ideaAct(body, label) {
    setBusy(label); setErr('')
    try { await api('POST', body); await load() } catch (e) { setErr(e.message) }
    setBusy('')
  }

  const range = days[0].getMonth() === end.getMonth() ? `${days[0].getDate()}. bis ${end.getDate()}. ${MON[end.getMonth()]}` : `${days[0].getDate()}. ${MON[days[0].getMonth()]} bis ${end.getDate()}. ${MON[end.getMonth()]}`

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#070b14', color: '#e6edf5', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <CSS />
      <div style={{ background: '#0a0a0a', height: 64, display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #2b2e36', color: '#cbd5e1', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>← Zentrale</button>
        <span style={{ fontWeight: 800, fontSize: 15 }}>📅 Content-Planung</span>
        <span className="ct-only-d" style={{ color: '#6f8399', fontSize: 12.5 }}>Clara Vogel · Content-Planerin</span>
      </div>
      <div className="ct-wrap">
        <div className="ct-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => move(-1)} style={{ ...GHOST, padding: '8px 13px', fontSize: 16 }}>‹</button>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>Woche {kw(week)}</div>
              <div style={{ color: '#7d8fa3', fontSize: 12.5, marginTop: 2 }}>{range} · {thisWeek ? 'diese Woche' : <button onClick={() => setWeek(monday(new Date()))} style={{ background: 'none', border: 'none', color: '#7dd3fc', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: 0 }}>zu heute</button>}</div>
            </div>
            <button onClick={() => move(1)} style={{ ...GHOST, padding: '8px 13px', fontSize: 16 }}>›</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {nextPost && <span className="ct-only-d" style={{ color: '#7d8fa3', fontSize: 12 }}>Nächster Post: {WD[(new Date(nextPost.post_at).getDay() + 6) % 7]} {hm(nextPost.post_at)}</span>}
            <button onClick={() => setEdit({ preset: null })} style={{ ...PRI, padding: '11px 16px' }}>+ Neuer Post</button>
          </div>
        </div>
        {err && <div style={{ marginTop: 14, background: '#ef44441a', border: '1px solid #ef444466', color: '#f87171', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>{err}</div>}
        {!d && !err && <div className="ct-card" style={{ marginTop: 16, color: '#7d8fa3' }}>Lädt …</div>}

        {d && <>
          <div className="ct-week">
            {days.map((x, i) => {
              const k = isoDay(x), isT = k === today, past = k < today, list = byDay(k)
              return (
                <div key={k} className={'ct-day' + (isT ? ' today' : '') + (past ? ' past' : '')}>
                  <div className="ct-lbl" style={{ fontSize: 9.5, color: isT ? BLAU : undefined, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span>{WD[i]} {pad(x.getDate())}.{pad(x.getMonth() + 1)}.</span>
                    {isT && <span style={{ background: BLAU, color: '#04121c', borderRadius: 5, padding: '1px 5px', letterSpacing: .5 }}>HEUTE</span>}
                  </div>
                  {list.map(p => (
                    <div key={p.id} className="ct-post" onClick={() => setEdit({ post: p })}>
                      <Media url={p.media_url} type={p.media_type} style={{ width: '100%', height: 90, borderRadius: 9 }} />
                      <div style={{ marginTop: 6, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 12 }}>{hm(p.post_at)}</b>{(p.nets || []).includes('instagram') && IG}{(p.nets || []).includes('facebook') && FB}</div>
                        <div style={{ marginTop: 4 }}><Status s={p.status} /></div>
                      </div>
                    </div>
                  ))}
                  {!past && <button className="ct-add" onClick={() => setEdit({ preset: k })}>+ Post</button>}
                </div>
              )
            })}
          </div>

          {drafts.length > 0 && <div className="ct-card" style={{ marginTop: 16 }}>
            <b style={{ fontSize: 14.5 }}>✎ Entwürfe ohne Termin</b>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              {drafts.map(p => <div key={p.id} onClick={() => setEdit({ post: p })} style={{ cursor: 'pointer', width: 110 }}><Media url={p.media_url} type={p.media_type} style={{ width: 110, height: 110, borderRadius: 10 }} /><div style={{ fontSize: 11, color: '#9fb3c8', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.caption || 'ohne Text'}</div></div>)}
            </div>
          </div>}

          <div className="ct-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: 14.5 }}>💡 Content-Ideen von Clara</b>
              <span style={{ color: '#7d8fa3', fontSize: 11.5 }}>{(d.ideas || []).length ? `${d.ideas.length} Ideen` : ''}</span>
            </div>
            {!(d.ideas || []).length && <div style={{ color: '#7d8fa3', fontSize: 13, marginTop: 8 }}>Noch keine Ideen. Lass dir von Clara welche geben.</div>}
            {(d.ideas || []).map(i => (
              <div key={i.id} style={{ padding: '10px 0', borderBottom: '1px dashed #1f2c3f', display: 'flex', gap: 10, alignItems: 'flex-start', opacity: busy === 'del' + i.id ? .4 : 1 }}>
                <div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>{i.title}</b><div style={{ color: '#7d8fa3', fontSize: 12, marginTop: 2, lineHeight: 1.45 }}>{i.caption}</div></div>
                <button title="Idee entfernen" disabled={!!busy} onClick={() => ideaAct({ action: 'idea_del', id: i.id }, 'del' + i.id)} style={{ background: 'none', border: 'none', color: '#6f8399', fontSize: 15, cursor: 'pointer' }}>✕</button>
              </div>
            ))}
            <button disabled={!!busy} onClick={() => ideaAct({ action: 'ideas' }, 'ideas')} style={{ ...GHOST, width: '100%', marginTop: 10 }}>{busy === 'ideas' ? 'Clara überlegt …' : '↻ Neue Ideen'}</button>
          </div>
        </>}
      </div>
      {edit && <Editor post={edit.post} preset={edit.preset} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}
