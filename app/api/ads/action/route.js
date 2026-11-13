import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Ads-Analyse: Pauls Änderungen bei Meta. Läuft NUR, wenn du im Admin auf "Freigeben" klickst.
// Gespeichert in settings.key = 'ads': { cap (€/Tag), log: [...], ignored: [...] }
// GET  -> { cap, total, log, ignored }
// POST { kind: 'pause', adId, name }
//      { kind: 'budget', objId, level: 'adset'|'campaign', pct, name }   (pct max ±30)
//      { kind: 'undo', logId }
//      { kind: 'ignore', key }
//      { kind: 'cap', value }
const V = 'v23.0'
const MAX_PCT = 30
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function isAdmin(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false
  const { data } = await db().auth.getUser(token)
  return data?.user?.app_metadata?.role === 'admin'
}

async function metaGet(path, params = {}) {
  const r = await fetch(`https://graph.facebook.com/${V}/${path}?` + new URLSearchParams({ ...params, access_token: process.env.META_ADS_TOKEN }), { cache: 'no-store' })
  const j = await r.json()
  if (j.error) throw new Error('Meta: ' + (j.error.error_user_msg || j.error.message))
  return j
}
async function metaSet(id, fields) {
  const r = await fetch(`https://graph.facebook.com/${V}/${id}`, { method: 'POST', body: new URLSearchParams({ ...fields, access_token: process.env.META_ADS_TOKEN }), cache: 'no-store' })
  const j = await r.json()
  if (j.error) throw new Error('Meta: ' + (j.error.error_user_msg || j.error.message))
  return j
}

async function load(sb) {
  const { data } = await sb.from('settings').select('value').eq('key', 'ads').maybeSingle()
  return { cap: 30, log: [], ignored: [], ...(data?.value || {}) }
}
async function save(sb, v) {
  v.log = (v.log || []).slice(0, 100)
  v.ignored = (v.ignored || []).slice(-300)
  const { error } = await sb.from('settings').upsert({ key: 'ads', value: v, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

// Tagesbudget aller aktiven Kampagnen/Anzeigengruppen zusammen (in Cent)
async function totalCents() {
  const acc = process.env.META_AD_ACCOUNT_ID
  const f = { effective_status: JSON.stringify(['ACTIVE']), limit: 200 }
  const [c, s] = await Promise.all([
    metaGet(`${acc}/campaigns`, { ...f, fields: 'daily_budget' }),
    metaGet(`${acc}/adsets`, { ...f, fields: 'daily_budget' }),
  ])
  return [...(c.data || []), ...(s.data || [])].reduce((t, x) => t + (+x.daily_budget || 0), 0)
}
const eur = c => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const err = (m, s = 400) => Response.json({ error: m }, { status: s })

export async function GET(req) {
  if (!(await isAdmin(req))) return err('Nur für Administratoren', 403)
  try {
    const v = await load(db())
    let total = null
    try { total = (await totalCents()) / 100 } catch {}
    return Response.json({ cap: v.cap, total, log: v.log, ignored: v.ignored })
  } catch (e) { return err(e.message, 500) }
}

export async function POST(req) {
  if (!(await isAdmin(req))) return err('Nur für Administratoren', 403)
  if (!process.env.META_ADS_TOKEN || !process.env.META_AD_ACCOUNT_ID) return err('META_ADS_TOKEN oder META_AD_ACCOUNT_ID fehlt', 500)
  const sb = db()
  try {
    const b = await req.json()
    const v = await load(sb)
    const entry = (x) => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), ...x })

    if (b.kind === 'cap') {
      const n = Math.round(parseFloat(String(b.value).replace(',', '.')) * 100) / 100
      if (!(n > 0 && n <= 10000)) return err('Bitte ein gültiges Höchstbudget eingeben')
      v.cap = n
      await save(sb, v)
      return Response.json({ ok: true, cap: n })
    }

    if (b.kind === 'ignore') {
      if (b.key && !v.ignored.includes(b.key)) v.ignored.push(b.key)
      await save(sb, v)
      return Response.json({ ok: true })
    }

    if (b.kind === 'pause') {
      const ad = await metaGet(b.adId, { fields: 'name,status' })
      if (ad.status === 'PAUSED') return err('Die Anzeige ist schon pausiert')
      await metaSet(b.adId, { status: 'PAUSED' })
      const e = entry({ kind: 'pause', objId: b.adId, name: ad.name || b.name, before: ad.status, after: 'PAUSED' })
      v.log.unshift(e)
      await save(sb, v)
      return Response.json({ ok: true, entry: e })
    }

    if (b.kind === 'budget') {
      const pct = Math.max(-MAX_PCT, Math.min(MAX_PCT, +b.pct || 0))
      if (!pct) return err('Keine Änderung')
      const obj = await metaGet(b.objId, { fields: 'name,daily_budget' })
      const old = +obj.daily_budget || 0
      if (!old) return err('Hier ist kein Tagesbudget eingestellt (Laufzeitbudget oder Budget auf Kampagnen-Ebene)')
      const neu = Math.max(100, Math.round(old * (1 + pct / 100) / 100) * 100) // auf volle Euro runden, min. 1 €
      if (neu > old) {
        const total = await totalCents()
        const after = total - old + neu
        if (after > v.cap * 100) return err(`Über deinem Höchstbudget: alle Kampagnen zusammen wären ${eur(after)} pro Tag, erlaubt sind ${eur(v.cap * 100)}.`)
      }
      await metaSet(b.objId, { daily_budget: String(neu) })
      const e = entry({ kind: 'budget', level: b.level, objId: b.objId, name: obj.name || b.name, before: old, after: neu, pct })
      v.log.unshift(e)
      await save(sb, v)
      return Response.json({ ok: true, entry: e })
    }

    if (b.kind === 'undo') {
      const e = v.log.find(x => x.id === b.logId)
      if (!e) return err('Eintrag nicht gefunden')
      if (e.undone) return err('Schon rückgängig gemacht')
      if (e.kind === 'pause') await metaSet(e.objId, { status: e.before || 'ACTIVE' })
      else if (e.kind === 'budget') {
        if (e.before > e.after) {
          const total = await totalCents()
          const after = total - e.after + e.before
          if (after > v.cap * 100) return err(`Rückgängig geht nicht: alle Kampagnen zusammen wären ${eur(after)} pro Tag, dein Höchstbudget ist ${eur(v.cap * 100)}.`)
        }
        await metaSet(e.objId, { daily_budget: String(e.before) })
      } else return err('Kann nicht rückgängig gemacht werden')
      e.undone = new Date().toISOString()
      await save(sb, v)
      return Response.json({ ok: true, entry: e })
    }

    return err('Unbekannte Aktion')
  } catch (e) { return err(e.message, 502) }
}
