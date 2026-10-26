import { buildShippedEmail, sendMail, SUBJECT_SHIPPED } from './shipping-emails'
import { shopifyOrderInfo } from './shopify-admin'

// Bestellstatus bei TNC lesen (TNC-Nummer = offers.offer_num)
const BASE = 'https://panel.theneoncompany.shop'
const DAY = 864e5
const MAILS_ON = false // erst auf true stellen, wenn alles perfekt ist

// DHL-Status: 'pre-transit' (nur Label erstellt), 'transit' (unterwegs), 'delivered', ...
async function dhlCode(num) {
  if (!process.env.DHL_API_KEY) return ''
  await new Promise(r => setTimeout(r, 5500)) // DHL erlaubt max. 1 Abfrage pro 5 Sek.
  const r = await fetch(`https://api-eu.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(num)}&language=de`, {
    headers: { 'DHL-API-Key': process.env.DHL_API_KEY, Accept: 'application/json' }, cache: 'no-store',
  })
  if (!r.ok) return ''
  return (await r.json()).shipments?.[0]?.status?.statusCode || ''
}

export async function tncStatus(id) {
  const r = await fetch(`${BASE}/api/orders/getCart?id=${encodeURIComponent(id)}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error('TNC HTTP ' + r.status)
  const d = (await r.json())?.data
  if (!d) throw new Error('TNC: keine Daten')
  const paid = d.paymentStatus === 'paid' || d.status === 'paid'
  const paidAt = d.tracking?.quotationPaid || (d.events || []).find(e => e.type === 'order_claimed_for_processing')?.date || null
  // "Produktion gestartet" wie bei TNC: eigenes Ereignis, bei älteren Bestellungen = Zahlungsdatum
  const prodAt = (d.events || []).find(e => e.type === 'production_started')?.date || paidAt
  const s = (d.shipments || []).filter(x => x?.trackTraceNumber).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
  return {
    paid, paidAt, prodAt,
    shipment: s ? { number: s.trackTraceNumber, carrier: s.carrier || 'DHL', at: s.createdAt || null, delivered: /DELIVERED/i.test(s.dhlStatus || ''), checkedAt: s.dhlLastChecked || null } : null,
  }
}

// Bestellt -> In Produktion (TNC bezahlt) -> Versendet (Sendungsnummer + Versand-Mail) -> Zugestellt
export async function syncTnc(supabase) {
  const out = []
  const { data: list } = await supabase.from('offers').select('*').in('status', ['confirmed', 'in_production', 'shipped'])
  for (const o of list || []) {
    // Bestelldatum + Lieferadresse (Name, PLZ, Ort) aus Shopify nachtragen, falls noch leer
    if ((!o.ordered_at || !o.ship_street) && o.shopify_order_id) {
      try {
        const so = await shopifyOrderInfo(o.shopify_order_id)
        const a = so?.shippingAddress || {}
        const fill = { ordered_at: so?.createdAt || null, ship_name: a.name || null, ship_street: [a.address1, a.address2].filter(Boolean).join(', ') || null, ship_zip: a.zip || null, ship_city: a.city || null }
        if (fill.ordered_at) { await supabase.from('offers').update(fill).eq('id', o.id); Object.assign(o, fill) }
      } catch (e) { out.push({ id: o.id, shopify: e.message }) }
    }
    const id = String(o.offer_num || '').trim()
    if (!/^\d{8,}$/.test(id)) continue
    try {
      const t = await tncStatus(id)
      const up = {}
      if (t.paidAt && !o.tnc_paid_at) up.tnc_paid_at = t.paidAt
      const prod = t.prodAt || new Date().toISOString()
      if (t.paid && (!o.production_at || new Date(o.production_at).getTime() !== new Date(prod).getTime())) Object.assign(up, { production_at: prod, ...(o.status === 'confirmed' ? { status: 'in_production' } : {}) })
      // Sendungsnummer sofort speichern, "Versendet" + Mail aber erst, wenn DHL das Paket wirklich hat
      if (t.shipment && o.status !== 'shipped' && !t.shipment.delivered) {
        if (o.tracking_number !== t.shipment.number) Object.assign(up, { tracking_number: t.shipment.number, tracking_company: t.shipment.carrier, tracking_url: null })
        const dhl = await dhlCode(t.shipment.number)
        if (dhl === 'transit' && MAILS_ON) Object.assign(up, { status: 'shipped', shipped_at: new Date().toISOString() })
        if (dhl === 'delivered') Object.assign(up, { status: 'delivered', shipped_at: o.shipped_at || t.shipment.at || new Date().toISOString(), delivered_at: new Date().toISOString() })
      }
      if (t.shipment?.delivered) Object.assign(up, { status: 'delivered', tracking_number: t.shipment.number, tracking_company: t.shipment.carrier, delivered_at: o.delivered_at || t.shipment.checkedAt || new Date().toISOString() })
      if (!Object.keys(up).length) continue
      await supabase.from('offers').update(up).eq('id', o.id)

      // Versand-Mail nur bei frischem Versand (Label max. 3 Tage alt), nie doppelt
      const fresh = up.status === 'shipped' && !o.shipped_at && Date.now() - new Date(t.shipment.at || 0) < 3 * DAY
      if (MAILS_ON && fresh && o.customer_email && process.env.RESEND_API_KEY) {
        await sendMail(o.customer_email, SUBJECT_SHIPPED, buildShippedEmail({ ...o, ...up }), { offerId: o.id, type: 'versand' })
      }
      out.push({ id: o.id, status: up.status || o.status, mail: !!fresh })
    } catch (e) { out.push({ id: o.id, error: e.message }) }
  }
  return out
}
