import { syncOfferShopify } from './shopify-admin'

// Extra-Rabatt (z. B. +10 %) automatisch eintragen bzw. nach Ablauf wieder entfernen.
export const EXTRA_PCT = 10
export const EXTRA_DAYS = 4
const BOUGHT = ['confirmed', 'in_production', 'shipped', 'delivered']

// Preise wie im Admin (calcPrices) berechnen
export function offerPrices(o, extraPct) {
  const base = parseFloat(o.base_price) || 0
  const dv = parseFloat(o.disc_val) || 0
  const vat = parseFloat(o.vat_pct) || 19
  const net1 = (o.disc_type || 'pct') === 'pct' ? base * (1 - dv / 100) : Math.max(0, base - dv)
  const net = net1 * (1 - (parseFloat(extraPct) || 0) / 100)
  return { net_price: Math.round(net * 100) / 100, final_price: Math.round(net * (1 + vat / 100) * 100) / 100 }
}

// Extra-Rabatt setzen (0 = entfernen): Preise im Angebot + Shopify-Entwurf anpassen
export async function setExtraDiscount(supabase, o, extraPct) {
  const upd = { extra_disc_pct: extraPct, ...offerPrices(o, extraPct) }
  let ids = {}
  if (!BOUGHT.includes(o.status) && o.status !== 'unsubscribed' && parseFloat(o.base_price) > 0) {
    ids = await syncOfferShopify({ ...o, ...upd })
  }
  const { error } = await supabase.from('offers').update({ ...upd, ...ids }).eq('id', o.id)
  if (error) throw new Error(error.message)
  return { ...o, ...upd, ...ids }
}

// Ist der Extra-Rabatt abgelaufen? Dann automatisch entfernen.
export function discountExpired(o) {
  if (!o || !o.extra_discount_at || o.extra_discount_expired_at) return false
  if (!(parseFloat(o.extra_disc_pct) > 0) || BOUGHT.includes(o.status)) return false
  const until = o.discount_valid_until ? new Date(o.discount_valid_until) : new Date(new Date(o.extra_discount_at).getTime() + EXTRA_DAYS * 86400000)
  return until.getTime() <= Date.now()
}

export async function expireIfDue(supabase, o) {
  if (!discountExpired(o)) return o
  try {
    const n = await setExtraDiscount(supabase, o, 0)
    const at = new Date().toISOString()
    await supabase.from('offers').update({ extra_discount_expired_at: at }).eq('id', o.id)
    return { ...n, extra_discount_expired_at: at }
  } catch (e) {
    console.error('Extra-Rabatt entfernen:', e)
    return o
  }
}

// Alle abgelaufenen Extra-Rabatte entfernen (Liste im Admin, stündlicher Cron)
export async function expireAll(supabase, offers) {
  const list = offers || (await supabase.from('offers').select('*').gt('extra_disc_pct', 0).not('extra_discount_at', 'is', null).is('extra_discount_expired_at', null)).data || []
  const out = []
  for (const o of list) out.push(discountExpired(o) ? await expireIfDue(supabase, o) : o)
  return out
}
