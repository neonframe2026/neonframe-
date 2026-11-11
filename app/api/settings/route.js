import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))

// Einstellungen lesen: { pricing: { markup }, black_week: { ... } }
export async function GET() {
  const { data, error } = await db().from('settings').select('key, value')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const out = {}
  for (const r of data || []) out[r.key] = r.value
  return NextResponse.json(out)
}
