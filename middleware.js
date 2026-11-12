import { NextResponse } from 'next/server'

// Schutz für interne Schnittstellen: nur mit Admin-Login (Bearer-Token)
// oder als interner Server-Aufruf (Header x-internal-key).
// Offen bleiben alles, was Kunden, Shopify oder Make brauchen (Angebotsseite, Größe ändern, Abmelden, Chatbot ...).
const PROTECTED = {
  '/api/offers': '*',
  '/api/agent-tasks': ['GET', 'PATCH'], // POST kommt von Make
  '/api/black-week': '*',
  '/api/bw-mail': '*',
  '/api/discount': '*',
  '/api/discount-reminder': '*',
  '/api/draft-order': '*',
  '/api/email-log': '*',
  '/api/offer-shopify': '*',
  '/api/order-email': '*',
  '/api/review-request': '*',
  '/api/ship': '*',
  '/api/shipping-mail': '*',
  '/api/tnc-import': '*',
  '/api/tnc-update': '*',
  '/api/mail-test': '*',
  '/api/dhl-test': '*',
  '/api/upload': '*',
}

export const config = { matcher: ['/api/:path*'] }

export async function middleware(req) {
  const rule = PROTECTED[req.nextUrl.pathname.replace(/\/$/, '')]
  if (!rule || req.method === 'OPTIONS') return NextResponse.next()
  if (rule !== '*' && !rule.includes(req.method)) return NextResponse.next()

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (key && req.headers.get('x-internal-key') === key) return NextResponse.next()

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (token) {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || key, Authorization: `Bearer ${token}` },
      })
      if (r.ok) return NextResponse.next()
    } catch {}
  }
  return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
}
