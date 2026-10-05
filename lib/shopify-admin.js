// Zugriff auf die Shopify Admin-API (Dev-Dashboard-App, Client-Credentials)
// Vercel: SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET
const API_VERSION = '2026-07'
let cached = { token: null, until: 0 }

async function getToken() {
  if (cached.token && Date.now() < cached.until) return cached.token
  const { SHOPIFY_STORE, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env
  if (!SHOPIFY_STORE || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) throw new Error('Shopify-Zugang fehlt in Vercel')
  const r = await fetch(`https://${SHOPIFY_STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: SHOPIFY_CLIENT_ID, client_secret: SHOPIFY_CLIENT_SECRET }),
    cache: 'no-store',
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.access_token) throw new Error('Shopify-Login fehlgeschlagen: ' + (d.error_description || d.error || r.status))
  cached = { token: d.access_token, until: Date.now() + ((d.expires_in || 86400) - 300) * 1000 }
  return cached.token
}

async function gql(query, variables) {
  const r = await fetch(`https://${process.env.SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await getToken() },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  })
  const d = await r.json()
  if (d.errors) throw new Error('Shopify: ' + JSON.stringify(d.errors).slice(0, 200))
  return d.data
}

const COMPANY = { DHL: 'DHL eCommerce', DPD: 'DPD', GLS: 'GLS', UPS: 'UPS', Hermes: 'Hermes' }

// Bestellung in Shopify als "Ausgeführt" markieren – ohne Shopify-Mail an den Kunden
export async function fulfillShopifyOrder({ orderId, trackingNumber, trackingCompany, trackingUrl }) {
  const data = await gql(`query($id: ID!) { order(id: $id) { fulfillmentOrders(first: 10) { nodes { id status } } } }`,
    { id: `gid://shopify/Order/${orderId}` })
  const open = (data.order?.fulfillmentOrders?.nodes || []).filter(f => ['OPEN', 'IN_PROGRESS', 'SCHEDULED'].includes(f.status))
  if (!open.length) return { skipped: 'Bestellung ist in Shopify schon ausgeführt' }

  const res = await gql(`mutation($f: FulfillmentInput!) { fulfillmentCreate(fulfillment: $f) { fulfillment { id status } userErrors { message } } }`, {
    f: {
      notifyCustomer: false,
      lineItemsByFulfillmentOrder: open.map(f => ({ fulfillmentOrderId: f.id })),
      trackingInfo: { number: trackingNumber, company: COMPANY[trackingCompany] || trackingCompany || 'DHL eCommerce', ...(trackingUrl ? { url: trackingUrl } : {}) },
    },
  })
  const err = res.fulfillmentCreate?.userErrors?.[0]?.message
  if (err) throw new Error('Shopify: ' + err)
  return { success: true }
}

// Bestellentwurf anlegen (für geänderte Größe auf der Angebotsseite) – gibt den Checkout-Link zurück
// listNet = Listenpreis netto, discType 'pct' | 'eur', discVal (bei 'eur' netto), vatPct
export async function createDraftOrder({ email, title, listNet, discType, discVal, vatPct, attributes, note }) {
  const shop = await gql(`{ shop { taxesIncluded currencyCode } }`)
  const incl = !!shop.shop?.taxesIncluded
  const cur = shop.shop?.currencyCode || 'EUR'
  const f = incl ? 1 + (parseFloat(vatPct) || 19) / 100 : 1
  const unit = (listNet * f).toFixed(2)
  const val = parseFloat(discVal) || 0
  const appliedDiscount = val > 0
    ? (discType === 'pct'
      ? { valueType: 'PERCENTAGE', value: val, title: `${val}% Rabatt` }
      : { valueType: 'FIXED_AMOUNT', value: Number((val * f).toFixed(2)), title: 'Rabatt' })
    : null

  const res = await gql(`mutation($input: DraftOrderInput!) { draftOrderCreate(input: $input) { draftOrder { id invoiceUrl } userErrors { field message } } }`, {
    input: {
      ...(email ? { email } : {}),
      note: note || null,
      lineItems: [{
        title,
        quantity: 1,
        originalUnitPriceWithCurrency: { amount: unit, currencyCode: cur },
        requiresShipping: true,
        taxable: true,
        customAttributes: attributes.filter(a => a.value),
        ...(appliedDiscount ? { appliedDiscount } : {}),
      }],
      shippingLine: { title: 'Kostenloser Versand', priceWithCurrency: { amount: '0.00', currencyCode: cur } },
    },
  })
  const err = res.draftOrderCreate?.userErrors?.[0]
  if (err) throw new Error('Shopify: ' + err.message)
  return res.draftOrderCreate.draftOrder
}
