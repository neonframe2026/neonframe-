'use client'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// Wissen: Was Sarah und Jonas über NeonFrame wissen (Dokumente, eigene Regeln, gelernte Beispiele)
export default function WissenPage({ onBack }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [edit, setEdit] = useState(null) // { id?, title, content }
  const [open, setOpen] = useState(null)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef(null)
  const [dark] = useState(() => { try { return localStorage.getItem('nf_theme') === 'dark' } catch { return false } })

  const api = async (method, body, q = '') => {
    const { data } = await authClient().auth.getSession()
    const r = await fetch('/api/wissen' + q, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') }, body: body ? JSON.stringify(body) : undefined })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Fehler')
    return j
  }
  const load = () => api('GET').then(setD).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])

  async function upload(file) {
    if (!file) return
    if (file.size > 25 * 1024 * 1024) { setErr('Datei ist zu groß (max. 25 MB)'); return }
    setErr(''); setBusy(`„${file.name}“ wird gelesen … (bis zu 1 Minute)`)
    try {
      const { path, token } = await api('POST', { action: 'upload', name: file.name })
      const { error } = await authClient().storage.from('offer-images').uploadToSignedUrl(path, token, file, { contentType: file.type || 'application/octet-stream' })
      if (error) throw error
      await api('POST', { action: 'doc', path, name: file.name, mime: file.type, size: file.size })
      await load()
    } catch (e) { setErr(e.message) }
    setBusy('')
  }
  async function saveRule(e) {
    e.preventDefault(); setErr('')
    try { await api('POST', { action: 'rule', ...edit }); setEdit(null); load() } catch (e2) { setErr(e2.message) }
  }
  async function del(item, what) {
    if (!confirm(`${what} „${item.title}“ wirklich löschen?`)) return
    try { await api('DELETE', null, '?id=' + encodeURIComponent(item.id)); load() } catch (e) { setErr(e.message) }
  }
  const when = (x) => { const t = new Date(x), n = new Date(); const day = Math.round((new Date(n.toDateString()) - new Date(t.toDateString())) / 864e5); const hm = t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); return day === 0 ? 'heute ' + hm : day === 1 ? 'gestern ' + hm : t.toLocaleDateString('de-DE') }

  const css = `
  .nfw{position:fixed;inset:0;overflow:auto;background:var(--b);color:var(--f);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif}
  .nfw{--b:#f3f5f9;--s:#fff;--s2:#f7f9fc;--l:#e3e8f0;--f:#0f1726;--m:#6b7a93;--a:#2f80ed}.nfw.dark{--b:#0b0f17;--s:#121826;--s2:#0f1520;--l:#232c3d;--f:#e9eef7;--m:#8b97ad;--a:#7fc4ff}
  .nfw .wrap{max-width:980px;margin:0 auto;padding:26px 16px 60px;display:grid;gap:18px}
  .nfw .back{color:var(--m);font-size:13px;cursor:pointer;background:none;border:0;padding:0;text-align:left;width:max-content;font-family:inherit}
  .nfw h2{margin:0;font-size:26px}.nfw .sub{color:var(--m);font-size:14px;margin-top:4px}
  .nfw .who{display:flex;gap:6px;flex-wrap:wrap}.nfw .who span{font-size:11.5px;border:1px solid var(--l);border-radius:99px;padding:2px 9px;color:var(--m)}
  .nfw .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
  .nfw .card{background:var(--s);border:1px solid var(--l);border-radius:16px;padding:16px;display:grid;gap:12px;min-width:0}
  .nfw .ch{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.nfw .ch b{font-size:16px}.nfw .ch small{color:var(--m);display:block;font-size:12.5px;margin-top:2px}
  .nfw .btn{height:38px;border-radius:10px;border:0;background:linear-gradient(135deg,#3aa8ff,#2459e6);color:#fff;font-weight:700;padding:0 14px;font-size:13.5px;cursor:pointer;font-family:inherit}
  .nfw .ghost{height:38px;border-radius:10px;border:1px solid var(--l);background:none;color:var(--f);padding:0 14px;cursor:pointer;font-family:inherit}
  .nfw .drop{border:1.5px dashed #3aa8ff88;border-radius:12px;padding:18px;text-align:center;color:var(--m);font-size:13px;background:var(--s2);cursor:pointer}.nfw .drop b{color:var(--a)}.nfw .drop.on{background:#3aa8ff14}
  .nfw .item{border:1px solid var(--l);border-radius:12px;padding:10px 12px;background:var(--s2);display:grid;gap:6px;min-width:0}
  .nfw .doc{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:10px;align-items:center;cursor:pointer}
  .nfw .ic{width:38px;height:38px;border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:11px;background:#ef44441f;color:#ef6b6b}.nfw .ic.w{background:#3aa8ff1f;color:var(--a)}
  .nfw .doc b{font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nfw small.m{color:var(--m);font-size:12px}
  .nfw .ok{color:#16b871;font-size:12px;font-weight:600;white-space:nowrap}.nfw .x{color:var(--m);background:none;border:0;cursor:pointer;font-size:14px;margin-left:8px;padding:2px 4px}
  .nfw pre{white-space:pre-wrap;font:12.5px/1.55 inherit;margin:4px 0 0;color:var(--f);max-height:320px;overflow:auto;font-family:inherit}
  .nfw .q{color:var(--a);font-weight:700;font-size:13.5px}.nfw .a{font-size:13.5px;line-height:1.5}.nfw .acts{display:flex;gap:12px}.nfw .acts button{background:none;border:0;color:var(--m);font-size:12px;cursor:pointer;padding:0;font-family:inherit}
  .nfw .before{color:var(--m);text-decoration:line-through;font-size:13px;white-space:pre-wrap}.nfw .after{font-size:13px;white-space:pre-wrap}.nfw .lab{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--m)}
  .nfw input,.nfw textarea{width:100%;border-radius:10px;border:1px solid var(--l);background:var(--b);color:var(--f);padding:10px 12px;font-size:14px;font-family:inherit;box-sizing:border-box;outline:none}.nfw textarea{min-height:90px;resize:vertical}
  .nfw .err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);color:#ef4444;border-radius:10px;padding:10px 12px;font-size:13px}
  .nfw .busy{background:rgba(58,168,255,.1);border:1px solid rgba(58,168,255,.35);color:var(--a);border-radius:10px;padding:10px 12px;font-size:13px}
  @media(max-width:760px){.nfw .grid{grid-template-columns:1fr}.nfw h2{font-size:22px}}`

  const docs = d?.docs || [], rules = d?.rules || [], ex = d?.examples || []
  return (
    <div className={'nfw' + (dark ? ' dark' : '')}>
      <style>{css}</style>
      <div className="wrap">
        <button className="back" onClick={onBack}>← Zurück zur Zentrale</button>
        <div><h2>Wissen</h2><div className="sub">Das wissen Sarah und Jonas über NeonFrame. Je mehr hier steht, desto besser antworten sie.</div></div>
        <div className="who"><span>✓ Sarah Krüger · Posteingang</span><span>✓ Jonas Schröder · WhatsApp, Instagram & Facebook</span></div>
        {err && <div className="err">{err}</div>}
        {busy && <div className="busy">⏳ {busy}</div>}
        {!d && !err && <div className="sub">Wird geladen …</div>}
        {d && <>
          <div className="grid">
            <div className="card">
              <div className="ch"><div><b>📄 Dokumente</b><small>FAQ, Produktinfos, Broschüren. PDF oder Text.</small></div></div>
              <div className={'drop' + (drag ? ' on' : '')} onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
                onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]) }}>
                <b>Datei hierher ziehen</b> oder antippen zum Hochladen
                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,application/pdf,text/plain" style={{ display: 'none' }} onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              {docs.length === 0 && <small className="m">Noch keine Dokumente.</small>}
              {docs.map(x => (
                <div className="item" key={x.id}>
                  <div className="doc" onClick={() => setOpen(open === x.id ? null : x.id)}>
                    <span className={'ic' + (/pdf$/i.test(x.title) ? '' : ' w')}>{/pdf$/i.test(x.title) ? 'PDF' : 'TXT'}</span>
                    <div style={{ minWidth: 0 }}><b>{x.title}</b><small className="m">{when(x.at)} · antippen zum Ansehen</small></div>
                    <span className="ok">✓ gelernt<button className="x" title="Löschen" onClick={e => { e.stopPropagation(); del(x, 'Dokument') }}>✕</button></span>
                  </div>
                  {open === x.id && <pre>{x.content}</pre>}
                </div>
              ))}
            </div>
            <div className="card">
              <div className="ch"><div><b>✍️ Eigene Regeln</b><small>Kurz aufschreiben, wie ihr etwas beantwortet.</small></div>{!edit && <button className="btn" onClick={() => setEdit({ title: '', content: '' })}>+ Regel</button>}</div>
              {edit && (
                <form className="item" onSubmit={saveRule}>
                  <input placeholder="Thema, z. B. Kunde fragt nach Montage" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} autoFocus />
                  <textarea placeholder="So antworten wir …" value={edit.content} onChange={e => setEdit({ ...edit, content: e.target.value })} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button type="button" className="ghost" onClick={() => setEdit(null)}>Abbrechen</button><button className="btn">Speichern</button></div>
                </form>
              )}
              {rules.length === 0 && !edit && <small className="m">Noch keine Regeln.</small>}
              {rules.map(x => (
                <div className="item" key={x.id}>
                  <span className="q">{x.title}</span><span className="a">{x.content}</span>
                  <div className="acts"><button onClick={() => setEdit({ id: x.id, title: x.title, content: x.content })}>Bearbeiten</button><button onClick={() => del(x, 'Regel')}>Löschen</button></div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="ch"><div><b>🧠 Aus deinen Korrekturen gelernt</b><small>Wenn du einen Entwurf änderst und sendest, merkt sich Sarah deine Version.</small></div><span className="ok">{ex.length} {ex.length === 1 ? 'Beispiel' : 'Beispiele'}</span></div>
            {ex.length === 0 && <small className="m">Noch keine. Ändere einen Entwurf bei Sarah und sende ihn, dann erscheint er hier.</small>}
            {ex.map(x => (
              <div className="item" key={x.id}>
                <span className="lab">{x.title}</span>
                {x.meta?.before && <span className="before">{x.meta.before}</span>}
                <span className="after">{x.content}</span>
                <div className="acts"><small className="m">{when(x.at)}</small><button onClick={() => del(x, 'Beispiel')}>Entfernen</button></div>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  )
}
