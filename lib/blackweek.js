import { offerPrices } from './discount'
import { markupFactor, getSetting } from './pricing'
import { syncOfferShopify } from './shopify-admin'

// Black Week: Endpreis = empf. VK, Listenpreis = VK / 0,6 (40 % Rabatt)
export const BW_PCT = 40
const BOUGHT = ['confirmed', 'in_production', 'shipped', 'delivered']
export const BW_DEFAULT = { on: false, end: '2026-11-30T23:59:00+01:00', auto_new: true, mail1: true, mail2: true, mail2_at: '2026-11-28T08:10:00+01:00' }
const r2 = (n) => Math.round(n * 100) / 100
const r4 = (n) => Math.round(n * 10000) / 10000

// Einstellung lesen. active = Schalter an UND Enddatum noch nicht erreicht
export async function getBW(sb) {
  const v = await getSetting(sb, 'black_week', {})
  const bw = { ...BW_DEFAULT, ...(v || {}) }
  bw.active = !!bw.on && Date.now() < new Date(bw.end).getTime()
  return bw
}

// Empf. VK der aktuellen Größe aus dem Angebot zurückrechnen (Endpreis ohne Extra-Rabatt / Aufschlag)
export function currentVk(o) {
  return r2(offerPrices(o, 0).final_price / markupFactor(o))
}

function pricesFor(o, vk, markupPct, discPct) {
  const vat = 1 + (parseFloat(o.vat_pct) || 19) / 100
  const final = vk * (1 + markupPct / 100)
  const base = r4(final / vat / (1 - discPct / 100))
  const p = offerPrices({ ...o, base_price: base, disc_type: 'pct', disc_val: discPct }, 0)
  return { base_price: base, disc_type: 'pct', disc_val: discPct, extra_disc_pct: 0, rrp_price: r2(base * vat), ...p }
}

async function save(sb, o, upd) {
  let ids = {}
  if (!BOUGHT.includes(o.status) && o.status !== 'unsubscribed' && parseFloat(upd.base_price) > 0) {
    try { ids = await syncOfferShopify({ ...o, ...upd }) } catch (e) { console.error('Shopify Black Week:', e.message) }
  }
  const { error } = await sb.from('offers').update({ ...upd, ...ids }).eq('id', o.id)
  if (error) throw new Error(error.message)
  return { ...o, ...upd, ...ids }
}

// Angebot auf Black Week umstellen (alte Werte merken, damit man zurück kann)
export async function toBlackWeek(sb, o) {
  if (o.black_week) return o
  if (BOUGHT.includes(o.status)) throw new Error('Angebot ist schon bestellt')
  const vk = currentVk(o)
  if (!(vk > 0)) throw new Error('Kein Preis im Angebot')
  const bw_prev = { markup: o.markup ?? null, disc_val: o.disc_val ?? 20, width: o.width ?? null, base_price: o.base_price ?? null }
  return save(sb, o, { black_week: true, bw_prev, markup: 0, ...pricesFor(o, vk, 0, BW_PCT) })
}

// Zurück auf normal (alter Aufschlag + alter Rabatt, gerechnet für die aktuelle Größe)
export async function fromBlackWeek(sb, o) {
  if (!o.black_week) return o
  const vk = currentVk(o)
  const p = o.bw_prev || {}
  const m = p.markup != null && p.markup !== '' ? parseFloat(p.markup) : 10
  const d = parseFloat(p.disc_val) || 20
  let prices = pricesFor(o, vk, m, d)
  // Größe nicht geändert -> exakt den alten Listenpreis zurück (keine Rundungscents)
  if (p.base_price && String(p.width) === String(o.width)) {
    const base = parseFloat(p.base_price)
    prices = { ...prices, base_price: base, rrp_price: r2(base * (1 + (parseFloat(o.vat_pct) || 19) / 100)), ...offerPrices({ ...o, base_price: base, disc_type: 'pct', disc_val: d }, 0) }
  }
  return save(sb, o, { black_week: false, bw_prev: null, markup: p.markup ?? null, ...prices })
}

// Black Week beenden: Schalter aus, alle nicht bestellten Black-Week-Angebote deaktivieren (nicht löschen)
export async function endBlackWeek(sb) {
  const bw = await getBW(sb)
  await sb.from('settings').upsert({ key: 'black_week', value: { ...stripActive(bw), on: false }, updated_at: new Date().toISOString() })
  const { data } = await sb.from('offers').select('id, status').eq('black_week', true).eq('published', true)
  const ids = (data || []).filter(o => !BOUGHT.includes(o.status)).map(o => o.id)
  if (ids.length) await sb.from('offers').update({ published: false }).in('id', ids)
  return ids.length
}

// Vom Cron aufgerufen: Enddatum erreicht? Dann automatisch beenden.
export async function checkBlackWeekEnd(sb) {
  const bw = await getBW(sb)
  if (bw.on && Date.now() >= new Date(bw.end).getTime()) return endBlackWeek(sb)
  return 0
}

export function stripActive(bw) { const { active, ...rest } = bw; return rest }
