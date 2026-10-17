'use client'
import { useEffect, useRef } from 'react'

// Die 3D-Zentrale (public/zentrale.html) im Admin anzeigen und mit echten Daten füttern
export default function ZentraleFrame({ offers, setTab, onLogout, mIsRed, mStatus, mId, mBought }) {
  const ref = useRef(null)

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
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [offers])

  useEffect(() => { send() }, [offers])

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
