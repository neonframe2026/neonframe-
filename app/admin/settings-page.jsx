'use client'
import { useEffect, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// Einstellungen: Benutzer verwalten (nur Administratoren)
export default function SettingsPage({ onBack }) {
  const [list, setList] = useState(null)
  const [me, setMe] = useState('')
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ first: '', last: '', email: '' })
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState('')
  const [dark] = useState(() => { try { return localStorage.getItem('nf_theme') === 'dark' } catch { return false } })

  const api = async (method, body, q = '') => {
    const { data } = await authClient().auth.getSession()
    const r = await fetch('/api/users' + q, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') }, body: body ? JSON.stringify(body) : undefined })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Fehler')
    return j
  }
  const load = () => api('GET').then(j => { setList(j.users); setMe(j.me) }).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])

  // TNC-Verbindung (Login fürs TNC-Portal, für Anna im Einkauf)
  const [tnc, setTnc] = useState(null)
  const [tncVal, setTncVal] = useState('')
  const [tncBusy, setTncBusy] = useState(false)
  const [tncMsg, setTncMsg] = useState(null)
  const ek = async (method, body) => {
    const { data } = await authClient().auth.getSession()
    const r = await fetch('/api/einkauf', { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') }, body: body ? JSON.stringify(body) : undefined })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Fehler')
    return j
  }
  const loadTnc = () => ek('GET').then(j => setTnc(j.connection)).catch(() => setTnc({ has: false }))
  useEffect(() => { loadTnc() }, [])
  async function saveTnc(e) {
    e.preventDefault(); setTncBusy(true); setTncMsg(null)
    try { await ek('PUT', { cookie: tncVal }); setTncVal(''); setTncMsg({ ok: true, t: 'Verbunden. Anna kann jetzt Anfragen an TNC senden.' }); loadTnc() }
    catch (e2) { setTncMsg({ ok: false, t: e2.message }) }
    setTncBusy(false)
  }

  async function invite(e) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await api('POST', f); setOk(`Einladung an ${f.email} gesendet.`); setOpen(false); setF({ first: '', last: '', email: '' }); load() }
    catch (e2) { setErr(e2.message) }
    setBusy(false)
  }
  async function del(u) {
    if (!confirm(`${u.name || u.email} wirklich löschen? Der Zugang ist dann sofort weg.`)) return
    try { await api('DELETE', null, '?id=' + encodeURIComponent(u.id)); load() } catch (e) { setErr(e.message) }
  }
  const ini = (u) => (u.name || u.email).split(/[ @.]/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('')
  const when = (d) => { if (!d) return ''; const t = new Date(d), n = new Date(); const day = Math.round((new Date(n.toDateString()) - new Date(t.toDateString())) / 864e5); return day === 0 ? 'heute' : day === 1 ? 'gestern' : t.toLocaleDateString('de-DE') }

  const css = `
  .nfs{position:fixed;inset:0;overflow:auto;background:var(--b);color:var(--f);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif}
  .nfs{--b:#f3f5f9;--s:#fff;--l:#e3e8f0;--f:#0f1726;--m:#6b7a93}.nfs.dark{--b:#0b0f17;--s:#121826;--l:#232c3d;--f:#e9eef7;--m:#8b97ad}
  .nfs .wrap{max-width:980px;margin:0 auto;padding:28px 16px 60px;display:grid;gap:20px}
  .nfs .back{color:var(--m);font-size:13px;cursor:pointer;background:none;border:0;padding:0;text-align:left;width:max-content}
  .nfs .t{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
  .nfs h2{margin:0;font-size:26px}.nfs .sub{color:var(--m);font-size:14px;margin-top:4px}
  .nfs .btn{height:40px;border-radius:10px;border:0;background:linear-gradient(135deg,#3aa8ff,#2459e6);color:#fff;font-weight:700;padding:0 16px;font-size:14px;cursor:pointer;font-family:inherit}
  .nfs .btn:disabled{opacity:.6}
  .nfs .card{background:var(--s);border:1px solid var(--l);border-radius:16px;overflow:hidden}
  .nfs .row{display:grid;grid-template-columns:44px minmax(0,1fr) 140px 150px 70px;gap:12px;align-items:center;padding:14px 18px;border-top:1px solid var(--l);font-size:14px}
  .nfs .row.h{border-top:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--m);padding:12px 18px}
  .nfs .av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:13px;color:#fff;background:linear-gradient(135deg,#3aa8ff,#7b5cff)}
  .nfs .nm b{display:block}.nfs .nm small{color:var(--m);font-size:12.5px}
  .nfs .role{display:inline-flex;border-radius:99px;padding:3px 10px;font-size:12px;font-weight:600;width:max-content}
  .nfs .role.a{background:rgba(58,168,255,.12);color:#2f80ed;border:1px solid rgba(58,168,255,.35)}.nfs.dark .role.a{color:#7fc4ff}
  .nfs .role.s{color:var(--m);border:1px solid var(--l)}
  .nfs .st{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;color:#16a34a}.nfs .st i{width:7px;height:7px;border-radius:50%;background:#22c55e}
  .nfs .st.p{color:#d97706}.nfs .st.p i{background:#f59e0b}
  .nfs .act{display:flex;justify-content:flex-end}.nfs .del{width:32px;height:32px;border-radius:8px;border:1px solid rgba(239,68,68,.35);background:none;color:#ef4444;cursor:pointer;font-size:14px}
  .nfs .muted{color:var(--m);font-size:13px}
  .nfs .err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);color:#ef4444;border-radius:10px;padding:10px 12px;font-size:13px}
  .nfs .ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.35);color:#16a34a;border-radius:10px;padding:10px 12px;font-size:13px}
  .nfs .modal{position:fixed;inset:0;background:rgba(5,7,12,.55);display:grid;place-items:center;padding:16px;z-index:5}
  .nfs .mc{width:min(440px,100%);background:var(--s);border:1px solid var(--l);border-radius:18px;padding:24px;display:grid;gap:12px;box-shadow:0 24px 60px rgba(0,0,0,.35)}
  .nfs .mc h3{margin:0 0 4px;font-size:20px}.nfs label{font-size:12.5px;color:var(--m);margin-bottom:-6px}
  .nfs input{width:100%;height:44px;border-radius:11px;border:1px solid var(--l);background:var(--b);color:var(--f);padding:0 13px;font-size:14.5px;font-family:inherit;box-sizing:border-box;outline:none}
  .nfs input:focus{border-color:#3aa8ff}
  .nfs .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.nfs .two>div{display:grid;gap:12px}
  .nfs .hint{font-size:12.5px;color:var(--m);line-height:1.5}
  .nfs .tnc{padding:18px;display:grid;gap:12px}
  .nfs .tnc h3{margin:0;font-size:17px}
  .nfs .cs{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;font-size:13.5px}
  .nfs .cs i{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .nfs .cs.on{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3)}.nfs .cs.on i{background:#22c55e;box-shadow:0 0 8px #22c55e}
  .nfs .cs.off{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.3)}.nfs .cs.off i{background:#ef4444}
  .nfs .cs small{display:block;color:var(--m);font-size:12px}
  .nfs .tf{display:flex;gap:8px;flex-wrap:wrap}.nfs .tf input{flex:1 1 240px;width:auto}
  .nfs ol{margin:0;padding-left:18px;color:var(--m);font-size:13px;line-height:1.7}.nfs ol b{color:var(--f)}
  .nfs .ma{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}.nfs .ghost{height:40px;border-radius:10px;border:1px solid var(--l);background:none;color:var(--f);padding:0 14px;cursor:pointer;font-family:inherit}
  @media(max-width:700px){.nfs .row{grid-template-columns:40px minmax(0,1fr) 44px}.nfs .c3,.nfs .c4{display:none}.nfs .two{grid-template-columns:1fr}}`

  return (
    <div className={'nfs' + (dark ? ' dark' : '')}>
      <style>{css}</style>
      <div className="wrap">
        <button className="back" onClick={onBack}>← Zurück zur Zentrale</button>
        <div className="t">
          <div><h2>Einstellungen · Benutzer</h2><div className="sub">Nur für Administratoren sichtbar</div></div>
          <button className="btn" onClick={() => { setErr(''); setOk(''); setOpen(true) }}>+ Mitarbeiter hinzufügen</button>
        </div>
        {err && !open && <div className="err">{err}</div>}
        {ok && <div className="ok">{ok}</div>}
        <div className="card">
          <div className="row h"><span></span><span>Name</span><span className="c3">Rolle</span><span className="c4">Status</span><span></span></div>
          {!list && !err && <div className="row"><span></span><span className="muted">Wird geladen …</span></div>}
          {(list || []).map(u => (
            <div className="row" key={u.id}>
              <span className="av">{ini(u)}</span>
              <span className="nm"><b>{u.name || u.email}</b><small>{u.email}</small></span>
              <span className="c3"><span className={'role ' + (u.role === 'admin' ? 'a' : 's')}>{u.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}</span></span>
              <span className={'c4 st' + (u.status === 'aktiv' ? '' : ' p')}><i></i>{u.status === 'aktiv' ? 'Aktiv · ' + when(u.last) : 'Einladung offen'}</span>
              <span className="act">{u.id === me ? <span className="muted">Du</span> : u.role === 'admin' ? null : <button className="del" title="Löschen" onClick={() => del(u)}>✕</button>}</span>
            </div>
          ))}
        </div>

        <div className="t"><div><h2>TNC-Verbindung</h2><div className="sub">Damit Anna im Einkauf Anfragen direkt ins TNC-Portal senden kann</div></div></div>
        <div className="card"><div className="tnc">
          {tnc && (tnc.has && tnc.ok !== false
            ? <div className="cs on"><i></i><div><b>Mit TNC-Portal verbunden</b><small>{tnc.checked_at ? 'Zuletzt geprüft ' + when(tnc.checked_at) + ', wird automatisch verlängert' : 'Wird automatisch verlängert'}</small></div></div>
            : <div className="cs off"><i></i><div><b>{tnc.has ? 'Login abgelaufen' : 'Noch nicht verbunden'}</b><small>Bitte den Login unten einmal hinterlegen</small></div></div>)}
          <ol>
            <li>Öffne <b>reseller.theneoncompany.shop</b> und melde dich an.</li>
            <li>Drück <b>F12</b>, dann oben <b>Anwendung</b> (Application) → links <b>Cookies</b> → <b>reseller.theneoncompany.shop</b>.</li>
            <li>Klick auf <b>__Secure-next-auth.session-token</b> und kopier den <b>Wert</b> (Value).</li>
            <li>Füg ihn hier ein und klick auf <b>Speichern</b>. Der Wert wird geschützt gespeichert und nirgends angezeigt.</li>
          </ol>
          <form className="tf" onSubmit={saveTnc}>
            <input type="password" value={tncVal} onChange={e => setTncVal(e.target.value)} placeholder="Login-Wert einfügen" autoComplete="off" required />
            <button className="btn" disabled={tncBusy}>{tncBusy ? 'Wird geprüft …' : 'Speichern'}</button>
          </form>
          {tncMsg && <div className={tncMsg.ok ? 'ok' : 'err'}>{tncMsg.t}</div>}
        </div></div>
      </div>
      {open && (
        <div className="modal" onClick={() => !busy && setOpen(false)}>
          <form className="mc" onClick={e => e.stopPropagation()} onSubmit={invite}>
            <h3>Neuen Mitarbeiter hinzufügen</h3>
            <div className="two">
              <div><label>Vorname</label><input value={f.first} onChange={e => setF({ ...f, first: e.target.value })} required autoFocus /></div>
              <div><label>Nachname</label><input value={f.last} onChange={e => setF({ ...f, last: e.target.value })} required /></div>
            </div>
            <label>E-Mail</label>
            <input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required />
            <div className="hint">Der Mitarbeiter bekommt eine E-Mail mit einem Link und legt sein Passwort selbst fest. Er sieht danach alles in der Zentrale, nur die Einstellungen nicht.</div>
            {err && <div className="err">{err}</div>}
            <div className="ma"><button type="button" className="ghost" onClick={() => setOpen(false)}>Abbrechen</button><button className="btn" disabled={busy}>{busy ? 'Wird gesendet …' : 'Einladen'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
