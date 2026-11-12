import { offerPrices, discountExpired } from './discount'
import { getSetting } from './pricing'
import { syncOfferShopify } from './shopify-admin'

// Black Week: Listenpreis bleibt wie er ist (echter Preis), nur der Rabatt wird auf 30 % gesetzt
export const BW_PCT = 30
const BOUGHT = ['confirmed', 'in_production', 'shipped', 'delivered']
export const BW_DEFAULT = { on: false, end: '2026-11-30T23:59:00+01:00', auto_new: true, mail1: true, mail2: true, mail2_at: '2026-11-28T08:10:00+01:00' }
const r2 = (n) => Math.round(n * 100) / 100

// Einstellung lesen. active = Schalter an UND Enddatum noch nicht erreicht
export async function getBW(sb) {
  const v = await getSetting(sb, 'black_week', {})
  const bw = { ...BW_DEFAULT, ...(v || {}) }
  bw.active = !!bw.on && Date.now() < new Date(bw.end).getTime()
  return bw
}

const vatOf = (o) => 1 + (parseFloat(o.vat_pct) || 19) / 100

// Listenpreis (brutto) und Black-Week-Preis (brutto) eines Angebots
export function bwListNow(o) {
  const list = r2((parseFloat(o.base_price) || 0) * vatOf(o))
  const now = offerPrices({ ...o, disc_type: 'pct', disc_val: BW_PCT }, 0).final_price
  return { list, now }
}

// Alt (wird noch von Mail/Bild benutzt, kommt im nächsten Schritt raus)
export function currentVk(o) { return bwListNow(o).now }

// Läuft gerade ein 10%-Extra-Rabatt? Dann darf nicht umgestellt werden.
export function extraRunning(o) {
  return parseFloat(o.extra_disc_pct) > 0 && !o.extra_discount_expired_at && !discountExpired(o)
}

function pricesWithDisc(o, discType, discVal) {
  const base = parseFloat(o.base_price) || 0
  return { disc_type: discType, disc_val: discVal, extra_disc_pct: 0, rrp_price: r2(base * vatOf(o)), ...offerPrices({ ...o, disc_type: discType, disc_val: discVal }, 0) }
}

async function save(sb, o, upd) {
  let ids = {}
  if (!BOUGHT.includes(o.status) && o.status !== 'unsubscribed' && parseFloat(o.base_price) > 0) {
    try { ids = await syncOfferShopify({ ...o, ...upd }) } catch (e) { console.error('Shopify Black Week:', e.message) }
  }
  const { error } = await sb.from('offers').update({ ...upd, ...ids }).eq('id', o.id)
  if (error) throw new Error(error.message)
  return { ...o, ...upd, ...ids }
}

// Angebot auf Black Week umstellen: gleicher Listenpreis, 30 % Rabatt (alte Werte merken, damit man zurück kann)
export async function toBlackWeek(sb, o) {
  if (o.black_week) return o
  if (BOUGHT.includes(o.status)) throw new Error('Angebot ist schon bestellt')
  if (!(parseFloat(o.base_price) > 0)) throw new Error('Kein Preis im Angebot')
  if (extraRunning(o)) throw new Error('Bei diesem Angebot läuft noch der 10%-Extra-Rabatt')
  const bw_prev = { disc_type: o.disc_type || 'pct', disc_val: o.disc_val ?? 20, extra_disc_pct: parseFloat(o.extra_disc_pct) || 0 }
  return save(sb, o, { black_week: true, bw_prev, ...pricesWithDisc(o, 'pct', BW_PCT) })
}

// Zurück auf normal: gleicher Listenpreis, alter Rabatt (ein Extra-Rabatt kommt nicht zurück)
export async function fromBlackWeek(sb, o) {
  if (!o.black_week) return o
  const p = o.bw_prev || {}
  // Alte Black-Week-Angebote (40 %-Version mit Aufschlag 0): alten Listenpreis + Aufschlag wiederherstellen
  if (p.base_price && (o.markup === 0 || o.markup === '0')) {
    const old = { ...o, base_price: parseFloat(p.base_price) }
    return save(sb, old, { black_week: false, bw_prev: null, markup: p.markup ?? null, base_price: old.base_price, ...pricesWithDisc(old, 'pct', parseFloat(p.disc_val) || 20) })
  }
  return save(sb, o, { black_week: false, bw_prev: null, ...pricesWithDisc(o, p.disc_type || 'pct', parseFloat(p.disc_val) || 20) })
}

// Black Week beenden: Schalter aus, alle nicht bestellten Black-Week-Angebote deaktivieren (nicht löschen)
export async function endBlackWeek(sb) {
  const bw = await getBW(sb)
  await sb.from('settings').upsert({ key: 'black_week', value: { ...stripActive(bw), on: false }, updated_at: new Date().toISOString() })
  const { data } = await sb.from('offers').select('id, status').eq('black_week', true).eq('published', true)
  const ids = (data || []).filter(o => !BOUGHT.includes(o.status)).map(o => o.id)
  if (ids.length) await sb.from('offers').update({ published: false, expired_at: new Date().toISOString() }).in('id', ids)
  return ids.length
}

// Vom Cron aufgerufen: Enddatum erreicht? Dann automatisch beenden.
export async function checkBlackWeekEnd(sb) {
  const bw = await getBW(sb)
  if (bw.on && Date.now() >= new Date(bw.end).getTime()) return endBlackWeek(sb)
  return 0
}

export function stripActive(bw) { const { active, ...rest } = bw; return rest }
