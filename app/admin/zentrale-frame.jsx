'use client'
import { useEffect, useRef, useState } from 'react'

// Die 3D-Zentrale (public/zentrale.html) im Admin anzeigen und mit echten Daten füttern
export default function ZentraleFrame({ offers, setTab, onLogout, mIsRed, mStatus, mId, mBought, onOpenOffer, onOpenUpdate }) {
  const ref = useRef(null)
  const [tasks, setTasks] = useState([])
  const tasksRef = useRef([])

  // Offene Aufgaben der Agenten laden (und jede Minute neu)
  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/agent-tasks').then(r => r.json()).then(j => { if (alive && Array.isArray(j)) { tasksRef.current = j; setTasks(j) } }).catch(() => {})
    load()
    const t = setInterval(load, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const send = () => {
    const w = ref.current?.contentWindow
    if (!w) return
    const row = (o) => ({
      nr: o.offer_num || mId(o),
      name: o.project || 'ohne Projekt',
      status: mStatus(o.status).label,
      cls: mIsRed(o) ? 'wait' : mBought(o) ? 'ok' : 'open',
    })
    const week = Date.now() - 7 * 86400000
    w.postMessage({
      type: 'nf-data',
      tasks: tasksRef.current.map(t => ({ id: t.id, type: t.type, tnc: t.tnc_id, name: t.project || 'ohne Projekt', email: t.email || '', at: t.created_at })),
      orders: offers.slice(0, 8).map(row),
      due: offers.filter(mIsRed).map(row),
      stats: {
        total: offers.length,
        open: offers.filter(o => !mBought(o) && o.published).length,
        week: offers.filter(o => new Date(o.created_at).getTime() > week).length,
      },
    }, window.location.origin)
  }

  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'nf-ready') send()
      if (e.data?.type === 'nf-nav') setTab(e.data.tab)
      if (e.data?.type === 'nf-logout') onLogout()
      if (e.data?.type === 'nf-open') {
        const t = tasksRef.current.find(x => x.id === e.data.id)
        if (!t) return
        if (t.type === 'update') onOpenUpdate(t.tnc_id)
        else onOpenOffer(t.tnc_id, { project: t.project || '', email: t.email || '' })
      }
      if (e.data?.type === 'nf-dismiss') fetch('/api/agent-tasks?id=' + encodeURIComponent(e.data.id), { method: 'PATCH' }).then(() => {
        tasksRef.current = tasksRef.current.filter(x => x.id !== e.data.id); setTasks(tasksRef.current)
      })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [offers])

  useEffect(() => { send() }, [offers, tasks])

  return (
    <iframe
      ref={ref}
      src="/zentrale.html"
      title="NeonFrame Zentrale"
      onLoad={send}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, background: '#050a17' }}
    />
  )
}
