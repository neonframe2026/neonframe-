'use client'
// Konfetti-Feuerwerk für "Zugestellt": Raketen steigen per CSS auf, beim Explodieren kommt echtes Konfetti (canvas-confetti)
import { useEffect } from 'react'

const SRC = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.js'
const COLORS = ['#ff2d55', '#ffc400', '#22c55e', '#2f9bff', '#ff6fb5', '#8b5cf6', '#ff8a00', '#14c8d4', '#ffffff']

export default function Feuerwerk({ rockets }) {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timers = []
    const boom = (x, y) => {
      const c = window.confetti; if (!c) return
      const origin = { x, y }
      c({ particleCount: 110, spread: 360, startVelocity: 34, gravity: 0.85, decay: 0.92, ticks: 320, scalar: 1.1, origin, colors: COLORS, zIndex: 60 })
      c({ particleCount: 45, spread: 360, startVelocity: 20, gravity: 0.7, decay: 0.93, ticks: 340, scalar: 0.8, shapes: ['circle'], origin, colors: COLORS, zIndex: 60 })
    }
    const go = () => rockets.forEach(([x, y, dl]) => timers.push(setTimeout(() => boom(x, y), (dl + 0.8) * 1000)))
    if (window.confetti) go()
    else { const s = document.createElement('script'); s.src = SRC; s.async = true; s.onload = go; document.head.appendChild(s) }
    return () => timers.forEach(clearTimeout)
  }, [])
  return null
}
