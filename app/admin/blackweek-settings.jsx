'use client'
import { useEffect, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// Einstellungen: Black Week + Aufschlag normale Angebote (nur Administratoren)
const BOUGHT = ['confirmed', 'in_production', 'shipped', 'delivered']
const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
const fromLocal = (v) => (v ? new Date(v).toISOString() : null)
const eur = (n) => (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

function Toggle({ on, onClick, big }) {
  return <button type="button" onClick={onClick} style={{ flexShrink: 0, width: big ? 52 : 40, height: big ? 28 : 22, borderRadius: 20, border: 0, cursor: 'pointer', position: 'relative', background: on ? '#22d3ee' : 'var(--l)', boxShadow: on ? '0 0 12px rgba(34,211,238,.45)' : 'none', transition: '.2s' }}>
    <span style={{ position: 'absolute', top: 3, left: on ? (big ? 27 : 21) : 3, width: big ? 22 : 16, height: big ? 22 : 16, borderRadius: '50%', background: '#fff', transition: '.2s' }} />
  </button>
}

export default function BlackWeekSettings() {
  const [bw, setBw] = useState(null)
  const [markup, setMarkup] = useState('')
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [testOffer, setTestOffer] = useState(null)
  const [testTo, setTestTo] = useState('info@neonframe.de')

  const load = async () => {
    const s = await (await fetch('/api/settings', { cache: 'no-store' })).json()
    setBw(s.black_week || {}); setMarkup(String(s.pricing?.markup ?? 15))
    try {
      const all = await (await fetch('/api/offers', { cache: 'no-store' })).json()
      const arr = Array.isArray(all) ? all : []
      setTestOffer(arr.find(o => o.preview_image && parseFloat(o.base_price) > 0) || null)
      const list = arr.filter(o => o.black_week)
      const bought = list.filter(o => BOUGHT.includes(o.status))
      setStats({ n: list.length, b: bought.length, sum: bought.reduce((a, o) => a + (parseFloat(o.final_price) || 0), 0) })
    } catch {}
  }
  useEffect(() => { load() }, [])

  const save = async (key, value, okText) => {
    setBusy(true); setMsg(null)
    try {
      const { data } = await authClient().auth.getSession()
      const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') }, body: JSON.stringify({ key, value }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.error) throw new Error(j.error || 'Fehler')
      setMsg({ ok: true, t: j.deactivated ? `${okText} ${j.deactivated} Black-Week-Angebote wurden deaktiviert.` : okText })
      await load()
    } catch (e) { setMsg({ ok: false, t: e.message }) }
    setBusy(false)
  }
  const setB = (patch) => setBw(b => ({ ...b, ...patch }))
  const mainSwitch = () => {
    if (bw.on) {
      if (!confirm('Black Week jetzt beenden?\n\nAlle nicht bestellten Black-Week-Angebote werden deaktiviert (nicht gelöscht) und zeigen die Abgelaufen-Seite.')) return
      save('black_week', { ...bw, on: false }, 'Black Week ist aus.')
    } else {
      if (!confirm('Black Week jetzt starten?\n\nNeue Angebote werden automatisch als Black Week erstellt (Endpreis = empf. VK, 40% Rabatt).')) return
      save('black_week', { ...bw, on: true }, 'Black Week läuft.')
    }
  }

  if (!bw) return <div className="card"><div className="tnc"><span className="muted">Wird geladen …</span></div></div>
  const running = bw.active
  const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--m)', marginBottom: 6, display: 'block' }
  const line = { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }

  return (
    <>
      <div className="t"><div><h2>Black Week</h2><div className="sub">Aktion mit 40% Rabatt · Endpreis = empf. VK</div></div></div>
      <div className="card">
        <div style={{ position: 'relative', background: '#080709', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: -20, top: 0, bottom: 0, width: '58%', background: 'linear-gradient(90deg,#0a2546,#0d3260)', transform: 'skewX(-18deg)', boxShadow: '8px 0 0 #080709,13px 0 0 #22d3ee' }} />
          <span style={{ position: 'relative', display: 'inline-flex', transform: 'rotate(-3deg)', boxShadow: '3px 3px 0 #000' }}>
            <span style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: 18, background: '#fff', color: '#000', padding: '4px 9px' }}>BLACK WEEK</span>
            <span style={{ fontFamily: 'Anton, Impact, sans-serif', fontSize: 18, background: '#22d3ee', color: '#03121a', padding: '4px 7px' }}>-40%</span>
          </span>
          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, color: running ? '#22d3ee' : '#94a3b8', fontWeight: 800, fontSize: 13 }}>
            {running ? 'AKTIV' : bw.on ? 'ABGELAUFEN' : 'AUS'}<Toggle big on={!!bw.on} onClick={() => !busy && mainSwitch()} />
          </span>
        </div>
        <div className="tnc">
          <div className="two">
            <div><span style={lbl}>Aktion endet am</span><input type="datetime-local" value={toLocal(bw.end)} onChange={e => setB({ end: fromLocal(e.target.value) })} /></div>
            <div><span style={lbl}>Mail 2 (Letzte Chance) am</span><input type="datetime-local" value={toLocal(bw.mail2_at)} onChange={e => setB({ mail2_at: fromLocal(e.target.value) })} /></div>
          </div>
          <div style={line}><Toggle on={bw.auto_new !== false} onClick={() => setB({ auto_new: bw.auto_new === false })} /><span>Neue Angebote automatisch als Black Week erstellen</span></div>
          <div style={line}><Toggle on={bw.mail1 !== false} onClick={() => setB({ mail1: bw.mail1 === false })} /><span>Mail 1 automatisch 24 Std. nach dem Angebot senden</span></div>
          <div style={line}><Toggle on={bw.mail2 !== false} onClick={() => setB({ mail2: bw.mail2 === false })} /><span>Mail 2 (Letzte Chance mit Countdown) zum eingestellten Zeitpunkt senden</span></div>
          <div className="ma" style={{ justifyContent: 'flex-start' }}><button className="btn" disabled={busy} onClick={() => save('black_week', bw, 'Gespeichert.')}>{busy ? 'Wird gespeichert …' : 'Speichern'}</button></div>
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
              {[['Black-Week-Angebote', stats.n, ''], ['Davon bestellt', stats.b, '#16a34a'], ['Umsatz', eur(stats.sum), '']].map(([k, v, c]) => (
                <div key={k} style={{ border: '1px solid var(--l)', borderRadius: 12, padding: 14, background: 'var(--b)' }}><span style={lbl}>{k}</span><div style={{ fontSize: 24, fontWeight: 800, color: c || 'var(--f)' }}>{v}</div></div>
              ))}
            </div>
          )}
          <div className="hint" style={{ background: 'rgba(234,179,8,.08)', border: '1px solid rgba(234,179,8,.3)', borderRadius: 12, padding: '12px 14px' }}>
            Am Enddatum schaltet sich Black Week automatisch aus. Alle nicht bestellten Black-Week-Angebote werden dann <b>deaktiviert</b> (nicht gelöscht) und zeigen die Abgelaufen-Seite. Bestellte bleiben aktiv.
          </div>
          {msg && <div className={msg.ok ? 'ok' : 'err'}>{msg.t}</div>}
          <div style={{ borderTop: '1px solid var(--l)', paddingTop: 14, display: 'grid', gap: 10 }}>
            <span style={lbl}>Testmails {testOffer ? `(mit Angebot #${testOffer.custom_id || testOffer.id} ${testOffer.project || ''})` : ''}</span>
            <input type="email" value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="An diese Adresse" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['switch', 'Umstell-Mail'], ['mail1', 'Mail 1 (24 Std.)'], ['mail2', 'Mail 2 (Letzte Chance)']].map(([k, l]) => (
                <button key={k} type="button" className="ghost" disabled={busy || !testOffer} onClick={async () => {
                  setBusy(true); setMsg(null)
                  try {
                    const r = await fetch('/api/bw-mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offerId: testOffer.id, kind: k, to: testTo }) })
                    const j = await r.json().catch(() => ({}))
                    if (!j.success) throw new Error(j.error || 'Fehler')
                    setMsg({ ok: true, t: `${l} als Test an ${testTo} gesendet.` })
                  } catch (e) { setMsg({ ok: false, t: e.message }) }
                  setBusy(false)
                }}>{l} testen</button>
              ))}
            </div>
            <div className="hint">Testmails ändern nichts am Angebot und gehen nur an die Adresse oben. Die Preise werden als Black Week berechnet.</div>
          </div>
        </div>
      </div>

      <div className="t"><div><h2>Preise</h2><div className="sub">Aufschlag auf den empf. VK von TNC für normale Angebote (20% Rabatt)</div></div></div>
      <div className="card"><div className="tnc">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 1 200px' }}><span style={lbl}>Aufschlag (%)</span><input type="number" step="1" min="0" value={markup} onChange={e => setMarkup(e.target.value)} /></div>
          <button className="btn" disabled={busy} onClick={() => save('pricing', { markup: parseFloat(markup) || 0 }, 'Aufschlag gespeichert.')}>Speichern</button>
        </div>
        <div className="hint">Gilt nur für neue Angebote. Bestehende Angebote behalten ihren Aufschlag (alte Angebote: 10%).</div>
      </div></div>
    </>
  )
}
