'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'

const LOGO = 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735'
const REASONS = ['Bereits bestellt', 'Preis passt nicht', 'Nur Angebot eingeholt', 'Zu viele E-Mails', 'Sonstiges']

export default function AbmeldenPage() {
  const { id } = useParams()
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [state, setState] = useState('idle') // idle | loading | done | error

  async function submit() {
    if (!reason) return
    setState('loading')
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reason, comment: reason === 'Sonstiges' ? comment : '' }),
      })
      const data = await res.json()
      setState(data.success ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="nf-ab">
      <style>{`
        .nf-ab{min-height:100vh;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111;text-align:center}
        .nf-ab *{box-sizing:border-box}
        .nf-top{background:#09080a;padding:10px 24px;border-bottom:3px solid #0ea5e9;text-align:left}
        .nf-top img{height:64px;display:block}
        .nf-w{padding:48px 16px 56px}
        .nf-ab h1{margin:0 0 10px;font-size:30px}
        .nf-p{max-width:440px;margin:0 auto 28px;color:#666;font-size:16px;line-height:1.6}
        .nf-list{max-width:420px;margin:0 auto;text-align:left}
        .nf-o{display:flex;justify-content:space-between;align-items:center;padding:15px 4px;border-bottom:1px solid #eee;font-size:16px;cursor:pointer;user-select:none}
        .nf-o b{width:22px;height:22px;border-radius:6px;border:2px solid #d1d5db;flex-shrink:0}
        .nf-o.on b{background:#0ea5e9;border-color:#0ea5e9;box-shadow:inset 0 0 0 3px #fff}
        .nf-ab textarea{display:block;width:100%;margin:8px 0 0;border:1.5px solid #0ea5e9;border-radius:12px;padding:12px 14px;font:inherit;font-size:15px;min-height:96px;resize:vertical;outline:none;box-shadow:0 0 0 3px #0ea5e922}
        .nf-btns{max-width:420px;margin:28px auto 0;display:flex;gap:10px}
        .nf-a,.nf-k{flex:1;padding:15px;border-radius:999px;font-size:15px;font-weight:700;border:0;cursor:pointer;font-family:inherit;text-decoration:none;text-align:center}
        .nf-a{background:#ef4444;color:#fff}
        .nf-a:disabled{opacity:.45;cursor:not-allowed}
        .nf-k{background:#f3f4f6;color:#111}
        .nf-hint{margin-top:10px;font-size:13px;color:#9ca3af}
        .nf-err{margin-top:14px;font-size:14px;color:#dc2626}
        .nf-check{width:64px;height:64px;border-radius:50%;background:#ecfdf5;color:#10b981;font-size:32px;line-height:64px;margin:0 auto 18px}
        @media(max-width:600px){.nf-btns{flex-direction:column-reverse}.nf-ab h1{font-size:24px}.nf-w{padding:36px 16px 44px}.nf-top img{height:56px}}
      `}</style>

      <div className="nf-top">
        <a href="https://neonframe.de"><img src={LOGO} alt="NeonFrame" /></a>
      </div>

      <div className="nf-w">
        {state === 'done' ? (
          <>
            <div className="nf-check">✓</div>
            <h1>Du wurdest abgemeldet</h1>
            <p className="nf-p">Du bekommst keine Erinnerungen mehr zu deinem Angebot. Danke für dein Feedback!</p>
            <div className="nf-btns" style={{ maxWidth: 260 }}>
              <a className="nf-k" href="https://neonframe.de">Zu neonframe.de</a>
            </div>
          </>
        ) : (
          <>
            <h1>Wirklich abmelden? 😢</h1>
            <p className="nf-p">Du bekommst dann keine Erinnerungen mehr zu deinem Neon-Schild. Hilf uns kurz – was trifft zu?</p>

            <div className="nf-list">
              {REASONS.map((r, i) => (
                <div
                  key={r}
                  className={`nf-o${reason === r ? ' on' : ''}`}
                  style={i === REASONS.length - 1 && reason === 'Sonstiges' ? { borderBottom: 0 } : undefined}
                  onClick={() => setReason(r)}
                >
                  {r}<b />
                </div>
              ))}
              {reason === 'Sonstiges' && (
                <textarea
                  autoFocus
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Erzähl uns kurz, warum … (optional)"
                />
              )}
            </div>

            <div className="nf-btns">
              <a className="nf-k" href={`/angebot/${id}`}>Doch nicht</a>
              <button className="nf-a" onClick={submit} disabled={!reason || state === 'loading'}>
                {state === 'loading' ? 'Wird abgemeldet …' : 'Ja, abmelden'}
              </button>
            </div>
            {!reason && <div className="nf-hint">Bitte wähle zuerst einen Grund aus.</div>}
            {state === 'error' && <div className="nf-err">Da ist etwas schiefgelaufen. Bitte versuche es nochmal oder schreib uns an info@neonframe.de.</div>}
          </>
        )}
      </div>
    </div>
  )
}
