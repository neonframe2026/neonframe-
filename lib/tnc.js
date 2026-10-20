import { createClient } from '@supabase/supabase-js'

// Verbindung zum TNC-Reseller-Portal (mit Erlaubnis von Kenzo)
// Der Login (Session-Cookie) liegt geschützt in Supabase (Tabelle tnc_auth, nur der Server kommt dran)
const PORTAL = 'https://reseller.theneoncompany.shop'
export const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Cookie-Text "a=1; b=2" <-> Objekt
const parse = (s) => Object.fromEntries(String(s || '').split(/;\s*/).map(p => p.trim()).filter(p => p.includes('=')).map(p => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]))
const join = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join('; ')

// Eingabe aus den Einstellungen: entweder nur der Wert oder "name=wert; ..."
export function normalizeCookie(input) {
  const t = String(input || '').trim().replace(/^cookie:\s*/i, '')
  if (!t) return ''
  if (t.includes('=') && /next-auth/.test(t)) return t
  return `__Secure-next-auth.session-token=${t}`
}

async function load() {
  const { data } = await sb().from('tnc_auth').select('*').eq('id', 1).maybeSingle()
  return data || null
}
async function save(fields) {
  await sb().from('tnc_auth').upsert({ id: 1, ...fields, updated_at: new Date().toISOString() })
}

// Neue Cookies aus der Antwort übernehmen (so bleibt der Login frisch)
function merge(cookie, res) {
  let list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  if (!list.length) { const h = res.headers.get('set-cookie'); if (h) list = h.split(/,(?=\s*[^;,=\s]+=)/) }
  if (!list.length) return cookie
  const o = parse(cookie)
  for (const c of list) {
    const first = c.split(';')[0].trim(); const i = first.indexOf('=')
    if (i > 0) { const k = first.slice(0, i), v = first.slice(i + 1); if (v) o[k] = v; else delete o[k] }
  }
  return join(o)
}

async function call(path, opts = {}, cookieOverride) {
  const row = cookieOverride ? { cookie: cookieOverride } : await load()
  if (!row?.cookie) throw new Error('TNC-Login fehlt. Bitte in den Einstellungen unter „TNC-Verbindung“ hinterlegen.')
  const res = await fetch(PORTAL + path, {
    ...opts, cache: 'no-store', redirect: 'manual',
    headers: { Accept: 'application/json', Origin: PORTAL, Referer: PORTAL + '/', ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}), Cookie: row.cookie },
  })
  const cookie = merge(row.cookie, res)
  if (!cookieOverride && cookie !== row.cookie) await save({ cookie })
  return { res, cookie }
}

// Login prüfen und verlängern
export async function refresh(cookieOverride) {
  try {
    const { res, cookie } = await call('/api/auth/session', {}, cookieOverride)
    const j = await res.json().catch(() => ({}))
    const ok = res.ok && !!j?.user
    await save({ ...(cookieOverride && ok ? { cookie } : {}), ...(cookieOverride && !ok ? {} : { ok }), checked_at: new Date().toISOString() })
    return { ok, expires: j?.expires || null, name: j?.user?.name || j?.user?.email || '' }
  } catch (e) {
    if (!cookieOverride) await save({ ok: false, checked_at: new Date().toISOString() }).catch(() => {})
    return { ok: false, error: e.message }
  }
}

export async function status() {
  const r = await load()
  return { connected: !!r?.cookie && r?.ok !== false, ok: r?.ok ?? null, checked_at: r?.checked_at || null, has: !!r?.cookie }
}

// Anfrage im Portal anlegen -> TNC-Nummer zurück
export async function createQuotation(body) {
  const loc = await call('/api/protected/business/locations')
  const lj = await loc.res.json().catch(() => ({}))
  if (!loc.res.ok) throw new Error(loc.res.status === 401 || loc.res.status === 403 ? 'TNC-Login abgelaufen. Bitte in den Einstellungen neu hinterlegen.' : `TNC-Standort konnte nicht geladen werden (${loc.res.status})`)
  const legacy = lj?.legacy || lj?.data?.legacy || {}
  const businessLocation = { id: 'legacy', name: legacy.name || '', street: legacy.street || '', housenr: legacy.housenr || '', postalCode: legacy.postalCode || '', city: legacy.city || '', country: legacy.country || '', phone: legacy.phone || '', email: legacy.email || '' }
  const { res } = await call('/api/protected/resellers/newQuotation', { method: 'POST', body: JSON.stringify({ quickRequest: false, notifyEmails: [], businessLocationId: 'legacy', businessLocation, ...body }) })
  const j = await res.json().catch(() => ({}))
  if (res.status === 401 || res.status === 403) { await save({ ok: false }); throw new Error('TNC-Login abgelaufen. Bitte in den Einstellungen neu hinterlegen.') }
  if (!res.ok || !j?.id) throw new Error(j?.message || j?.error || `TNC hat die Anfrage abgelehnt (${res.status})`)
  return String(j.id)
}
