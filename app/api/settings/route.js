import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getBW, endBlackWeek } from '../../../lib/blackweek'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))

async function requireAdmin(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  const { data, error } = await db().auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  if (data.user.app_metadata?.role !== 'admin') throw Object.assign(new Error('Nur für Administratoren'), { status: 403 })
  return data.user
}

// Einstellungen lesen: { pricing: { markup }, black_week: { on, end, ..., active } }
export async function GET() {
  const sb = db()
  const { data, error } = await sb.from('settings').select('key, value')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const out = {}
  for (const r of data || []) out[r.key] = r.value
  out.black_week = await getBW(sb)
  return NextResponse.json(out)
}

// Einstellung ändern (nur Administratoren): PATCH { key, value }
// Black Week ausschalten -> alle nicht bestellten Black-Week-Angebote werden deaktiviert
export async function PATCH(req) {
  try {
    await requireAdmin(req)
    const { key, value } = await req.json()
    if (!['pricing', 'black_week'].includes(key)) return NextResponse.json({ error: 'Unbekannte Einstellung' }, { status: 400 })
    const sb = db()
    let deactivated = 0
    if (key === 'black_week') {
      const before = await getBW(sb)
      const { active, ...clean } = value || {}
      if (before.on && clean.on === false) {
        await sb.from('settings').upsert({ key, value: { ...clean, on: true }, updated_at: new Date().toISOString() })
        deactivated = await endBlackWeek(sb)
      } else {
        if (!before.on && clean.on) clean.started_at = new Date().toISOString()
        const { error } = await sb.from('settings').upsert({ key, value: clean, updated_at: new Date().toISOString() })
        if (error) throw new Error(error.message)
      }
    } else {
      const { error } = await sb.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ success: true, deactivated })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 })
  }
}
