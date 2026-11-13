import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Ads-Analyse (Paul, nur für Administratoren): liest Werbedaten aus dem Meta-Werbekonto.
// Nur LESEN. Änderungen (pausieren, Budget) kommen später in eine eigene Route,
// die nur nach Klick auf "Freigeben" läuft.
// Env: META_ADS_TOKEN (Systemnutzer "Zentrale Analyse"), META_AD_ACCOUNT_ID (act_…)
// GET /api/ads?since=2026-11-01&until=2026-11-13   (Standard: letzte 30 Tage)
const V = 'v23.0'
const r2 = n => Math.round((+n || 0) * 100) / 100
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function isAdmin(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false
  const { data } = await db().auth.getUser(token)
  return data?.user?.app_metadata?.role === 'admin'
}

// Meta Graph API aufrufen (mit Seitenweise-Laden)
async function meta(path, params = {}) {
  const out = []
  let url = `https://graph.facebook.com/${V}/${path}?` + new URLSearchParams({ ...params, access_token: process.env.META_ADS_TOKEN })
  for (let i = 0; url && i < 10; i++) {
    const r = await fetch(url, { cache: 'no-store' })
    const j = await r.json()
    if (j.error) throw new Error(j.error.message || 'Meta-Fehler')
    if (!Array.isArray(j.data)) return j
    out.push(...j.data)
    url = j.paging?.next || null
  }
  return out
}

// Leads/Käufe aus "actions" zählen (größten Wert nehmen, damit nichts doppelt zählt)
const pick = (actions, types) => Math.max(0, ...((actions || []).filter(a => types.includes(a.action_type)).map(a => +a.value || 0)))
// Standard-Lead-Ereignisse + eure benutzerdefinierte Conversion "NeonFrame Lead" (wird unten automatisch gesucht)
const LEAD_STD = ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped', 'onsite_web_lead']
const BUY = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase']

const iso = d => d.toISOString().slice(0, 10)

export async function GET(req) {
  if (!(await isAdmin(req))) return Response.json({ error: 'Nur für Administratoren' }, { status: 403 })
  const acc = process.env.META_AD_ACCOUNT_ID
  if (!process.env.META_ADS_TOKEN || !acc) return Response.json({ error: 'META_ADS_TOKEN oder META_AD_ACCOUNT_ID fehlt in Vercel' }, { status: 500 })

  const u = new URL(req.url)
  const until = u.searchParams.get('until') || iso(new Date())
  const since = u.searchParams.get('since') || iso(new Date(Date.now() - 29 * 864e5))
  const time_range = JSON.stringify({ since, until })
  const F = 'spend,impressions,clicks,ctr,actions'

  try {
    const [info, daily, adRows, ads, campaigns, custom] = await Promise.all([
      meta(acc, { fields: 'name,currency,account_status,timezone_name' }),
      meta(`${acc}/insights`, { fields: F, time_range, time_increment: 1, limit: 100 }),
      meta(`${acc}/insights`, { fields: `ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,${F}`, level: 'ad', time_range, limit: 200 }),
      meta(`${acc}/ads`, { fields: 'id,name,effective_status,adset_id,campaign_id,creative{thumbnail_url}', limit: 200 }),
      meta(`${acc}/campaigns`, { fields: 'id,name,effective_status,daily_budget,lifetime_budget', limit: 100 }),
      meta(`${acc}/customconversions`, { fields: 'id,name', limit: 100 }).catch(() => []),
    ])
    // Benutzerdefinierte Conversions mit "Lead" im Namen zählen als Lead (z. B. "NeonFrame Lead")
    const leadCustom = custom.filter(c => /lead/i.test(c.name || ''))
    const LEAD = [...LEAD_STD, ...leadCustom.map(c => 'offsite_conversion.custom.' + c.id)]
    const adsets = await meta(`${acc}/adsets`, { fields: 'id,name,effective_status,daily_budget,lifetime_budget,campaign_id', limit: 200 })

    const days = daily.map(d => ({
      date: d.date_start, spend: r2(d.spend), impressions: +d.impressions || 0, clicks: +d.clicks || 0,
      leads: pick(d.actions, LEAD), purchases: pick(d.actions, BUY),
    }))

    const stat = Object.fromEntries(adRows.map(a => [a.ad_id, a]))
    const setOf = Object.fromEntries(adsets.map(s => [s.id, s]))
    const campOf = Object.fromEntries(campaigns.map(c => [c.id, c]))
    const adList = ads.map(a => {
      const s = stat[a.id] || {}, set = setOf[a.adset_id] || {}, camp = campOf[a.campaign_id] || {}
      const spend = r2(s.spend), leads = pick(s.actions, LEAD)
      return {
        id: a.id, name: a.name, status: a.effective_status, thumb: a.creative?.thumbnail_url || null,
        adset: { id: a.adset_id, name: set.name, status: set.effective_status, daily_budget: set.daily_budget ? +set.daily_budget / 100 : null },
        campaign: { id: a.campaign_id, name: camp.name, status: camp.effective_status, daily_budget: camp.daily_budget ? +camp.daily_budget / 100 : null },
        spend, impressions: +s.impressions || 0, clicks: +s.clicks || 0, ctr: r2(s.ctr),
        leads, purchases: pick(s.actions, BUY), cpl: leads ? r2(spend / leads) : null,
      }
    }).sort((x, y) => y.spend - x.spend)

    const sum = k => r2(days.reduce((t, d) => t + d[k], 0))
    const totals = { spend: sum('spend'), impressions: sum('impressions'), clicks: sum('clicks'), leads: sum('leads'), purchases: sum('purchases') }
    totals.cpl = totals.leads ? r2(totals.spend / totals.leads) : null

    return Response.json({
      account: { name: info.name, currency: info.currency, status: info.account_status, tz: info.timezone_name },
      range: { since, until }, leadEvent: leadCustom.map(c => c.name), totals, days, ads: adList,
    })
  } catch (e) {
    return Response.json({ error: 'Meta: ' + e.message }, { status: 502 })
  }
}
