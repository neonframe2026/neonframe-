'use client'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '../../lib/admin-auth'

// Die 3D-Zentrale (public/zentrale.html) im Admin anzeigen und mit echten Daten füttern
export default function ZentraleFrame({ offers, setTab, onLogout, mIsRed, mStatus, mId, mBought, onOpenOffer, onOpenUpdate }) {
  const ref = useRef(null)
  const [tasks, setTasks] = useState([])
  const tasksRef = useRef([])
  // Eingeloggter Benutzer (Name + Rolle für den Header)
  const [user, setUser] = useState(null)
  const userRef = useRef(null)
  useEffect(() => {
    authClient()?.auth.getUser().then(({ data }) => {
      const u = data?.user; if (!u) return
      const m = u.app_metadata || {}, um = u.user_metadata || {}
      userRef.current = { email: u.email, name: um.name || m.name || '', role: m.role === 'admin' ? 'admin' : 'staff' }
      setUser(userRef.current)
    }).catch(() => {})
  }, [])
  const [fu, setFu] = useState(null)
  const fuRef = useRef(null)
  // Anna (Einkauf): Anfragen aus dem Konfigurator
  const [ek, setEk] = useState(null)
  const ekRef = useRef(null)
  const ekApi = async (method, body) => {
    const { data } = await authClient().auth.getSession()
    const r = await fetch('/api/einkauf', { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data?.session?.access_token || '') }, body: body ? JSON.stringify(body) : undefined })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Fehler')
    return j
  }
  const loadEk = () => ekApi('GET').then(j => { ekRef.current = j; setEk(j) }).catch(() => {})
  const loadFu = () => fetch('/api/followup').then(r => r.json()).then(j => { if (Array.isArray(j.approve)) { fuRef.current = j; setFu(j) } }).catch(() => {})

  // Offene Aufgaben der Agenten laden (und jede Minute neu)
  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/agent-tasks').then(r => r.json()).then(j => { if (alive && Array.isArray(j)) { tasksRef.current = j; setTasks(j) } }).catch(() => {})
    load(); loadFu(); loadEk()
    const t = setInterval(() => { load(); loadFu(); loadEk() }, 60000)
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
      user: userRef.current || undefined,
      tasks: tasksRef.current.map(t => ({ id: t.id, type: t.type, tnc: t.tnc_id, name: t.project || 'ohne Projekt', email: t.email || '', at: t.created_at })),
      orders: offers.slice(0, 8).map(row),
      fu: fuRef.current || undefined,
      ek: ekRef.current || undefined,
      due: fuRef.current ? fuRef.current.approve.map(a => ({ nr: a.nr, name: a.name, status: a.label, cls: 'wait' })) : offers.filter(mIsRed).map(row),
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
      if (e.data?.type === 'nf-fu') {
        const ids = e.data.action === 'all' ? (fuRef.current?.approve || []).map(a => a.id) : [e.data.id]
        const action = e.data.action === 'skip' ? 'skip' : 'send'
        ;(async () => {
          const errs = []
          for (const id of ids) {
            const j = await fetch('/api/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }) }).then(r => r.json()).catch(err => ({ error: err.message }))
            if (j.error) errs.push(j.error)
          }
          if (errs.length) alert('Fehler: ' + errs.join(', '))
          loadFu()
        })()
      }
      if (e.data?.type === 'nf-ek') {
        const { action, id, fields } = e.data
        ekApi('PATCH', { action, id, fields })
          .then(j => ref.current?.contentWindow?.postMessage({ type: 'nf-ek-res', id, ok: true, tnc: j.tnc || '' }, window.location.origin))
          .catch(err => ref.current?.contentWindow?.postMessage({ type: 'nf-ek-res', id, ok: false, error: err.message }, window.location.origin))
          .finally(loadEk)
      }
      if (e.data?.type === 'nf-dismiss') fetch('/api/agent-tasks?id=' + encodeURIComponent(e.data.id), { method: 'PATCH' }).then(() => {
        tasksRef.current = tasksRef.current.filter(x => x.id !== e.data.id); setTasks(tasksRef.current)
      })
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [offers])

  useEffect(() => { send() }, [offers, tasks, fu, user, ek])

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
