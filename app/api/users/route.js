import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Benutzerverwaltung (nur für Administratoren)
// GET              -> alle Benutzer
// POST {first,last,email} -> Mitarbeiter einladen (Mail mit Link zum Passwort festlegen)
// DELETE ?id=...   -> Benutzer löschen (sich selbst und Admins nicht)
const SITE = 'https://angebote.neonframe.de'
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function requireAdmin(req) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY fehlt in Vercel'), { status: 500 })
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  const { data, error } = await admin().auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  if (data.user.app_metadata?.role !== 'admin') throw Object.assign(new Error('Nur für Administratoren'), { status: 403 })
  return data.user
}
const fail = (e) => Response.json({ error: e.message }, { status: e.status || 500 })
const row = (u) => ({
  id: u.id, email: u.email,
  name: u.user_metadata?.name || u.app_metadata?.name || '',
  role: u.app_metadata?.role === 'admin' ? 'admin' : 'staff',
  status: u.last_sign_in_at ? 'aktiv' : 'eingeladen',
  last: u.last_sign_in_at || null, created: u.created_at,
})

export async function GET(req) {
  try {
    const me = await requireAdmin(req)
    const { data, error } = await admin().auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) throw error
    const users = (data.users || []).map(row).sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1) || a.created.localeCompare(b.created))
    return Response.json({ me: me.id, users })
  } catch (e) { return fail(e) }
}

export async function POST(req) {
  try {
    await requireAdmin(req)
    const b = await req.json()
    const first = String(b.first || '').trim(), last = String(b.last || '').trim(), email = String(b.email || '').trim().toLowerCase()
    if (!first || !last) return Response.json({ error: 'Bitte Vor- und Nachname angeben' }, { status: 400 })
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Response.json({ error: 'Bitte eine gültige E-Mail angeben' }, { status: 400 })
    const name = `${first} ${last}`
    const { data, error } = await admin().auth.admin.inviteUserByEmail(email, { data: { name, first, last }, redirectTo: SITE + '/admin' })
    if (error) throw Object.assign(new Error(/already/i.test(error.message) ? 'Diese E-Mail ist schon registriert' : error.message), { status: 400 })
    await admin().auth.admin.updateUserById(data.user.id, { app_metadata: { role: 'staff', name } })
    return Response.json({ success: true })
  } catch (e) { return fail(e) }
}

export async function DELETE(req) {
  try {
    const me = await requireAdmin(req)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return Response.json({ error: 'id fehlt' }, { status: 400 })
    if (id === me.id) return Response.json({ error: 'Du kannst dich nicht selbst löschen' }, { status: 400 })
    const { data } = await admin().auth.admin.getUserById(id)
    if (data?.user?.app_metadata?.role === 'admin') return Response.json({ error: 'Administratoren können hier nicht gelöscht werden' }, { status: 400 })
    const { error } = await admin().auth.admin.deleteUser(id)
    if (error) throw error
    return Response.json({ success: true })
  } catch (e) { return fail(e) }
}
