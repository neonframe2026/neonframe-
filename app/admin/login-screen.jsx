'use client'
import { useEffect, useState } from 'react'
import { authClient, setRemember } from '../../lib/admin-auth'

// Login-Seite der Zentrale (Option 1 Clean Card, Darkmode)
export default function AdminLogin({ onAuthed }) {
  const [mode, setMode] = useState('loading') // loading | login | forgot | sent | recover
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [keep, setKeep] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sb = authClient()
    const { data: sub } = sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY') { setMode('recover'); return }
      if (session && ev === 'SIGNED_IN' && !location.hash.includes('type=recovery')) onAuthed()
    })
    sb.auth.getSession().then(({ data }) => {
      if (location.hash.includes('type=recovery')) setMode('recover')
      else if (data.session) onAuthed()
      else setMode('login')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const msg = (e) => {
    const m = String(e?.message || e)
    if (/invalid login/i.test(m)) return 'E-Mail oder Passwort ist falsch.'
    if (/rate limit/i.test(m)) return 'Zu viele Versuche. Bitte kurz warten.'
    return m
  }
  async function login(e) {
    e.preventDefault(); setBusy(true); setErr('')
    setRemember(keep)
    const { error } = await authClient().auth.signInWithPassword({ email: email.trim(), password: pw })
    setBusy(false)
    if (error) setErr(msg(error)); else onAuthed()
  }
  async function forgot(e) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await authClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/admin' })
    setBusy(false)
    if (error) setErr(msg(error)); else setMode('sent')
  }
  async function recover(e) {
    e.preventDefault(); setErr('')
    if (pw.length < 8) return setErr('Mindestens 8 Zeichen.')
    if (pw !== pw2) return setErr('Die Passwörter stimmen nicht überein.')
    setBusy(true)
    const { error } = await authClient().auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(msg(error))
    history.replaceState(null, '', '/admin'); onAuthed()
  }

  const css = `
  .nfl{position:fixed;inset:0;display:grid;place-items:center;background:#0b0f17;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif;color:#e9eef7;padding:16px}
  .nfl .card{position:relative;width:min(400px,100%);background:#121826;border:1px solid #26324a;border-radius:22px;padding:32px;display:grid;gap:22px;box-shadow:0 0 0 1px rgba(58,168,255,.05),0 0 28px rgba(47,107,255,.10),0 0 60px rgba(47,107,255,.05)}
  .nfl .card:before{content:'';position:absolute;inset:-24px;z-index:-1;border-radius:50px;background:radial-gradient(closest-side,rgba(47,107,255,.09),transparent);filter:blur(24px)}
  .nfl .hd{display:grid;gap:14px;justify-items:center;text-align:center}
  .nfl img{width:64px;height:64px;border-radius:16px;box-shadow:0 0 22px rgba(31,214,233,.25)}
  .nfl h1{margin:0;font-size:26px;letter-spacing:-.01em}.nfl h1 b{color:#3aa8ff}
  .nfl .sub{color:#8b97ad;font-size:14px;margin-top:4px}
  .nfl form{display:grid;gap:12px}.nfl label{font-size:12.5px;color:#8b97ad;margin-bottom:-6px}
  .nfl input[type=email],.nfl input[type=password]{width:100%;height:46px;border-radius:12px;border:1px solid #283246;background:#0f1520;color:#e9eef7;padding:0 14px;font-size:15px;outline:none;font-family:inherit;box-sizing:border-box}
  .nfl input:focus{border-color:#3aa8ff;box-shadow:0 0 0 3px rgba(58,168,255,.16)}
  .nfl .row{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#8b97ad;gap:10px}
  .nfl .chk{display:flex;gap:8px;align-items:center;cursor:pointer}.nfl .chk input{accent-color:#3aa8ff;width:16px;height:16px}
  .nfl .lnk{background:none;border:0;color:#7fc4ff;font:inherit;font-size:13px;cursor:pointer;padding:0}
  .nfl .btn{height:48px;border-radius:12px;border:0;background:linear-gradient(135deg,#3aa8ff,#2459e6);color:#fff;font-weight:700;font-size:15px;cursor:pointer;font-family:inherit;box-shadow:0 8px 20px rgba(47,107,255,.28)}
  .nfl .btn:disabled{opacity:.6;cursor:default}
  .nfl .err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);color:#fca5a5;border-radius:10px;padding:9px 12px;font-size:13px}
  .nfl .ok{background:rgba(52,227,155,.08);border:1px solid rgba(52,227,155,.3);color:#86efac;border-radius:10px;padding:12px;font-size:13.5px;line-height:1.5}
  .nfl .foot{font-size:12px;color:#5f6b82;text-align:center}`

  return (
    <div className="nfl">
      <style>{css}</style>
      <div className="card">
        <div className="hd">
          <img src="/icon-192.png" alt="NeonFrame" />
          <div>
            <h1>Neon<b>Frame</b> Zentrale</h1>
            <div className="sub">{mode === 'recover' ? 'Neues Passwort festlegen' : mode === 'forgot' || mode === 'sent' ? 'Passwort zurücksetzen' : 'Willkommen zurück. Melde dich an.'}</div>
          </div>
        </div>

        {mode === 'loading' && <div className="foot">Einen Moment …</div>}

        {mode === 'login' && (
          <form onSubmit={login}>
            <label>E-Mail</label>
            <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <label>Passwort</label>
            <input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} required />
            <div className="row">
              <label className="chk" style={{ margin: 0 }}><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />Angemeldet bleiben</label>
              <button type="button" className="lnk" onClick={() => { setErr(''); setMode('forgot') }}>Passwort vergessen?</button>
            </div>
            {err && <div className="err">{err}</div>}
            <button className="btn" disabled={busy}>{busy ? 'Wird geprüft …' : 'Einloggen'}</button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={forgot}>
            <label>E-Mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            {err && <div className="err">{err}</div>}
            <button className="btn" disabled={busy}>{busy ? 'Wird gesendet …' : 'Link zum Zurücksetzen senden'}</button>
            <button type="button" className="lnk" onClick={() => setMode('login')}>Zurück zum Login</button>
          </form>
        )}

        {mode === 'sent' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="ok">Falls es ein Konto mit dieser E-Mail gibt, ist jetzt ein Link unterwegs. Öffne ihn, um ein neues Passwort festzulegen.</div>
            <button type="button" className="lnk" onClick={() => setMode('login')}>Zurück zum Login</button>
          </div>
        )}

        {mode === 'recover' && (
          <form onSubmit={recover}>
            <label>Neues Passwort</label>
            <input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} required autoFocus />
            <label>Neues Passwort wiederholen</label>
            <input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} required />
            {err && <div className="err">{err}</div>}
            <button className="btn" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Passwort speichern'}</button>
          </form>
        )}

        <div className="foot">Nur für autorisierte Mitarbeiter</div>
      </div>
    </div>
  )
}
