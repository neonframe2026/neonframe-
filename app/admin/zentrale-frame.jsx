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
  // Push-Nachrichten aufs Handy (installierte App oder Browser mit Push)
  const [push, setPush] = useState('hidden')
  const authHdr = async () => { const { data } = await authClient().auth.getSession(); return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data?.session?.access_token || '') } }
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') return
    if (!window.matchMedia('(pointer: coarse)').matches) return // nur am Handy
    try { if (localStorage.getItem('nf_push_hide') === '1') return } catch {}
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) { fetch('/api/push', { method: 'POST', headers: await authHdr(), body: JSON.stringify({ sub }) }).catch(() => {}); setPush('on') }
      else if (Notification.permission !== 'denied') setPush('offer')
    }).catch(() => {})
  }, [])
  const enablePush = async () => {
    setPush('busy')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setPush('offer'); alert('Benachrichtigungen wurden nicht erlaubt.'); return }
      const { key } = await (await fetch('/api/push')).json()
      if (!key) throw new Error('Push ist noch nicht eingerichtet (Schlüssel fehlen in Vercel)')
      const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4))
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, c => c.charCodeAt(0)) })
      const h = await authHdr()
      const j = await (await fetch('/api/push', { method: 'POST', headers: h, body: JSON.stringify({ sub }) })).json()
      if (j.error) throw new Error(j.error)
      await fetch('/api/push', { method: 'POST', headers: h, body: JSON.stringify({ test: true }) })
      setPush('on')
    } catch (e) { alert('Fehler: ' + e.message); setPush('offer') }
  }
  const hidePush = () => { try { localStorage.setItem('nf_push_hide', '1') } catch {} ; setPush('hidden') }
  const [small, setSmall] = useState(false)
  useEffect(() => { setSmall(window.innerWidth < 700) }, [])

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
    <>
    <iframe
      ref={ref}
      src="/zentrale.html"
      title="NeonFrame Zentrale"
      onLoad={send}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, background: '#050a17' }}
    />
    {(push === 'offer' || push === 'busy') && (
      <div style={{ position: 'fixed', left: 12, bottom: small ? 70 : 18, zIndex: 20, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(8,16,36,.94)', border: '1px solid #2f5a9e', borderRadius: 999, padding: 4, boxShadow: '0 6px 24px rgba(0,0,0,.5)', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
        <button onClick={enablePush} disabled={push === 'busy'} style={{ background: 'linear-gradient(145deg,#7fe0ff,#3aa8ff 45%,#1f5fd6)', color: '#fff', border: 0, borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {push === 'busy' ? 'Wird aktiviert...' : '🔔 Push-Nachrichten aktivieren'}
        </button>
        <button onClick={hidePush} aria-label="Ausblenden" style={{ background: 'transparent', color: '#8fa3c7', border: 0, fontSize: 18, padding: '0 8px', cursor: 'pointer' }}>×</button>
      </div>
    )}
    </>
  )
}
