'use client'
import { useEffect, useMemo, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// Ads-Analyse (Paul Neumann, nur Administratoren): Meta-Werbekosten, Leads, Kosten pro Lead,
// Bestellungen im Zeitraum und Bewertung jeder Anzeige.
// Pauls Empfehlungen (Pausieren, Budget ±30%) laufen NUR nach Klick auf "Freigeben" (/api/ads/action).
// Klassen heißen "pn-…" statt "ad-…", weil Werbeblocker alles mit "ad-" ausblenden.
const NEON = '#22d3ee'
const START = '2026-03-01'
const eur = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dm = (s) => { const [, m, d] = s.split('-'); return `${+d}.${+m}.` }
const sum = (l, k) => l.reduce((a, o) => a + (o[k] || 0), 0)

const RANGES = [
  ['week', 'Diese Woche'], ['7', 'Letzte 7 Tage'], ['month', 'Dieser Monat'],
  ['lastmonth', 'Letzter Monat'], ['30', 'Letzte 30 Tage'], ['all', 'Seit März 2026'],
]
function rangeOf(k) {
  const t = new Date(); t.setHours(12, 0, 0, 0)
  const back = (n) => { const d = new Date(t); d.setDate(d.getDate() - n); return d }
  if (k === 'week') return { since: iso(back((t.getDay() + 6) % 7)), until: iso(t) }
  if (k === '7') return { since: iso(back(6)), until: iso(t) }
  if (k === '30') return { since: iso(back(29)), until: iso(t) }
  if (k === 'month') return { since: iso(new Date(t.getFullYear(), t.getMonth(), 1)), until: iso(t) }
  if (k === 'lastmonth') return { since: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), until: iso(new Date(t.getFullYear(), t.getMonth(), 0)) }
  return { since: START, until: iso(t) }
}

// Bewertung einer Anzeige im Vergleich zum Durchschnitt (Kosten pro Lead)
const RATE = {
  win: ['🏆 Gewinner', '#22c55e'], good: ['Gut', NEON], weak: ['Schwach', '#f59e0b'],
  burn: ['Verbrennt Geld', '#ef4444'], few: ['Zu wenig Daten', '#7d8fa3'],
}
function rate(a, avg) {
  if (a.leads > 0) {
    if (!avg) return 'good'
    if (a.leads < 3) return a.cpl > avg * 1.6 ? 'burn' : 'few' // unter 3 Anfragen kann es Zufall sein
    if (a.cpl <= avg * 0.8) return 'win'
    if (a.cpl <= avg * 1.1) return 'good'
    if (a.cpl <= avg * 1.6) return 'weak'
    return 'burn'
  }
  return a.spend >= (avg || 20) ? 'burn' : 'few'
}
const ORDER = ['win', 'good', 'weak', 'burn', 'few'] // Reihenfolge der Liste
const isActive = (s) => s === 'ACTIVE'

function CSS() {
  return <style>{`
    .pn-wrap{max-width:1100px;margin:0 auto;padding:28px 24px 50px}
    .pn-card{background:#0e1522;border:1px solid #1b2738;border-radius:18px;padding:20px}
    .pn-lbl{font-size:10.5px;font-weight:800;letter-spacing:1.2px;color:#6f8399;text-transform:uppercase}
    .pn-big{font-size:32px;font-weight:900;line-height:1.15;letter-spacing:-.4px;margin-top:6px}
    .pn-sub{color:#7d8fa3;font-size:12px;margin-top:6px;line-height:1.4}
    .pn-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}
    .pn-sel{appearance:none;-webkit-appearance:none;background:#0a101b url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2322d3ee' stroke-width='2' fill='none'/%3E%3C/svg%3E") no-repeat right 13px center;border:1px solid #2a3b52;border-radius:11px;padding:10px 38px 10px 13px;font-weight:700;font-size:14px;color:#e6edf5;font-family:inherit;cursor:pointer;max-width:260px}
    .pn-row{display:flex;gap:12px;align-items:center;padding:11px 0;border-bottom:1px dashed #1f2c3f}
    .pn-thumb{width:56px;height:56px;border-radius:10px;flex:none;object-fit:cover;background:#0a101b;border:1px solid #1b2738}
    .pn-chip{font-size:11px;font-weight:800;border-radius:8px;padding:4px 8px;white-space:nowrap}
    .pn-only-m{display:none}
    .pn-recs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .pn-hist{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px dashed #1f2c3f;font-size:12.5px}
    @media (max-width: 760px){
      .pn-wrap{padding:16px 12px 40px}
      .pn-kpis{grid-template-columns:1fr 1fr;gap:10px}.pn-kpis > div:last-child{grid-column:span 2}
      .pn-card{padding:14px}
      .pn-big{font-size:24px}
      .pn-only-d{display:none !important}
      .pn-only-m{display:block}
      .pn-head{flex-direction:column;align-items:stretch !important}
      .pn-sels{width:100%}.pn-sels > div{flex:1;min-width:0}.pn-sel{width:100%;max-width:none}
      .pn-thumb{width:46px;height:46px}
      .pn-recs{grid-template-columns:1fr}
      .pn-hist{flex-wrap:wrap}
      .pn-btns{flex-direction:column}
    }
  `}</style>
}

