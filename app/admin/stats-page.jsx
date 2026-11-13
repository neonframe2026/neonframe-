'use client'
import { useEffect, useMemo, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// Statistik (nur Administratoren): Umsatz brutto, Gewinn, Bestellungen, Black-Week-Archiv
// Gewinn = Umsatz brutto ÷ 1,19 − Einkauf netto (TNC)
const NEON = '#22d3ee'
const START = { y: 2026, m: 2 } // Daten ab März 2026 (Monat 0 = Januar)
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const eur = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const eur0 = (n) => Math.round(n || 0).toLocaleString('de-DE') + ' €'
const dShort = (d) => { const x = new Date(d); return isNaN(x) ? '' : `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.` }
const dLong = (d) => { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
const sum = (l, k) => l.reduce((a, o) => a + (o[k] || 0), 0)

function CSS() {
  return <style>{`
    .st-wrap{max-width:1100px;margin:0 auto;padding:28px 24px 50px}
    .st-card{background:#0e1522;border:1px solid #1b2738;border-radius:18px;padding:20px}
    .st-lbl{font-size:10.5px;font-weight:800;letter-spacing:1.2px;color:#6f8399;text-transform:uppercase}
    .st-big{font-size:46px;font-weight:900;line-height:1.1;letter-spacing:-.5px}
    .st-sel{appearance:none;-webkit-appearance:none;background:#0a101b url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2322d3ee' stroke-width='2' fill='none'/%3E%3C/svg%3E") no-repeat right 13px center;border:1px solid #2a3b52;border-radius:11px;padding:10px 38px 10px 13px;font-weight:700;font-size:14px;color:#e6edf5;font-family:inherit;cursor:pointer}
    .st-row{display:grid;grid-template-columns:62px 1.4fr 1fr 1fr 1fr 1fr;gap:10px;padding:11px 0;border-bottom:1px dashed #1f2c3f;align-items:center;font-size:13.5px}
    .st-row.h{border-bottom:1px solid #1f2c3f;padding:8px 0}
    .st-row.click{cursor:pointer}.st-row.click:hover{background:rgba(34,211,238,.04)}
    .st-r{text-align:right}
    .st-two{display:flex;gap:16px}
    .st-bw{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .st-only-m{display:none}
    @media (max-width: 760px){
      .st-wrap{padding:16px 12px 40px}
      .st-big{font-size:34px}
      .st-two{flex-direction:column}
      .st-bw{grid-template-columns:1fr}
      .st-row{grid-template-columns:1.6fr 1fr 1fr;font-size:12.5px}
      .st-only-d{display:none !important}
      .st-only-m{display:block}
      .st-head{flex-direction:column;align-items:stretch !important}
      .st-sels{width:100%}.st-sels > div{flex:1}.st-sel{width:100%}
    }
  `}</style>
}

export default function StatsPage({ onBack }) {
  const now = new Date()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth()))
  const [all, setAll] = useState(false)
  const [edit, setEdit] = useState(null) // { id, val } = Einkaufspreis wird gerade eingetragen
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await authClient().auth.getSession()
        const r = await fetch('/api/stats', { headers: { Authorization: 'Bearer ' + (s.session?.access_token || '') } })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || j.error) throw new Error(j.error || 'Fehler beim Laden')
        setData(j)
      } catch (e) { setErr(e.message) }
    })()
  }, [])

  const years = []
  for (let y = START.y; y <= now.getFullYear(); y++) years.push(String(y))
  const monthsOf = (y) => {
    const out = []
    const from = +y === START.y ? START.m : 0
    const to = +y === now.getFullYear() ? now.getMonth() : 11
    for (let m = to; m >= from; m--) out.push(m)
    return out
  }
  const orders = data?.orders || []
  const inPeriod = (o, y, m) => {
    const d = new Date(o.date)
    if (y === 'all') return true
    if (d.getFullYear() !== +y) return false
    return m === 'year' || d.getMonth() === +m
  }
  const list = useMemo(() => orders.filter(o => inPeriod(o, year, month)), [orders, year, month])

  const rev = sum(list, 'revenue'), profit = sum(list, 'profit'), net = rev / 1.19
  const anyApprox = list.some(o => o.approx)
  const periodName = year === 'all' ? 'insgesamt' : month === 'year' ? `in ${year}` : `im ${MON[+month]}`
  const titleName = year === 'all' ? 'Alle Zeiträume' : month === 'year' ? `Jahr ${year}` : `${MON[+month]} ${year}`

  // Black-Week-Archiv: pro Jahr, Zahlen aus den echten Bestellungen
  const bwYears = {}
  for (const a of data?.archive || []) { const y = new Date(a.start || a.end).getFullYear(); bwYears[y] = { ...a, live: false } }
  const bwInfo = data?.blackWeek
  if (bwInfo?.on) bwYears[now.getFullYear()] = { start: bwInfo.start, end: bwInfo.end, offers: bwInfo.offers, live: true }
  const bwList = Object.entries(bwYears).sort((a, b) => b[0] - a[0]).map(([y, a]) => {
    const ord = orders.filter(o => o.bw && new Date(o.date).getFullYear() === +y)
    return { y, ...a, ordered: ord.length, revenue: sum(ord, 'revenue'), profit: sum(ord, 'profit') }
  })

  const shown = all ? list : list.slice(0, 8)

  // Echten Einkaufspreis (TNC-Rechnung, netto) eintragen -> Gewinn ist dann genau
  async function saveEk(o) {
    const v = parseFloat(String(edit?.val || '').replace(/\./g, '').replace(',', '.'))
    if (!(v > 0)) { setEdit(null); return }
    setSaving(true)
    try {
      const { data: s } = await authClient().auth.getSession()
      const r = await fetch('/api/offers?id=' + encodeURIComponent(o.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s.session?.access_token || '') }, body: JSON.stringify({ paid_ek: v, ek_net: Math.round((o.express ? v / 1.3 : v) * 100) / 100 }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.error) throw new Error(j.error || 'Speichern fehlgeschlagen')
      setData(d => ({ ...d, orders: d.orders.map(x => x.id === o.id ? { ...x, ek: v, profit: Math.round((x.revenue / 1.19 - v) * 100) / 100, approx: false } : x) }))
      setEdit(null)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }
  const open = (o) => window.open('/admin?offer=' + encodeURIComponent(o.id), '_blank')

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#070b14', color: '#e6edf5', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <CSS />
      <div style={{ background: '#0a0a0a', height: 64, display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #2b2e36', color: '#cbd5e1', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>← Zentrale</button>
        <span style={{ fontWeight: 800, fontSize: 15 }}>📊 Statistik</span>
        <span className="st-only-d" style={{ color: '#6f8399', fontSize: 12.5 }}>Felix Weber · Zahlen & Statistik</span>
      </div>

      <div className="st-wrap">
        <div className="st-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{titleName}</div>
            <div style={{ color: '#7d8fa3', fontSize: 12.5, marginTop: 3 }}>Nur bestellte Angebote</div>
          </div>
          <div className="st-sels" style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span className="st-lbl">Jahr</span>
              <select className="st-sel" value={year} onChange={e => { const y = e.target.value; setYear(y); setAll(false); if (y !== 'all' && month !== 'year' && !monthsOf(y).includes(+month)) setMonth('year') }}>
                {years.slice().reverse().map(y => <option key={y} value={y}>{y}</option>)}
                <option value="all">Gesamt</option>
              </select>
            </div>
            {year !== 'all' && <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span className="st-lbl">Monat</span>
              <select className="st-sel" value={month} onChange={e => { setMonth(e.target.value); setAll(false) }} style={{ minWidth: 190 }}>
                <option value="year">Ganzes Jahr</option>
                {monthsOf(year).map(m => <option key={m} value={String(m)}>{+year === now.getFullYear() && m === now.getMonth() ? '● ' : ''}{MON[m]}</option>)}
              </select>
            </div>}
          </div>
        </div>

        {err && <div className="st-card" style={{ marginTop: 18, borderColor: '#ef444466', color: '#ef4444' }}>Fehler: {err}</div>}
        {!data && !err && <div className="st-card" style={{ marginTop: 18, color: '#7d8fa3' }}>Lädt … (beim ersten Mal werden alte Bestellungen nachgetragen, das dauert kurz)</div>}

        {data && <>
          <div className="st-two" style={{ marginTop: 18 }}>
            <div className="st-card" style={{ flex: 1, padding: 24 }}>
              <div className="st-lbl">Umsatz brutto</div>
              <div className="st-big" style={{ marginTop: 6 }}>{eur(rev)}</div>
              <div style={{ color: '#7d8fa3', fontSize: 12.5, marginTop: 8 }}>
                {list.length} {list.length === 1 ? 'Bestellung' : 'Bestellungen'} {periodName}
              </div>
            </div>
            <div className="st-card" style={{ flex: 1, padding: 24 }}>
              <div className="st-lbl">Gewinn</div>
              <div style={{ fontSize: 11.5, color: '#7d8fa3', margin: '4px 0 2px', fontFamily: 'monospace' }}>= Umsatz brutto ÷ 1,19 − Einkauf netto (TNC)</div>
              <div className="st-big" style={{ color: profit >= 0 ? '#22c55e' : '#ef4444' }}>{anyApprox ? <span style={{ fontSize: '.5em', color: '#7d8fa3', marginRight: 6 }}>ca.</span> : null}{eur(profit)}</div>
              <div style={{ color: '#7d8fa3', fontSize: 12.5, marginTop: 8 }}>{net > 0 ? `≈ ${Math.round(profit / net * 100)}% vom Netto-Umsatz` : 'Noch keine Bestellungen'}</div>
            </div>
          </div>

          <div className="st-card" style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Bestellungen {periodName}</div>
              <span style={{ color: '#7d8fa3', fontSize: 12 }}>{list.length} gesamt</span>
            </div>
            {list.length === 0 ? <div style={{ color: '#7d8fa3', fontSize: 13, padding: '16px 0 4px' }}>In diesem Zeitraum gibt es noch keine Bestellungen.</div> : <div style={{ marginTop: 10 }}>
              <div className="st-row h st-lbl">
                <span className="st-only-d">Datum</span><span>Kunde</span><span className="st-only-d">Größe</span>
                <span className="st-r">Umsatz{' '}<span className="st-only-d" style={{ display: 'inline' }}>brutto</span></span><span className="st-r st-only-d">Einkauf netto</span><span className="st-r">Gewinn</span>
              </div>
              {shown.map(o => (
                <div key={o.id} className="st-row click" onClick={() => open(o)} title="Angebot öffnen">
                  <span className="st-only-d" style={{ color: '#7d8fa3' }}>{dShort(o.date)}</span>
                  <span style={{ minWidth: 0 }}>
                    <b>{o.project || 'ohne Name'}</b>{o.bw && <span style={{ fontSize: 9.5, fontWeight: 800, background: '#fff', color: '#000', padding: '1px 5px', marginLeft: 6, borderRadius: 3 }}>BW</span>}{o.express && <span title="Express" style={{ marginLeft: 5 }}>⚡</span>}
                    <span className="st-only-m" style={{ color: '#7d8fa3', fontSize: 11 }}>{dShort(o.date)} · {o.size}</span>
                  </span>
                  <span className="st-only-d" style={{ color: '#7d8fa3' }}>{o.size}</span>
                  <span className="st-r">{eur(o.revenue)}</span>
                  <span className="st-r st-only-d" style={{ color: '#7d8fa3' }} onClick={e => { e.stopPropagation(); if (!edit || edit.id !== o.id) setEdit({ id: o.id, val: String(o.ek).replace('.', ',') }) }} title="Echten Einkaufspreis eintragen">
                    {edit?.id === o.id
                      ? <span style={{ display: 'inline-flex', gap: 5, justifyContent: 'flex-end' }}>
                          <input autoFocus value={edit.val} onChange={e => setEdit({ id: o.id, val: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') saveEk(o); if (e.key === 'Escape') setEdit(null) }} style={{ width: 82, background: '#0a101b', border: `1px solid ${NEON}`, borderRadius: 7, padding: '4px 7px', color: '#fff', fontFamily: 'inherit', fontSize: 13, textAlign: 'right' }} />
                          <button onClick={() => saveEk(o)} disabled={saving} style={{ background: NEON, border: 'none', borderRadius: 7, padding: '0 8px', fontWeight: 800, cursor: 'pointer' }}>{saving ? '…' : '✓'}</button>
                        </span>
                      : <span style={{ cursor: 'pointer', borderBottom: o.approx ? '1px dashed #f59e0b' : '1px dashed transparent', color: o.approx ? '#f59e0b' : undefined }}>{o.approx ? 'ca. ' : ''}{eur(o.ek)} ✎</span>}
                  </span>
                  <span className="st-r" style={{ fontWeight: 800, color: o.profit >= 0 ? '#22c55e' : '#ef4444' }}>{o.approx ? <span style={{ fontWeight: 500, color: '#7d8fa3', fontSize: 11 }}>ca. </span> : null}{eur(o.profit)}</span>
                </div>
              ))}
              {list.length > 8 && <div onClick={() => setAll(a => !a)} style={{ textAlign: 'center', paddingTop: 12, color: NEON, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{all ? 'Weniger anzeigen ▴' : `Alle ${list.length} anzeigen ▾`}</div>}
              {anyApprox && <div style={{ color: '#6f8399', fontSize: 11.5, marginTop: 10 }}>„ca.“ = alte Bestellung ohne gespeicherten Einkaufspreis, aus dem Angebotspreis zurückgerechnet. Klick auf den Einkaufspreis und trag den echten Betrag von der TNC-Rechnung ein, dann stimmt der Gewinn genau.</div>}
            </div>}
          </div>

          <div className="st-card" style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>🖤 Black-Week-Archiv</div>
            <div className="st-bw">
              {bwList.map(b => (
                <div key={b.y} style={{ border: `1px solid ${b.live ? NEON + '55' : '#223146'}`, background: b.live ? 'rgba(34,211,238,.06)' : '#0a101b', borderRadius: 14, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 16 }}>Black Week {b.y}</b>
                    {b.live ? <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 8, background: 'rgba(34,211,238,.15)', color: NEON }}>● LÄUFT</span> : <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 8, background: 'rgba(34,197,94,.12)', color: '#22c55e' }}>BEENDET</span>}
                  </div>
                  <div style={{ color: '#7d8fa3', fontSize: 12, marginTop: 4 }}>{b.start ? dLong(b.start) : '?'} bis {b.end ? dLong(b.end) : '?'}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 14, textAlign: 'center' }}>
                    {[[b.offers ?? '–', 'Angebote'], [b.ordered, 'Bestellt'], [eur0(b.revenue), 'Umsatz'], [eur0(b.profit), 'Gewinn']].map((x, i) => (
                      <div key={i}><div style={{ fontWeight: 800, fontSize: 16, color: i === 3 ? '#22c55e' : '#e6edf5' }}>{x[0]}</div><div style={{ color: '#7d8fa3', fontSize: 11 }}>{x[1]}</div></div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ border: '1px dashed #2a3b52', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6f8399', fontSize: 12.5, textAlign: 'center', minHeight: 100 }}>
                {bwList.length ? 'Nächste Jahre landen hier automatisch, sobald die Black Week endet.' : 'Noch keine Black Week. Sie landet hier automatisch.'}
              </div>
            </div>
          </div>
        </>}
      </div>
    </div>
  )
}
