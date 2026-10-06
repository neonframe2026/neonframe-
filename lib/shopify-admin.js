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

// ================= Angebote: verstecktes Produkt + Bestellentwurf =================
const PRODUCT_TITLE = 'Individuelles LED-Neon-Schild'
let shopCache = null
async function shopInfo() {
  if (shopCache) return shopCache
  const d = await gql(`{ shop { taxesIncluded currencyCode } }`)
  shopCache = { incl: !!d.shop?.taxesIncluded, cur: d.shop?.currencyCode || 'EUR' }
  return shopCache
}
const errOf = (r) => (r?.userErrors || []).map(e => e.message).join(', ')

// Produkt anlegen oder vorhandenes holen -> { productId, variantId }
async function ensureProduct(o) {
  if (o.shopify_product_id) {
    const d = await gql(`query($id: ID!) { product(id: $id) { id status variants(first: 1) { nodes { id } } } }`, { id: o.shopify_product_id })
    const v = d.product?.variants?.nodes?.[0]?.id
    if (d.product && v) {
      if (d.product.status !== 'ACTIVE') await gql(`mutation($p: ProductUpdateInput!) { productUpdate(product: $p) { userErrors { message } } }`, { p: { id: d.product.id, status: 'ACTIVE' } })
      return { productId: d.product.id, variantId: v }
    }
  }
  const media = o.preview_image ? [{ originalSource: o.preview_image, mediaContentType: 'IMAGE', alt: PRODUCT_TITLE }] : []
  const d = await gql(`mutation($p: ProductCreateInput!, $m: [CreateMediaInput!]) {
    productCreate(product: $p, media: $m) { product { id variants(first: 1) { nodes { id } } } userErrors { message } } }`, {
    p: { title: PRODUCT_TITLE, status: 'ACTIVE', vendor: 'NeonFrame', productType: 'Angebot', tags: ['angebot', `angebot-${o.offer_num || o.id}`] },
    m: media,
  })
  const e = errOf(d.productCreate)
  if (e) throw new Error('Shopify Produkt: ' + e)
  const product = d.productCreate.product
  return { productId: product.id, variantId: product.variants.nodes[0].id }
}

// Preis am Produkt setzen (Listenpreis, Rabatt kommt im Entwurf dazu)
async function setVariantPrice(productId, variantId, unit) {
  const d = await gql(`mutation($pid: ID!, $v: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $pid, variants: $v) { userErrors { message } } }`, {
    pid: productId,
    v: [{ id: variantId, price: unit, taxable: true, inventoryPolicy: 'CONTINUE', inventoryItem: { tracked: false, requiresShipping: true } }],
  })
  const e = errOf(d.productVariantsBulkUpdate)
  if (e) throw new Error('Shopify Preis: ' + e)
}

// Produkt + Bestellentwurf für ein Angebot anlegen bzw. aktualisieren.
// o = Angebot mit width, height, base_price (netto, vor Rabatt), disc_type, disc_val, vat_pct, ... und evtl. shopify_*_id
// Gibt { shopify_product_id, shopify_variant_id, shopify_draft_id, checkout_url } zurück
export async function syncOfferShopify(o) {
  const { incl, cur } = await shopInfo()
  const vatPct = parseFloat(o.vat_pct) || 19
  const f = incl ? 1 + vatPct / 100 : 1
  const unit = ((parseFloat(o.base_price) || 0) * f).toFixed(2)
  const dType = o.disc_type || 'pct'
  const dVal = parseFloat(o.disc_val) || 0
  const appliedDiscount = dVal > 0
    ? (dType === 'pct' ? { valueType: 'PERCENTAGE', value: dVal, title: `${dVal}% Rabatt` } : { valueType: 'FIXED_AMOUNT', value: Number((dVal * f).toFixed(2)), title: 'Rabatt' })
    : null

  const { productId, variantId } = await ensureProduct(o)
  await setVariantPrice(productId, variantId, unit)

  const attrs = [
    { key: 'Angebot', value: String(o.offer_num || o.id) },
    { key: 'Größe', value: o.width && o.height ? `${o.width} × ${o.height} cm` : '' },
    { key: 'Farbe(n)', value: o.colors || '' },
    { key: 'Rückwand', value: [o.backplate, o.backplate_color].filter(Boolean).join(' / ') },
    { key: 'Verwendung', value: o.usage || '' },
  ].filter(a => a.value)
  const input = {
    ...(o.customer_email ? { email: o.customer_email } : {}),
    note: `Angebot ${o.offer_num || o.id}${o.project ? ' – ' + o.project : ''}`,
    tags: ['angebot'],
    lineItems: [{ variantId, quantity: 1, customAttributes: attrs, ...(appliedDiscount ? { appliedDiscount } : {}) }],
    shippingLine: { title: 'Kostenloser Versand', priceWithCurrency: { amount: '0.00', currencyCode: cur } },
  }

  // Vorhandenen Entwurf ändern statt neu anlegen
  let draft = null
  if (o.shopify_draft_id) {
    const q = await gql(`query($id: ID!) { draftOrder(id: $id) { id status } }`, { id: o.shopify_draft_id })
    const st = q.draftOrder?.status
    if (st === 'COMPLETED') throw new Error('Dieses Angebot wurde bereits bestellt')
    if (st) {
      const u = await gql(`mutation($id: ID!, $i: DraftOrderInput!) { draftOrderUpdate(id: $id, input: $i) { draftOrder { id invoiceUrl } userErrors { message } } }`, { id: q.draftOrder.id, i: input })
      const e = errOf(u.draftOrderUpdate)
      if (e) throw new Error('Shopify Entwurf: ' + e)
      draft = u.draftOrderUpdate.draftOrder
    }
  }
  if (!draft) {
    const c = await gql(`mutation($i: DraftOrderInput!) { draftOrderCreate(input: $i) { draftOrder { id invoiceUrl } userErrors { message } } }`, { i: input })
    const e = errOf(c.draftOrderCreate)
    if (e) throw new Error('Shopify Entwurf: ' + e)
    draft = c.draftOrderCreate.draftOrder
  }
  return { shopify_product_id: productId, shopify_variant_id: variantId, shopify_draft_id: draft.id, checkout_url: draft.invoiceUrl }
}

// Aufräumen: Entwurf löschen (falls nicht bestellt) und Produkt löschen bzw. archivieren
export async function removeOfferShopify(o, { archiveOnly = false } = {}) {
  if (o.shopify_draft_id && !archiveOnly) {
    try {
      const q = await gql(`query($id: ID!) { draftOrder(id: $id) { status } }`, { id: o.shopify_draft_id })
      if (q.draftOrder && q.draftOrder.status !== 'COMPLETED') await gql(`mutation($i: DraftOrderDeleteInput!) { draftOrderDelete(input: $i) { userErrors { message } } }`, { i: { id: o.shopify_draft_id } })
    } catch {}
  }
  if (o.shopify_product_id) {
    try {
      if (archiveOnly) await gql(`mutation($p: ProductUpdateInput!) { productUpdate(product: $p) { userErrors { message } } }`, { p: { id: o.shopify_product_id, status: 'ARCHIVED' } })
      else await gql(`mutation($i: ProductDeleteInput!) { productDelete(input: $i) { userErrors { message } } }`, { i: { id: o.shopify_product_id } })
    } catch {}
  }
}
