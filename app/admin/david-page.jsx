'use client'
import { useEffect, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// David: Bericht & Vorschläge (eigene Seite). Vorschläge nur zum Lesen, mit X wegklicken (= ablehnen).
const LILA = '#8f7bff'
const eur = (n) => Math.round(n || 0).toLocaleString('de-DE') + ' €'
const TABS = [['week', 'Woche'], ['month', 'Monat'], ['year', 'Jahr']]
const SCOL = ['#8f7bff', '#f59e0b', '#22c55e']

async function api(method, body, qs = '') {
  const { data: s } = await authClient().auth.getSession()
  const r = await fetch('/api/strategie' + qs, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s.session?.access_token || '') }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'Fehler')
  return j
}
const BTN = { borderRadius: 10, padding: '9px 13px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', border: 'none', whiteSpace: 'nowrap' }
const GHOST = { ...BTN, background: 'transparent', border: '1px solid #2a3b52', color: '#b9c7d6' }

function CSS() {
  return <style>{`
    .dv-wrap{max-width:1100px;margin:0 auto;padding:24px 24px 50px}
    .dv-card{background:#0e1522;border:1px solid #1b2738;border-radius:18px;padding:18px}
    .dv-lbl{font-size:10.5px;font-weight:800;letter-spacing:1.2px;color:#6f8399;text-transform:uppercase}
    .dv-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-top:16px}
    .dv-kpi .v{font-size:27px;font-weight:900;margin-top:6px}
    .dv-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .dv-sug{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .dv-seg{display:flex;background:#0a101b;border:1px solid #223146;border-radius:11px;padding:3px}
    .dv-seg button{padding:7px 16px;border-radius:9px;font-size:12.5px;font-weight:700;color:#8aa0b6;background:none;border:none;cursor:pointer;font-family:inherit}
    .dv-seg .on{background:${LILA};color:#fff}
    @media (max-width: 760px){
      .dv-wrap{padding:14px 12px 40px}
      .dv-kpis{grid-template-columns:1fr 1fr;gap:10px}
      .dv-kpi .v{font-size:23px}
      .dv-two,.dv-sug{grid-template-columns:1fr}
      .dv-head{flex-direction:column;align-items:stretch !important}
      .dv-only-d{display:none !important}
      .dv-foot{flex-direction:column;align-items:stretch !important}
    }
  `}</style>
}

function Delta({ cur, prev, money }) {
  if (cur == null) return <div style={{ color: '#7d8fa3', fontSize: 11.5 }}>keine Daten</div>
  if (!prev) return <div style={{ color: cur ? '#22c55e' : '#7d8fa3', fontSize: 11.5 }}>{cur ? `+${money ? eur(cur) : cur} neu` : 'wie vorher'}</div>
  const p = Math.round((cur - prev) / prev * 100)
  return <div style={{ color: p > 0 ? '#22c55e' : p < 0 ? '#ef4444' : '#7d8fa3', fontSize: 11.5 }}>{p > 0 ? '+' : ''}{p}% zu vorher</div>
}