async function authed(url) {
  const { data: s } = await authClient().auth.getSession()
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + (s.session?.access_token || '') } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'Fehler beim Laden')
  return j
}

async function authedPost(url, body) {
  const { data: s } = await authClient().auth.getSession()
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s.session?.access_token || '') }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'Fehler')
  return j
}

const BTN = { borderRadius: 10, padding: '9px 13px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', border: 'none', whiteSpace: 'nowrap' }
const GHOST = { ...BTN, background: 'transparent', border: '1px solid #2a3b52', color: '#b9c7d6' }
const dt = (s) => { const d = new Date(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}. ${pad(d.getHours())}:${pad(d.getMinutes())}` }

// Pauls Empfehlungen, Höchstbudget und Verlauf
function PaulPanel({ ads, onChanged, onSwap, tick }) {
  const [act, setAct] = useState(null)
  const [ask, setAsk] = useState(null) // Empfehlung, die gerade freigegeben werden soll
  const [busy, setBusy] = useState(false)
  const [capEdit, setCapEdit] = useState(null)
  const [msg, setMsg] = useState('')
  const loadAct = () => authed('/api/ads/action').then(setAct).catch(e => setMsg(e.message))
  useEffect(() => { loadAct() }, [tick])

  const cap = act?.cap || 30, total = act?.total
  const avg = ads?.totals?.cpl || null
  const all = (ads?.ads || []).filter(a => a.spend > 0).map(a => ({ ...a, r: rate(a, avg) }))
  const live = all.filter(a => isActive(a.status))
  const target = (a) => a.adset?.daily_budget ? { id: a.adset.id, level: 'adset', name: a.adset.name, budget: a.adset.daily_budget }
    : a.campaign?.daily_budget ? { id: a.campaign.id, level: 'campaign', name: a.campaign.name, budget: a.campaign.daily_budget } : null

  const recs = []
  const seen = new Set()
  for (const a of live.filter(x => x.r === 'burn')) recs.push({ key: 'pause:' + a.id, kind: 'pause', ad: a })
  for (const a of live.filter(x => x.r === 'win')) {
    const t = target(a); if (!t || seen.has(t.id)) continue; seen.add(t.id)
    const room = total != null ? Math.floor((cap - total) / t.budget * 100) : 30
    recs.push({ key: 'up:' + t.id, kind: 'up', ad: a, t, pct: Math.max(0, Math.min(30, room)) })
  }
  for (const a of live.filter(x => x.r === 'weak')) {
    const t = target(a); if (!t || seen.has(t.id)) continue; seen.add(t.id)
    recs.push({ key: 'down:' + t.id, kind: 'down', ad: a, t, pct: -30 })
  }
  // Schwache / teure Anzeigen: neues Creative vorschlagen
  for (const a of live.filter(x => x.r === 'weak' || x.r === 'burn')) recs.push({ key: 'swap:' + a.id, kind: 'swap', ad: a })
  const open = recs.filter(r => !(act?.ignored || []).includes(r.key))
  const newBudget = (r) => Math.max(1, Math.round(r.t.budget * (1 + r.pct / 100)))

  async function run(body, ok) {
    setBusy(true); setMsg('')
    try { await authedPost('/api/ads/action', body); setAsk(null); await loadAct(); if (ok) onChanged() }
    catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  const approve = (r) => r.kind === 'pause'
    ? run({ kind: 'pause', adId: r.ad.id, name: r.ad.name }, true)
    : run({ kind: 'budget', objId: r.t.id, level: r.t.level, pct: r.pct, name: r.t.name }, true)
  const saveCap = () => run({ kind: 'cap', value: capEdit }).then(() => setCapEdit(null))

  const card = (r) => {
    const c = r.kind === 'pause' ? '#ef4444' : r.kind === 'up' ? '#22c55e' : '#f59e0b'
    const ic = r.kind === 'pause' ? '⏸' : r.kind === 'up' ? '🚀' : r.kind === 'swap' ? '🔄' : '📉'
    const title = r.kind === 'pause' ? `„${r.ad.name}“ pausieren` : r.kind === 'up' ? 'Gewinner hochfahren' : r.kind === 'swap' ? 'Creative austauschen' : 'Budget senken'
    const desc = r.kind === 'swap' ? `„${r.ad.name}“ ist ${r.ad.r === 'burn' ? 'zu teuer' : 'schwach'}${r.ad.cpl ? ` (${eur(r.ad.cpl)} pro Anfrage)` : ''}. Neues Bild oder Video rein, die alte Anzeige wird pausiert.`
      : r.kind === 'pause'
      ? (r.ad.leads ? `${eur(r.ad.spend)} für ${r.ad.leads} ${r.ad.leads === 1 ? 'Anfrage' : 'Anfragen'} (${eur(r.ad.cpl)} pro Anfrage). Der Schnitt liegt bei ${eur(avg)}.` : `${eur(r.ad.spend)} ausgegeben, 0 Anfragen. Der Schnitt liegt bei ${avg ? eur(avg) : '–'} pro Anfrage.`)
      : r.kind === 'up' ? `„${r.ad.name}“ bringt Anfragen für ${eur(r.ad.cpl)}. Budget von „${r.t.name}“ +${r.pct}%.`
      : `„${r.ad.name}“ ist schwach (${eur(r.ad.cpl)} pro Anfrage). Budget von „${r.t.name}“ -30%.`
    const blocked = r.kind === 'up' && r.pct < 5
    return (
      <div key={r.key} style={{ border: `1px solid ${c}55`, background: `${c}0d`, borderRadius: 16, padding: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}><span style={{ fontSize: 19 }}>{ic}</span><div><b style={{ fontSize: 14 }}>{title}</b><div style={{ color: '#7d8fa3', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{desc}</div></div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0a101b', border: '1px solid #223146', borderRadius: 11, padding: '9px 12px', fontSize: 13 }}>
          {r.kind === 'swap' ? <>{r.ad.thumb ? <img src={r.ad.thumb} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} /> : null}<span style={{ color: c }}>→</span><span style={{ width: 40, height: 40, borderRadius: 8, border: `1.5px dashed ${c}88`, color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>+</span><span style={{ color: '#7d8fa3', fontSize: 11.5 }}>Neues Creative vom PC</span></>
            : r.kind === 'pause' ? <><span style={{ color: '#7d8fa3' }}>● aktiv</span><span style={{ color: c }}>→</span><b style={{ color: c }}>⏸ pausiert</b></>
            : blocked ? <span style={{ color: '#f59e0b' }}>Höchstbudget erreicht. Erhöhe es oben, wenn du mehr ausgeben willst.</span>
            : <><span style={{ color: '#7d8fa3' }}>{eur(r.t.budget)} / Tag</span><span style={{ color: c }}>→</span><b style={{ color: c }}>{eur(newBudget(r))} / Tag</b></>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
          {r.kind === 'swap'
            ? <button disabled={busy} onClick={() => onSwap(r.ad)} style={{ ...BTN, background: c, color: '#04101f' }}>📁 Creative wählen</button>
            : <button disabled={blocked || busy} onClick={() => setAsk(r)} style={{ ...BTN, background: c, color: r.kind === 'pause' ? '#fff' : '#04101f', opacity: blocked ? .4 : 1 }}>✓ Freigeben</button>}
          <button disabled={busy} onClick={() => run({ kind: 'ignore', key: r.key })} style={GHOST}>Ignorieren</button>
        </div>
      </div>
    )
  }

  const totalAfter = ask && ask.kind !== 'pause' && total != null ? total - ask.t.budget + newBudget(ask) : null
  return <>
    <div className="pn-card" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 18px' }}>
      <div style={{ flex: 1, minWidth: 220 }}><div className="pn-lbl">Höchstbudget pro Tag</div><div style={{ color: '#7d8fa3', fontSize: 12, marginTop: 4 }}>Paul erhöht Budgets nie über diese Grenze (alle Kampagnen zusammen).</div></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div><div style={{ color: '#7d8fa3', fontSize: 11 }}>Aktuell</div><b style={{ fontSize: 16 }}>{total != null ? eur(total) : '–'}</b><span style={{ color: '#7d8fa3', fontSize: 12 }}> / Tag</span></div>
        <div style={{ width: 140 }}><div style={{ height: 8, background: '#1b2738', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, (total || 0) / cap * 100)}%`, height: '100%', background: (total || 0) > cap ? '#ef4444' : NEON }} /></div><div style={{ color: '#7d8fa3', fontSize: 11, marginTop: 4 }}>{Math.round((total || 0) / cap * 100)}% genutzt</div></div>
        {capEdit == null
          ? <button onClick={() => setCapEdit(String(cap).replace('.', ','))} style={{ ...GHOST, fontSize: 14, color: '#fff' }}>{eur(cap)} <span style={{ color: NEON }}>✎</span></button>
          : <span style={{ display: 'inline-flex', gap: 6 }}><input autoFocus value={capEdit} onChange={e => setCapEdit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveCap(); if (e.key === 'Escape') setCapEdit(null) }} style={{ width: 80, background: '#0a101b', border: `1px solid ${NEON}`, borderRadius: 9, padding: '8px 10px', color: '#fff', fontFamily: 'inherit', fontSize: 14, textAlign: 'right' }} /><button onClick={saveCap} disabled={busy} style={{ ...BTN, background: NEON, color: '#03121a' }}>✓</button></span>}
      </div>
    </div>

    {msg && <div className="pn-card" style={{ marginTop: 12, padding: '12px 16px', borderColor: '#ef444466', color: '#f87171', fontSize: 13 }}>{msg}</div>}

    <div className="pn-card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><b style={{ fontSize: 15 }}>💡 Pauls Empfehlungen</b><span style={{ color: '#7d8fa3', fontSize: 12 }}>{open.length} offen</span></div>
      {live.length === 0 ? <div style={{ color: '#7d8fa3', fontSize: 13 }}>Gerade läuft keine Anzeige. Paul meldet sich hier, sobald eine aktiv ist.</div>
        : open.length === 0 ? <div style={{ color: '#7d8fa3', fontSize: 13 }}>Alles im grünen Bereich. Gerade gibt es nichts zu ändern.</div>
        : <div className="pn-recs">{open.map(card)}</div>}
      <div style={{ color: '#55677c', fontSize: 11.5, marginTop: 10 }}>Paul ändert nie etwas allein. Erst dein Klick auf „Freigeben“ ändert die Anzeige bei Meta.</div>
    </div>

    <div className="pn-card" style={{ marginTop: 16 }}>
      <b style={{ fontSize: 15 }}>🕘 Verlauf</b>
      {!(act?.log || []).length ? <div style={{ color: '#7d8fa3', fontSize: 13, marginTop: 8 }}>Noch keine Änderungen.</div> : <div style={{ marginTop: 6 }}>
        {act.log.slice(0, 15).map(e => {
          const c = e.kind === 'pause' ? '#ef4444' : e.kind === 'swap' ? '#f59e0b' : e.after > e.before ? '#22c55e' : '#f59e0b'
          return (
            <div key={e.id} className="pn-hist" style={{ opacity: e.undone ? .5 : 1 }}>
              <span style={{ color: '#7d8fa3', width: 92, flex: 'none' }}>{dt(e.at)}</span>
              <b style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kind === 'budget' ? `Budget „${e.name}“` : e.kind === 'swap' ? 'Creative getauscht' : `„${e.name}“`}</b>
              <span style={{ color: c }}>{e.kind === 'pause' ? 'pausiert' : e.kind === 'swap' ? `„${e.name}“ → neue Anzeige „${e.newName}“` : `${eur(e.before / 100)} → ${eur(e.after / 100)} / Tag`}</span>
              {e.undone ? <span style={{ color: '#7d8fa3', fontSize: 11.5 }}>↩ rückgängig</span>
                : <button disabled={busy} onClick={() => run({ kind: 'undo', logId: e.id }, true)} style={{ ...GHOST, padding: '5px 9px', fontSize: 11.5 }}>↩ Rückgängig</button>}
            </div>
          )
        })}
      </div>}
    </div>

    {ask && <div onClick={() => !busy && setAsk(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#0e1522', border: '1px solid #22d3ee55', borderRadius: 22, padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <b style={{ fontSize: 17 }}>{ask.kind === 'pause' ? '⏸ Anzeige pausieren?' : ask.kind === 'up' ? '🚀 Budget erhöhen freigeben?' : '📉 Budget senken freigeben?'}</b>
        <div style={{ color: '#7d8fa3', fontSize: 12.5, marginTop: 6 }}>{ask.kind === 'pause' ? `„${ask.ad.name}“ · ${ask.ad.campaign?.name || ''}` : `„${ask.t.name}“ · wegen „${ask.ad.name}“`}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', marginTop: 16 }}>
          <div style={{ background: '#0a101b', border: '1px solid #223146', borderRadius: 14, padding: 14 }}><div className="pn-lbl">Vorher</div><div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{ask.kind === 'pause' ? 'aktiv' : eur(ask.t.budget)}</div>{ask.kind !== 'pause' && <div style={{ color: '#7d8fa3', fontSize: 11 }}>pro Tag</div>}</div>
          <span style={{ color: NEON, fontSize: 20 }}>→</span>
          <div style={{ background: '#0a101b', border: `1px solid ${ask.kind === 'pause' ? '#ef4444' : ask.kind === 'up' ? '#22c55e' : '#f59e0b'}66`, borderRadius: 14, padding: 14 }}><div className="pn-lbl">Nachher</div><div style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: ask.kind === 'pause' ? '#ef4444' : ask.kind === 'up' ? '#22c55e' : '#f59e0b' }}>{ask.kind === 'pause' ? 'pausiert' : eur(newBudget(ask))}</div>{ask.kind !== 'pause' && <div style={{ color: '#7d8fa3', fontSize: 11 }}>pro Tag · {ask.pct > 0 ? '+' : ''}{ask.pct}%</div>}</div>
        </div>
        {totalAfter != null && <div style={{ marginTop: 14, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7d8fa3' }}>Alle Kampagnen zusammen</span><b>{eur(totalAfter)} / Tag</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#7d8fa3' }}>Dein Höchstbudget</span><b>{eur(cap)} / Tag {totalAfter <= cap ? <span style={{ color: '#22c55e' }}>✓</span> : <span style={{ color: '#ef4444' }}>✕</span>}</b></div>
        </div>}
        <div style={{ color: '#7d8fa3', fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>Die Änderung wird sofort bei Meta gespeichert. Im Verlauf kannst du sie rückgängig machen.</div>
        {msg && <div style={{ color: '#f87171', fontSize: 12.5, marginTop: 10 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button disabled={busy} onClick={() => approve(ask)} style={{ ...BTN, flex: 1, padding: 13, fontSize: 14, background: ask.kind === 'pause' ? '#ef4444' : ask.kind === 'up' ? '#22c55e' : '#f59e0b', color: ask.kind === 'pause' ? '#fff' : '#04101f' }}>{busy ? 'Paul ändert …' : '✓ Freigeben'}</button>
          <button disabled={busy} onClick={() => setAsk(null)} style={{ ...GHOST, padding: '13px 18px', fontSize: 14 }}>Abbrechen</button>
        </div>
      </div>
    </div>}
  </>
}

// Creative austauschen: neues Bild/Video vom PC -> neue Anzeige in derselben Anzeigengruppe, alte wird pausiert
function SwapModal({ ad, onClose, onDone }) {
  const [info, setInfo] = useState(null)
  const [file, setFile] = useState(null)
  const [prev, setPrev] = useState('')
  const [step, setStep] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { authed('/api/ads/action?ad=' + encodeURIComponent(ad.id)).then(setInfo).catch(e => setMsg(e.message)) }, [ad.id])
  useEffect(() => () => { if (prev) URL.revokeObjectURL(prev) }, [prev])
  const isVid = file && /^video\//.test(file.type)
  const pick = (f) => {
    if (!f) return
    if (!/^(image\/(jpeg|png)|video\/(mp4|quicktime))$/.test(f.type)) { setMsg('Bitte ein Bild (JPG/PNG) oder Video (MP4/MOV) wählen'); return }
    if (f.size > 50 * 1024 * 1024) { setMsg('Datei ist zu groß (max. 50 MB)'); return }
    setMsg(''); setFile(f); setPrev(URL.createObjectURL(f))
  }
  async function go() {
    setMsg('')
    try {
      setStep('Datei wird hochgeladen …')
      const { path, token } = await authedPost('/api/ads/action', { kind: 'upload', name: file.name })
      const { error } = await authClient().storage.from('offer-images').uploadToSignedUrl(path, token, file, { contentType: file.type })
      if (error) throw new Error(error.message)
      setStep(isVid ? 'Video wird zu Meta hochgeladen …' : 'Paul legt die neue Anzeige an …')
      let r = await authedPost('/api/ads/action', { kind: 'swap', adId: ad.id, path, type: isVid ? 'video' : 'image' })
      for (let i = 0; r.wait && i < 60; i++) {
        setStep('Meta verarbeitet das Video … (kann 1 bis 3 Minuten dauern)')
        await new Promise(res => setTimeout(res, 5000))
        r = await authedPost('/api/ads/action', { kind: 'swap', adId: ad.id, path, type: 'video', videoId: r.wait })
      }
      if (r.wait) throw new Error('Meta braucht zu lange für das Video. Bitte später nochmal versuchen.')
      onDone()
    } catch (e) { setMsg(e.message); setStep('') }
  }
  const busy = !!step
  const row = (k, v) => v ? <div style={{ display: 'flex', gap: 10 }}><span style={{ color: '#7d8fa3', width: 82, flex: 'none' }}>{k}</span><span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span></div> : null
  return (
    <div onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, maxHeight: '96vh', overflowY: 'auto', background: '#0e1522', border: '1px solid #22d3ee55', borderRadius: 22, padding: 20, boxShadow: '0 30px 80px rgba(0,0,0,.6)' }}>
        <b style={{ fontSize: 17 }}>🔄 Creative austauschen</b>
        <div style={{ color: '#7d8fa3', fontSize: 12.5, marginTop: 6 }}>{ad.adset?.name ? `Anzeigengruppe „${ad.adset.name}“` : ad.campaign?.name}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
          <div style={{ background: '#0a101b', border: '1px solid #223146', borderRadius: 14, padding: 12, textAlign: 'center' }}>
            <div className="pn-lbl" style={{ marginBottom: 8 }}>Alt · wird pausiert</div>
            {ad.thumb ? <img src={info?.thumb || ad.thumb} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, opacity: .6 }} /> : <div style={{ aspectRatio: '1', borderRadius: 10, background: '#0e1522' }} />}
            <div style={{ color: '#7d8fa3', fontSize: 11, marginTop: 6 }}>{ad.name}{ad.cpl ? ` · ${eur(ad.cpl)} pro Anfrage` : ''}</div>
          </div>
          <label style={{ background: '#0a101b', border: `1px ${file ? 'solid' : 'dashed'} #f59e0b88`, borderRadius: 14, padding: 12, textAlign: 'center', cursor: busy ? 'default' : 'pointer' }}>
            <div className="pn-lbl" style={{ marginBottom: 8, color: '#f59e0b' }}>Neu</div>
            <input type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime" disabled={busy} onChange={e => pick(e.target.files?.[0])} style={{ display: 'none' }} />
            {file ? (isVid ? <video src={prev} muted autoPlay loop playsInline style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }} /> : <img src={prev} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }} />)
              : <div style={{ aspectRatio: '1', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#f59e0b' }}><span style={{ fontSize: 30 }}>+</span><span style={{ fontSize: 12.5, fontWeight: 700 }}>Bild oder Video wählen</span><span style={{ color: '#7d8fa3', fontSize: 11 }}>JPG, PNG, MP4 · max. 50 MB</span></div>}
            {file && <div style={{ fontSize: 11, marginTop: 6, color: '#cfe3f5', overflowWrap: 'anywhere' }}>{file.name} · <span style={{ color: NEON }}>ändern</span></div>}
          </label>
        </div>
        <div style={{ background: '#0a101b', border: '1px solid #223146', borderRadius: 14, padding: 14, marginTop: 14, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="pn-lbl" style={{ marginBottom: 2 }}>Wird von der alten Anzeige übernommen</div>
          {!info ? <span style={{ color: '#7d8fa3' }}>{msg ? '–' : 'Paul liest die alte Anzeige …'}</span> : <>
            {row('Text', info.message && `„${info.message.length > 160 ? info.message.slice(0, 160) + ' …' : info.message}“`)}
            {row('Überschrift', info.headline)}
            {row('Link', info.link)}
            {row('Button', info.ctaText)}
          </>}
        </div>
        <div style={{ color: '#7d8fa3', fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>Bei „Freigeben“ lädt Paul das Creative zu Meta hoch, startet eine neue Anzeige in derselben Anzeigengruppe und pausiert die alte. Im Verlauf kannst du es rückgängig machen.</div>
        {msg && <div style={{ color: '#f87171', fontSize: 12.5, marginTop: 10 }}>{msg}</div>}
        {step && <div style={{ color: NEON, fontSize: 12.5, marginTop: 10 }}>⏳ {step}</div>}
        <div className="pn-btns" style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button disabled={!file || !info || busy} onClick={go} style={{ ...BTN, flex: 1, padding: 13, fontSize: 14, background: '#f59e0b', color: '#04101f', opacity: !file || !info ? .45 : 1 }}>{busy ? 'Paul arbeitet …' : '✓ Freigeben & austauschen'}</button>
          <button disabled={busy} onClick={onClose} style={{ ...GHOST, padding: '13px 18px', fontSize: 14 }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

// Für die Zentrale: offene Empfehlungen zählen (gleiche Regeln wie in PaulPanel)
export function openRecCount(ads, ignored = []) {
  const avg = ads?.totals?.cpl || null
  const live = (ads?.ads || []).filter(a => a.spend > 0 && isActive(a.status)).map(a => ({ ...a, r: rate(a, avg) }))
  const keyOf = (a) => a.adset?.daily_budget ? a.adset.id : a.campaign?.daily_budget ? a.campaign.id : null
  const keys = [], seen = new Set()
  for (const a of live) if (a.r === 'burn') keys.push('pause:' + a.id)
  for (const a of live) if (a.r === 'win') { const t = keyOf(a); if (t && !seen.has(t)) { seen.add(t); keys.push('up:' + t) } }
  for (const a of live) if (a.r === 'weak') { const t = keyOf(a); if (t && !seen.has(t)) { seen.add(t); keys.push('down:' + t) } }
  for (const a of live) if (a.r === 'weak' || a.r === 'burn') keys.push('swap:' + a.id)
  return keys.filter(k => !ignored.includes(k)).length
}

export default function AdsPage({ onBack }) {
  const [rk, setRk] = useState('30')
  const [camp, setCamp] = useState('all')
  const [ads, setAds] = useState(null)
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [at, setAt] = useState(null)
  const [allAds, setAllAds] = useState(false)
  const [reload, setReload] = useState(0)
  const [swap, setSwap] = useState(null)
  const range = rangeOf(rk)

  useEffect(() => { authed('/api/stats').then(setStats).catch(() => setStats({ orders: [] })) }, [])
  useEffect(() => {
    let off = false
    setLoading(true); setErr('')
    authed(`/api/ads?since=${range.since}&until=${range.until}`)
      .then(j => { if (!off) { setAds(j); setAt(new Date()) } })
      .catch(e => { if (!off) setErr(e.message) })
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [rk, reload])

  // Kampagnen-Auswahl (nur Kampagnen mit Daten im Zeitraum oder aktive)
  const camps = useMemo(() => {
    const m = new Map()
    for (const a of ads?.ads || []) if (a.campaign?.id && (a.spend > 0 || isActive(a.status))) m.set(a.campaign.id, a.campaign.name || a.campaign.id)
    return [...m.entries()]
  }, [ads])

  const list = (ads?.ads || []).filter(a => camp === 'all' || a.campaign?.id === camp)
  const withData = list.filter(a => a.spend > 0)
  const spend = camp === 'all' ? ads?.totals?.spend || 0 : sum(withData, 'spend')
  const leads = camp === 'all' ? ads?.totals?.leads || 0 : sum(withData, 'leads')
  const cpl = leads ? spend / leads : null
  const rated = withData.map(a => ({ ...a, r: rate(a, cpl) }))
    .sort((x, y) => ORDER.indexOf(x.r) - ORDER.indexOf(y.r) || (x.leads ? x.cpl : 1e9) - (y.leads ? y.cpl : 1e9) || y.spend - x.spend)

  // Bestellungen + Gewinn im selben Zeitraum (aus der Statistik)
  const orders = (stats?.orders || []).filter(o => { const d = iso(new Date(o.date)); return d >= range.since && d <= range.until })
  const activeCount = list.filter(a => isActive(a.status)).length

  // Diagramm: pro Tag, bei langen Zeiträumen pro Woche
  const bars = useMemo(() => {
    const byDay = Object.fromEntries((ads?.days || []).map(d => [d.date, d]))
    const out = []
    const d = new Date(range.since + 'T12:00:00'), end = new Date(range.until + 'T12:00:00')
    while (d <= end) { const k = iso(d); out.push({ date: k, spend: byDay[k]?.spend || 0, leads: byDay[k]?.leads || 0 }); d.setDate(d.getDate() + 1) }
    if (out.length <= 45) return out.map(x => ({ ...x, label: dm(x.date) }))
    const w = []
    for (let i = 0; i < out.length; i += 7) { const ch = out.slice(i, i + 7); w.push({ label: dm(ch[0].date), spend: sum(ch, 'spend'), leads: sum(ch, 'leads') }) }
    return w
  }, [ads, rk])
  const maxS = Math.max(1, ...bars.map(b => b.spend)), maxL = Math.max(1, ...bars.map(b => b.leads))
  const showLbl = (i) => bars.length <= 16 || i % Math.ceil(bars.length / 12) === 0

  const rName = RANGES.find(r => r[0] === rk)[1]
  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#070b14', color: '#e6edf5', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <CSS />
      <div style={{ background: '#0a0a0a', height: 64, display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #2b2e36', color: '#cbd5e1', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>← Zentrale</button>
        <span style={{ fontWeight: 800, fontSize: 15 }}>📈 Ads-Analyse</span>
        <span className="pn-only-d" style={{ color: '#6f8399', fontSize: 12.5 }}>Paul Neumann · Ads-Analyst</span>
      </div>

      <div className="pn-wrap">
        <div className="pn-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>Ads-Analyse</div>
            <div style={{ color: '#7d8fa3', fontSize: 12.5, marginTop: 3 }}>
              {ads?.account ? <>Meta Ads · {ads.account.name} · verbunden <span style={{ color: '#22c55e' }}>✓</span>{at && <> · aktualisiert {at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</>}</> : 'Meta Ads'}
              {loading && ads && <span style={{ color: NEON }}> · lädt …</span>}
            </div>
          </div>
          <div className="pn-sels" style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span className="pn-lbl">Zeitraum</span>
              <select className="pn-sel" value={rk} onChange={e => setRk(e.target.value)}>
                {RANGES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span className="pn-lbl">Kampagne</span>
              <select className="pn-sel" value={camp} onChange={e => setCamp(e.target.value)}>
                <option value="all">Alle</option>
                {camps.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        {err && <div className="pn-card" style={{ marginTop: 18, borderColor: '#ef444466', color: '#ef4444' }}>Fehler: {err}</div>}
        {!ads && !err && <div className="pn-card" style={{ marginTop: 18, color: '#7d8fa3' }}>Paul holt die Zahlen von Meta …</div>}

        {ads && <>
          {activeCount === 0 && <div className="pn-card" style={{ marginTop: 18, padding: '12px 16px', borderColor: '#f59e0b55', background: '#f59e0b0d', color: '#f5c46b', fontSize: 13 }}>
            ⏸ Gerade läuft keine Anzeige{camp !== 'all' ? ' in dieser Kampagne' : ''}. Die Zahlen unten sind aus dem gewählten Zeitraum.
          </div>}

          <div className="pn-kpis">
            <div className="pn-card">
              <div className="pn-lbl">Werbekosten</div>
              <div className="pn-big">{eur(spend)}</div>
              <div className="pn-sub">Meta Ads · {dm(range.since)} bis {dm(range.until)}</div>
            </div>
            <div className="pn-card">
              <div className="pn-lbl">Anfragen</div>
              <div className="pn-big">{leads}</div>
              <div className="pn-sub">{(ads.leadEvent || []).join(', ') || 'Leads'}{cpl ? ` · ${eur(cpl)} pro Anfrage` : ''}</div>
            </div>
            <div className="pn-card">
              <div className="pn-lbl">Bestellungen</div>
              <div className="pn-big">{orders.length}</div>
              <div className="pn-sub">{orders.length && leads ? `≈ 1 von ${Math.max(1, Math.round(leads / orders.length))} Anfragen` : 'im Zeitraum'}</div>
            </div>
          </div>

          <div className="pn-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Werbekosten & Anfragen {bars.length > 45 ? 'pro Woche' : 'pro Tag'}{camp !== 'all' ? <span style={{ color: '#7d8fa3', fontWeight: 600, fontSize: 12 }}> · alle Kampagnen</span> : null}</div>
              <span style={{ color: '#7d8fa3', fontSize: 12 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: '#3b4d66', borderRadius: 3 }} /> Kosten &nbsp; <span style={{ display: 'inline-block', width: 10, height: 10, background: NEON, borderRadius: '50%' }} /> Anfragen</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: bars.length > 20 ? 2 : 8, height: 160, marginTop: 14 }}>
              {bars.map((b, i) => (
                <div key={i} title={`${b.label}  ${eur(b.spend)} · ${b.leads} Anfragen`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                  <div style={{ flex: 1, width: '100%', position: 'relative' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${b.spend / maxS * 78}%`, background: '#3b4d66', borderRadius: '4px 4px 0 0' }} />
                    {b.leads > 0 && <span style={{ position: 'absolute', left: '50%', bottom: `${b.leads / maxL * 88 + 4}%`, transform: 'translate(-50%,50%)', width: 8, height: 8, borderRadius: '50%', background: NEON, boxShadow: `0 0 6px ${NEON}` }} />}
                  </div>
                  <span style={{ color: '#7d8fa3', fontSize: 10, marginTop: 4, height: 12, whiteSpace: 'nowrap' }}>{showLbl(i) ? b.label : ''}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pn-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Anzeigen</div>
              <span style={{ color: '#7d8fa3', fontSize: 12 }}>{rated.length} mit Kosten · {activeCount} aktiv</span>
            </div>
            {rated.length === 0 ? <div style={{ color: '#7d8fa3', fontSize: 13, padding: '16px 0 4px' }}>Im Zeitraum „{rName}“ hatte keine Anzeige Kosten.</div> : <div style={{ marginTop: 6 }}>
              {(allAds ? rated : rated.slice(0, 8)).map(a => {
                const [rl, rc] = RATE[a.r]
                return (
                  <div key={a.id} className="pn-row">
                    {a.thumb ? <img className="pn-thumb" src={a.thumb} alt="" /> : <div className="pn-thumb" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                      <div style={{ color: '#7d8fa3', fontSize: 11.5, marginTop: 2 }}>
                        {eur(a.spend)} · {a.leads} {a.leads === 1 ? 'Anfrage' : 'Anfragen'} · CTR {(a.ctr || 0).toLocaleString('de-DE')}%
                        <span className="pn-only-m">{a.cpl ? `${eur(a.cpl)} pro Anfrage` : 'keine Anfrage'}</span>
                      </div>
                      <div style={{ fontSize: 11, marginTop: 2, color: isActive(a.status) ? '#22c55e' : '#6f8399' }}>{isActive(a.status) ? '● aktiv' : '⏸ pausiert'}<span className="pn-only-d" style={{ display: 'inline', color: '#55677c' }}> · {a.campaign?.name}</span></div>
                    </div>
                    <div className="pn-only-d" style={{ textAlign: 'right', width: 120 }}>
                      <div className="pn-lbl">pro Anfrage</div>
                      <b>{a.cpl ? eur(a.cpl) : '–'}</b>
                    </div>
                    <span className="pn-chip" style={{ color: rc, border: `1px solid ${rc}66`, background: `${rc}14` }}>{rl}</span>
                    <button title="Creative austauschen" onClick={() => setSwap(a)} style={{ ...GHOST, padding: '5px 8px', fontSize: 13 }}>🔄</button>
                  </div>
                )
              })}
              {rated.length > 8 && <button onClick={() => setAllAds(v => !v)} style={{ width: '100%', marginTop: 12, background: 'transparent', border: '1px dashed #2a3b52', color: '#9fb3c8', borderRadius: 12, padding: '11px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{allAds ? 'Weniger anzeigen' : `Alle ${rated.length} anzeigen`}</button>}
            </div>}
            <div style={{ color: '#55677c', fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
              Bewertung nach Kosten pro Anfrage im Vergleich zum Schnitt ({cpl ? eur(cpl) : '–'}): Gewinner = mind. 20% günstiger, Gut = etwa Schnitt, Schwach = bis 60% teurer, Verbrennt Geld = noch teurer oder keine Anfrage trotz Kosten. Unter 3 Anfragen = Zu wenig Daten.
            </div>
          </div>

          <PaulPanel ads={ads} tick={reload} onChanged={() => setReload(n => n + 1)} onSwap={setSwap} />
          {swap && <SwapModal ad={swap} onClose={() => setSwap(null)} onDone={() => { setSwap(null); setReload(n => n + 1) }} />}
        </>}
      </div>
    </div>
  )
}
