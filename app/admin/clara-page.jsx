'use client'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// Claras Aufgaben-Board (wie Asana): Offene Aufgabe -> In Bearbeitung -> Erledigt
// Daten: /api/strategie (type 'task'). David-Vorschläge landen hier mit fertigem Plan von Clara.
const LILA = '#8f7bff'
const COLS = [['offen', 'Offene Aufgabe', '#7d8fa3'], ['arbeit', 'In Bearbeitung', '#f59e0b'], ['erledigt', 'Erledigt', '#22c55e']]
const pad = (n) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const dShort = (s) => { if (!s) return ''; const [, m, d] = s.split('-'); return `${+d}.${+m}.` }
const dLong = (s) => { if (!s) return ''; const x = new Date(s); return isNaN(x) ? s : x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

async function api(method, body) {
  const { data: s } = await authClient().auth.getSession()
  const r = await fetch('/api/strategie', { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (s.session?.access_token || '') }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || 'Fehler')
  return j
}

const BTN = { borderRadius: 10, padding: '9px 13px', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', border: 'none', whiteSpace: 'nowrap' }
const PRI = { ...BTN, background: LILA, color: '#fff' }
const GHOST = { ...BTN, background: 'transparent', border: '1px solid #2a3b52', color: '#b9c7d6' }
const IN = { width: '100%', background: '#0a101b', border: '1px solid #2a3b52', borderRadius: 10, padding: '9px 12px', color: '#e6edf5', fontFamily: 'inherit', fontSize: 13 }

function CSS() {
  return <style>{`
    .cl-wrap{max-width:1180px;margin:0 auto;padding:24px}
    .cl-lbl{font-size:10.5px;font-weight:800;letter-spacing:1.2px;color:#6f8399;text-transform:uppercase}
    .cl-board{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:16px;align-items:start}
    .cl-col{background:#0b111c;border:1px solid #1b2738;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px;min-height:160px;transition:border-color .15s}
    .cl-col.over{border-color:${LILA}}
    .cl-task{background:#0e1522;border:1px solid #1f2c3f;border-radius:13px;padding:12px;cursor:pointer}
    .cl-task:hover{border-color:#34465f}
    .cl-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;border-radius:7px;padding:3px 7px}
    .cl-cb{width:17px;height:17px;border-radius:5px;border:1.5px solid #3a4b62;flex:none;margin-top:1px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;cursor:pointer;background:transparent;color:#04101f;padding:0}
    .cl-cb.on{background:#22c55e;border-color:#22c55e}
    .cl-step{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px dashed #1f2c3f;font-size:13px}
    .cl-step .x{opacity:0;margin-left:auto;background:none;border:none;color:#6f8399;cursor:pointer;font-size:13px}
    .cl-step:hover .x{opacity:1}
    .cl-panel{position:fixed;top:0;right:0;bottom:0;width:540px;max-width:100%;background:#0e1522;border-left:1px solid ${LILA}55;box-shadow:-30px 0 80px rgba(0,0,0,.5);overflow-y:auto;padding:22px;z-index:51}
    .cl-msg{border-radius:12px;padding:9px 12px;font-size:12.5px;line-height:1.5;max-width:88%;white-space:pre-wrap}
    @media (max-width: 760px){
      .cl-wrap{padding:14px 12px 40px}
      .cl-board{display:flex;overflow-x:auto;gap:12px;padding-bottom:8px;scroll-snap-type:x mandatory}
      .cl-col{min-width:84%;scroll-snap-align:start}
      .cl-head{flex-direction:column;align-items:stretch !important}
      .cl-only-d{display:none !important}
      .cl-step .x{opacity:1}
    }
  `}</style>
}

function Card({ t, onOpen, onDrag }) {
  const done = (t.steps || []).filter(s => s.done).length, all = (t.steps || []).length
  const late = t.due && t.status !== 'erledigt' && t.due < today()
  return (
    <div className="cl-task" draggable onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); onDrag(t.id) }} onClick={() => onOpen(t.id)} style={{ opacity: t.status === 'erledigt' ? .65 : 1 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span className={'cl-cb' + (t.status === 'erledigt' ? ' on' : '')} style={{ borderRadius: '50%' }}>{t.status === 'erledigt' ? '✓' : ''}</span>
        <b style={{ fontSize: 13.5, lineHeight: 1.35, textDecoration: t.status === 'erledigt' ? 'line-through' : 'none' }}>{t.title}</b>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9 }}>
        {t.due && <span className="cl-chip" style={{ background: late ? '#ef444422' : '#1b2738', color: late ? '#f87171' : '#b9c7d6' }}>📅 {dShort(t.due)}{late ? ' · überfällig' : ''}</span>}
        <span className="cl-chip" style={t.from === 'david' ? { background: '#8f7bff22', color: '#b4a8ff' } : { background: '#22d3ee1a', color: '#67e8f9' }}>{t.from === 'david' ? '💡 von David' : '✎ eigene'}</span>
      </div>
      {all > 0 && <>
        <div style={{ height: 5, background: '#1b2738', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}><i style={{ display: 'block', height: '100%', width: `${done / all * 100}%`, background: LILA }} /></div>
        <div style={{ color: '#7d8fa3', fontSize: 11, marginTop: 4 }}>{done} von {all} Schritten</div>
      </>}
    </div>
  )
}

