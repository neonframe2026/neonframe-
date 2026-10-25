import { buildShippedEmail, sendMail, SUBJECT_SHIPPED } from './shipping-emails'

// Bestellstatus bei TNC lesen (gleiche Nummer wie das Angebot: offers.custom_id)
const BASE = 'https://panel.theneoncompany.shop'
const DAY = 864e5

export async function tncStatus(id) {
  const r = await fetch(`${BASE}/api/orders/getCart?id=${encodeURIComponent(id)}`, { cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error('TNC HTTP ' + r.status)
  const d = (await r.json())?.data
  if (!d) throw new Error('TNC: keine Daten')
  const paid = d.paymentStatus === 'paid' || d.status === 'paid'
  const paidAt = d.tracking?.quotationPaid || (d.events || []).find(e => e.type === 'order_claimed_for_processing')?.date || null
  const s = (d.shipments || []).filter(x => x?.trackTraceNumber).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
  return {
    paid, paidAt,
    shipment: s ? { number: s.trackTraceNumber, carrier: s.carrier || 'DHL', at: s.createdAt || null, delivered: /DELIVERED/i.test(s.dhlStatus || ''), checkedAt: s.dhlLastChecked || null } : null,
  }
}

// Bestellt -> In Produktion (TNC bezahlt) -> Versendet (Sendungsnummer + Versand-Mail) -> Zugestellt
export async function syncTnc(supabase) {
  const out = []
  const { data: list } = await supabase.from('offers').select('*').in('status', ['confirmed', 'in_production', 'shipped'])
  for (const o of list || []) {
    const id = String(o.custom_id || '')
    if (!/^\d{8,}$/.test(id)) continue
    try {
      const t = await tncStatus(id)
      const up = {}
      if (t.paid && !o.production_at) Object.assign(up, { production_at: t.paidAt || new Date().toISOString(), ...(o.status === 'confirmed' ? { status: 'in_production' } : {}) })
      if (t.shipment && o.status !== 'shipped') Object.assign(up, {
        status: 'shipped', tracking_number: t.shipment.number, tracking_company: t.shipment.carrier, tracking_url: null,
        shipped_at: t.shipment.at || new Date().toISOString(),
      })
      if (t.shipment?.delivered) Object.assign(up, { status: 'delivered', delivered_at: o.delivered_at || t.shipment.checkedAt || new Date().toISOString() })
      if (!Object.keys(up).length) continue
      await supabase.from('offers').update(up).eq('id', o.id)

      // Versand-Mail nur bei frischem Versand (max. 3 Tage alt), nie doppelt
      const fresh = up.status === 'shipped' && !o.shipped_at && Date.now() - new Date(up.shipped_at) < 3 * DAY
      if (fresh && o.customer_email && process.env.RESEND_API_KEY) {
        await sendMail(o.customer_email, SUBJECT_SHIPPED, buildShippedEmail({ ...o, ...up }), { offerId: o.id, type: 'versand' })
      }
      out.push({ id: o.id, status: up.status || o.status, mail: !!fresh })
    } catch (e) { out.push({ id: o.id, error: e.message }) }
  }
  return out
}
