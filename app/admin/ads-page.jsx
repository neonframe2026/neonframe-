'use client'
import { useEffect, useMemo, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// Ads-Analyse (Paul Neumann, nur Administratoren): Meta-Werbekosten, Leads, Kosten pro Lead,
// Bestellungen im Zeitraum und Bewertung jeder Anzeige.
// Nur Ansicht. Pauls Empfehlungen mit "Freigeben" kommen im nächsten Schritt.
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

export default function AdsPage({ onBack }) {
  const [rk, setRk] = useState('30')
  const [camp, setCamp] = useState('all')
  const [ads, setAds] = useState(null)
  const [stats, setStats] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [at, setAt] = useState(null)
  const [allAds, setAllAds] = useState(false)
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
  }, [rk])

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
                  </div>
                )
              })}
              {rated.length > 8 && <button onClick={() => setAllAds(v => !v)} style={{ width: '100%', marginTop: 12, background: 'transparent', border: '1px dashed #2a3b52', color: '#9fb3c8', borderRadius: 12, padding: '11px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{allAds ? 'Weniger anzeigen' : `Alle ${rated.length} anzeigen`}</button>}
            </div>}
            <div style={{ color: '#55677c', fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
              Bewertung nach Kosten pro Anfrage im Vergleich zum Schnitt ({cpl ? eur(cpl) : '–'}): Gewinner = mind. 20% günstiger, Gut = etwa Schnitt, Schwach = bis 60% teurer, Verbrennt Geld = noch teurer oder keine Anfrage trotz Kosten. Unter 3 Anfragen = Zu wenig Daten.
            </div>
          </div>
        </>}
      </div>
    </div>
  )
}