function Detail({ t, onClose, run, busy }) {
  const [title, setTitle] = useState(t.title)
  const [goal, setGoal] = useState(t.goal || '')
  const [step, setStep] = useState('')
  const [msg, setMsg] = useState('')
  const [talking, setTalking] = useState(false)
  const chatEnd = useRef(null)
  useEffect(() => { setTitle(t.title); setGoal(t.goal || '') }, [t.id, t.title, t.goal])
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }) }, [t.chat?.length, talking])
  const steps = t.steps || [], done = steps.filter(s => s.done).length
  async function send() {
    const text = msg.trim(); if (!text) return
    setTalking(true); setMsg('')
    const ok = await run({ action: 'task_chat', id: t.id, text })
    if (!ok) setMsg(text)
    setTalking(false)
  }
  const col = COLS.find(c => c[0] === t.status) || COLS[0]
  return <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,.6)', zIndex: 50 }} />
    <div className="cl-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#7d8fa3', fontSize: 12 }}>{t.from === 'david' ? `💡 Vorschlag von David${t.accepted ? ' · angenommen ' + dShort(t.accepted.slice(0, 10)) : ''}` : '✎ Eigene Aufgabe'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7d8fa3', fontSize: 20, cursor: 'pointer' }}>✕</button>
      </div>
      <textarea value={title} rows={2} onChange={e => setTitle(e.target.value)} onBlur={() => title.trim() !== t.title && run({ action: 'task_update', id: t.id, title })}
        style={{ ...IN, background: 'transparent', border: '1px solid transparent', fontSize: 20, fontWeight: 800, padding: '6px 0', marginTop: 8, resize: 'none' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
        <div><div className="cl-lbl" style={{ marginBottom: 5 }}>Status</div>
          <select value={t.status || 'offen'} onChange={e => run({ action: 'task_update', id: t.id, status: e.target.value })} style={{ ...IN, color: col[2], fontWeight: 700 }}>
            {COLS.map(([k, n]) => <option key={k} value={k}>● {n}</option>)}
          </select></div>
        <div><div className="cl-lbl" style={{ marginBottom: 5 }}>Fällig bis</div>
          <input type="date" value={t.due || ''} onChange={e => run({ action: 'task_update', id: t.id, due: e.target.value })} style={{ ...IN, colorScheme: 'dark' }} /></div>
      </div>

      <div className="cl-lbl" style={{ margin: '18px 0 6px' }}>Ziel</div>
      <textarea value={goal} rows={3} placeholder="Worum geht es? Was soll am Ende rauskommen?" onChange={e => setGoal(e.target.value)} onBlur={() => goal !== (t.goal || '') && run({ action: 'task_update', id: t.id, desc: goal })} style={{ ...IN, resize: 'vertical', lineHeight: 1.5 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 4px' }}>
        <div className="cl-lbl">Plan von Clara</div>
        {steps.length > 0 && <span style={{ color: '#7d8fa3', fontSize: 11.5 }}>{done} von {steps.length} erledigt</span>}
      </div>
      {steps.length === 0 && <div style={{ color: '#7d8fa3', fontSize: 12.5, padding: '6px 0' }}>Noch keine Schritte.</div>}
      {steps.map((s, i) => (
        <div key={i} className="cl-step">
          <button className={'cl-cb' + (s.done ? ' on' : '')} onClick={() => run({ action: 'step', id: t.id, i })}>{s.done ? '✓' : ''}</button>
          <span style={{ flex: 1, color: s.done ? '#7d8fa3' : undefined, textDecoration: s.done ? 'line-through' : 'none', lineHeight: 1.45 }}>{s.t}</span>
          <button className="x" title="Schritt löschen" onClick={() => run({ action: 'step_del', id: t.id, i })}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input value={step} placeholder="+ Schritt hinzufügen" onChange={e => setStep(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter' && step.trim()) { const v = step; setStep(''); await run({ action: 'step_add', id: t.id, t: v }) } }} style={IN} />
      </div>

      <div className="cl-lbl" style={{ margin: '22px 0 8px' }}>Mit David besprechen</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!(t.chat || []).length && !talking && <div style={{ color: '#7d8fa3', fontSize: 12.5 }}>Schreib David, wie du es meinst oder was er ändern soll. Er passt die Aufgabe direkt an.</div>}
        {(t.chat || []).map((m, i) => <div key={i} className="cl-msg" style={m.role === 'me' ? { alignSelf: 'flex-end', background: LILA, color: '#fff' } : { background: '#0a101b', border: '1px solid #223146' }}>{m.text}</div>)}
        {talking && <div className="cl-msg" style={{ background: '#0a101b', border: '1px solid #223146', color: '#7d8fa3' }}>David denkt nach …</div>}
        <div ref={chatEnd} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <textarea value={msg} rows={2} placeholder="Was soll David an der Aufgabe ändern?" onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} style={{ ...IN, resize: 'none' }} />
        <button onClick={send} disabled={talking || !msg.trim()} style={{ ...PRI, opacity: talking || !msg.trim() ? .5 : 1 }}>Senden</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
        <button disabled={busy} onClick={async () => { if (confirm(`Aufgabe „${t.title}“ wirklich löschen?`)) { if (await run({ action: 'delete', id: t.id })) onClose() } }} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>🗑 Aufgabe löschen</button>
        <span style={{ color: '#55677c', fontSize: 11.5 }}>erstellt {dLong(t.at)}</span>
      </div>
    </div>
  </>
}

function NewTask({ onClose, run }) {
  const [f, setF] = useState({ title: '', desc: '', due: '', plan: true })
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!f.title.trim()) return
    setBusy(true)
    if (await run({ action: 'task_add', ...f })) onClose()
    setBusy(false)
  }
  return (
    <div onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#0e1522', border: `1px solid ${LILA}55`, borderRadius: 20, padding: 22 }}>
        <b style={{ fontSize: 17 }}>+ Neue Aufgabe</b>
        <div className="cl-lbl" style={{ margin: '14px 0 5px' }}>Titel</div>
        <input autoFocus value={f.title} onChange={e => setF({ ...f, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && save()} style={IN} placeholder="z. B. Cookie-Banner prüfen" />
        <div className="cl-lbl" style={{ margin: '12px 0 5px' }}>Beschreibung (optional)</div>
        <textarea value={f.desc} rows={3} onChange={e => setF({ ...f, desc: e.target.value })} style={{ ...IN, resize: 'vertical' }} placeholder="Worum geht es genau?" />
        <div className="cl-lbl" style={{ margin: '12px 0 5px' }}>Fällig bis (optional)</div>
        <input type="date" value={f.due} onChange={e => setF({ ...f, due: e.target.value })} style={{ ...IN, colorScheme: 'dark' }} />
        <label style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 14, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.plan} onChange={e => setF({ ...f, plan: e.target.checked })} style={{ accentColor: '#22c55e', width: 16, height: 16 }} />
          Clara schreibt einen Plan mit Schritten dazu
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={save} disabled={busy || !f.title.trim()} style={{ ...PRI, flex: 1, padding: 12, fontSize: 14, opacity: busy || !f.title.trim() ? .55 : 1 }}>{busy ? (f.plan ? 'Clara schreibt den Plan …' : 'Speichert …') : 'Aufgabe anlegen'}</button>
          <button onClick={onClose} disabled={busy} style={{ ...GHOST, padding: '12px 16px', fontSize: 14 }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}

export default function ClaraPage({ onBack }) {
  const [tasks, setTasks] = useState(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const [over, setOver] = useState(null)
  const [busy, setBusy] = useState(false)
  const drag = useRef(null)

  const load = () => api('GET').then(j => setTasks(j.tasks || [])).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])

  async function run(body) {
    setBusy(true); setErr('')
    try { await api('POST', body); await load(); setBusy(false); return true }
    catch (e) { setErr(e.message); setBusy(false); return false }
  }
  function drop(status) {
    const id = drag.current; setOver(null); drag.current = null
    const t = (tasks || []).find(x => x.id === id)
    if (!t || t.status === status) return
    setTasks(ts => ts.map(x => x.id === id ? { ...x, status } : x)) // sofort verschieben, dann speichern
    run({ action: 'task_update', id, status })
  }
  const order = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || String(a.at).localeCompare(String(b.at))
  const cur = open && (tasks || []).find(t => t.id === open)

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#070b14', color: '#e6edf5', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <CSS />
      <div style={{ background: '#0a0a0a', height: 64, display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #2b2e36', color: '#cbd5e1', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>← Zentrale</button>
        <span style={{ fontWeight: 800, fontSize: 15 }}>🗂 Aufgaben</span>
        <span className="cl-only-d" style={{ color: '#6f8399', fontSize: 12.5 }}>Clara Vogel · Strategie & Planung</span>
      </div>
      <div className="cl-wrap">
        <div className="cl-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>Aufgaben</div>
            <div style={{ color: '#7d8fa3', fontSize: 12.5, marginTop: 3 }}>Ziehen zum Verschieben · Klick öffnet den Plan{busy ? <span style={{ color: LILA }}> · speichert …</span> : null}</div>
          </div>
          <button onClick={() => setAdding(true)} style={{ ...PRI, padding: '11px 16px' }}>+ Neue Aufgabe</button>
        </div>
        {err && <div style={{ marginTop: 14, background: '#ef44441a', border: '1px solid #ef444466', color: '#f87171', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>{err}</div>}
        {!tasks && !err && <div style={{ marginTop: 18, color: '#7d8fa3' }}>Lädt …</div>}
        {tasks && <div className="cl-board">
          {COLS.map(([k, n, c]) => {
            const list = tasks.filter(t => (t.status || 'offen') === k).sort(order)
            return (
              <div key={k} className={'cl-col' + (over === k ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(k) }} onDragLeave={() => setOver(o => o === k ? null : o)} onDrop={e => { e.preventDefault(); drop(k) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 13.5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 7 }} />{n} <span style={{ color: '#7d8fa3', fontWeight: 600 }}>{list.length}</span></b>
                  {k === 'offen' && <button onClick={() => setAdding(true)} style={{ background: 'none', border: 'none', color: LILA, fontWeight: 800, fontSize: 19, cursor: 'pointer', lineHeight: 1 }}>+</button>}
                </div>
                {list.map(t => <Card key={t.id} t={t} onOpen={setOpen} onDrag={id => { drag.current = id }} />)}
                {list.length === 0 && <div style={{ color: '#55677c', fontSize: 12, padding: '4px 2px' }}>{k === 'offen' ? 'Keine offenen Aufgaben.' : 'Hierher ziehen.'}</div>}
                {k === 'offen' && <button onClick={() => setAdding(true)} style={{ background: 'none', border: 'none', color: '#7d8fa3', fontSize: 12.5, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px' }}>+ Aufgabe hinzufügen</button>}
              </div>
            )
          })}
        </div>}
      </div>
      {cur && <Detail t={cur} onClose={() => setOpen(null)} run={run} busy={busy} />}
      {adding && <NewTask onClose={() => setAdding(false)} run={run} />}
    </div>
  )
}