export default function DavidPage({ onBack }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [k, setK] = useState('week')
  const [busy, setBusy] = useState('')
  const load = () => api('GET', null, '?ads=1').then(setD).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])

  const P = d?.periods?.[k]
  const rep = P?.report
  // Bericht als gelesen markieren (Benachrichtigung in der Zentrale verschwindet)
  useEffect(() => { if (rep && rep.seen === false) api('POST', { action: 'seen', key: P.key }).catch(() => {}) }, [P?.key, rep?.seen])

  async function act(body, label) {
    setBusy(label); setErr('')
    try { await api('POST', body); await load() } catch (e) { setErr(e.message) }
    setBusy('')
  }
  const now = P?.now || {}, prev = P?.nowPrev || {}
  const done = new Set(rep?.rejected || [])
  const sugs = (rep?.suggestions || []).map((s, i) => ({ ...s, i })).filter(s => !done.has(s.i))

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#070b14', color: '#e6edf5', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <CSS />
      <div style={{ background: '#0a0a0a', height: 64, display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #2b2e36', color: '#cbd5e1', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>← Zentrale</button>
        <span style={{ fontWeight: 800, fontSize: 15 }}>📋 Bericht & Vorschläge</span>
        <span className="dv-only-d" style={{ color: '#6f8399', fontSize: 12.5 }}>David Lehmann · Strategie & Planung</span>
      </div>
      <div className="dv-wrap">
        <div className="dv-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{P?.nowLabel || 'Bericht'}</div>
            <div style={{ color: '#7d8fa3', fontSize: 12.5, marginTop: 3 }}>{P ? `Vergleich: ${P.nowPrevLabel}` : 'Lädt …'}</div>
          </div>
          <div className="dv-seg">{TABS.map(([v, n]) => <button key={v} className={k === v ? 'on' : ''} onClick={() => setK(v)}>{n}</button>)}</div>
        </div>
        {err && <div style={{ marginTop: 14, background: '#ef44441a', border: '1px solid #ef444466', color: '#f87171', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>{err}</div>}
        {!d && !err && <div className="dv-card" style={{ marginTop: 16, color: '#7d8fa3' }}>David holt die Zahlen …</div>}

        {P && <>
          <div className="dv-kpis">
            {[['Angebote', now.angebote, prev.angebote], ['Gemeldet', now.gemeldet, prev.gemeldet], ['Verkäufe', now.verkaeufe, prev.verkaeufe], ['Umsatz', now.umsatz, prev.umsatz, 1]].map(([l, v, pv, m]) => (
              <div key={l} className="dv-card dv-kpi"><div className="dv-lbl">{l}</div><div className="v">{m ? eur(v) : (v ?? 0)}</div><Delta cur={v ?? 0} prev={pv} money={m} /></div>
            ))}
            <div className="dv-card dv-kpi"><div className="dv-lbl">Kaufquote</div><div className="v">{now.conversion ?? 0}%</div><div style={{ color: '#7d8fa3', fontSize: 11.5 }}>Angebot → Kauf</div></div>
            <div className="dv-card dv-kpi"><div className="dv-lbl">Werbung</div><div className="v">{P.ads?.now == null ? '–' : eur(P.ads.now)}</div>
              <div style={{ color: '#7d8fa3', fontSize: 11.5 }}>{P.ads?.now == null ? 'nicht verbunden' : now.verkaeufe && P.ads.now ? `${eur(P.ads.now / now.verkaeufe)} pro Verkauf` : 'Meta Ads'}</div></div>
          </div>

          <div className="dv-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div className="dv-lbl">{k === 'week' ? 'Wochenbericht' : k === 'month' ? 'Monatsbericht' : 'Jahresbericht'} · {P.label}</div>
              <span style={{ color: '#7d8fa3', fontSize: 11.5 }}>{k === 'week' ? 'jeden Montag neu' : k === 'month' ? 'jeden 1. neu' : ''}</span>
            </div>
            {!rep ? <div style={{ color: '#7d8fa3', fontSize: 13, marginTop: 8 }}>Für diesen Zeitraum gibt es noch keinen Bericht.</div> : <>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 8 }}><b>Kurz:</b> {rep.summary}</p>
              <div className="dv-two" style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.55 }}>
                <div><b style={{ color: '#22c55e' }}>Gut gelaufen</b><ul style={{ margin: '6px 0 0 18px' }}>{(rep.good || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                <div><b style={{ color: '#ef4444' }}>Schlecht gelaufen</b><ul style={{ margin: '6px 0 0 18px' }}>{(rep.bad || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
              </div>
            </>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
            <b style={{ fontSize: 16 }}>💡 Davids Vorschläge</b>
            <span style={{ color: '#7d8fa3', fontSize: 12 }}>{sugs.length ? `${sugs.length} offen` : ''}</span>
          </div>
          {!rep ? null : sugs.length === 0 ? <div className="dv-card" style={{ color: '#7d8fa3', fontSize: 13 }}>Alle Vorschläge sind weggeklickt. Mit „Bericht neu schreiben“ bekommst du neue.</div> :
            <div className="dv-sug">{sugs.map((s, n) => {
              const c = SCOL[n % 3]
              return (
                <div key={s.i} className="dv-card" style={{ borderColor: c + '44', display: 'flex', flexDirection: 'column', gap: 9, opacity: busy === 'rej' + s.i ? .4 : 1 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: c + '22', color: c, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{n + 1}</span>
                    <b style={{ fontSize: 14.5, lineHeight: 1.35, flex: 1 }}>{s.title}</b>
                    <button title="Vorschlag entfernen" disabled={!!busy} onClick={() => act({ action: 'reject', key: P.key, i: s.i }, 'rej' + s.i)} style={{ background: 'none', border: 'none', color: '#6f8399', fontSize: 17, cursor: 'pointer', lineHeight: 1, padding: 2 }}>✕</button>
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                    {s.what && <><div className="dv-lbl" style={{ fontSize: 9.5 }}>Was</div><div style={{ margin: '2px 0 7px' }}>{s.what}</div></>}
                    {s.why && <><div className="dv-lbl" style={{ fontSize: 9.5 }}>Warum</div><div style={{ marginTop: 2, color: '#9fb3c8' }}>{s.why}</div></>}
                  </div>
                </div>
              )
            })}</div>}

          <div className="dv-card dv-foot" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, color: '#7d8fa3', fontSize: 12.5 }}>Mit ✕ entfernst du einen Vorschlag. David schlägt so etwas dann nicht mehr vor.</span>
            <button disabled={!!busy} onClick={() => act({ action: 'report', period: k }, 'rep')} style={GHOST}>{busy === 'rep' ? 'David schreibt …' : '↻ Bericht neu schreiben'}</button>
          </div>
        </>}
      </div>
    </div>
  )
}
