export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// TNC-Angebot auslesen (nur lesen, speichert nichts)
// Test im Browser: /api/tnc-import?id=13309236633
// oder: /api/tnc-import?url=https://panel.theneoncompany.shop/de/product/13309236633
//
// Ergebnis: Angebotsnummer, Farbe, Rückwand, Verwendung, Design-Bild, Mindestgröße
// und size_options (50 bis 300 cm). Größen unter der Mindestgröße kommen mit disabled: true.
// Empf. VK = TNC-Partnerpreis x 1,35 (so rechnet TNC auf der Seite), Kunde zahlt Empf. VK + 10 %.

const BASE = 'https://panel.theneoncompany.shop'
const VK_FACTOR = 1.35
const MAX_W = 300
const r2 = n => Math.round(n * 100) / 100
const sleep = ms => new Promise(r => setTimeout(r, ms))

function getId(req) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (id && /^\d{8,}$/.test(id)) return id
  const m = String(searchParams.get('url') || '').match(/panel\.theneoncompany\.shop\/\w+\/product\/(\d{8,})/)
  return m ? m[1] : null
}

function mapBackplate(name = '') {
  const n = name.toLowerCase()
  if (n.includes('ausschneiden')) return 'Ausgeschnitten'
  if (n.includes('quadrat')) return 'Quadratisch'
  if (n.includes('ohne')) return 'Ohne'
  return ''
}
function mapUsage(name = '') {
  const n = name.toLowerCase()
  if (n.includes('innen')) return 'Innen'
  if (n.includes('draussen') || n.includes('außen') || n.includes('ip65')) return 'Außen IP65'
  return ''
}

async function partnerPrice(page, sign, size) {
  const body = {
    ignoreCustomPrice: false, ignoreDiscount: false,
    type: sign.text_or_logo || 'Logo', text: sign.text || '', rules: sign.rules || '1', font: sign.font || '',
    sizes: { current: size },
    backplates: sign.backplates, usecases: sign.useCases, colors: sign.colors,
    quantity: 1, orderType: sign.orderType || sign.priceType, priceLabel: sign.priceLabel,
    customerType: page.data.customer_type || 'RESELLER', express: false,
    currencyRate: page.data.currencyRate || 1,
    discount: Number(sign.discount) || 0, originalDiscount: Number(sign.original_discount) || 0,
    vat: page.countryObject?.vat ?? 19, vatOverride: false,
    customPrice: Number(sign.custom_price) || 0,
    date: page.data.date, countryObject: page.countryObject, shippingCountry: page.countryObject?.countryCode || 'DE',
    customPriceDiscountPercentage: 0, promoCode: '', quotationPromotionCode: '',
    channelFlow: page.data.channelFlow || 'channel_flow=',
  }
  const res = await fetch(BASE + '/api/calculate-price', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Preisabfrage ${size.name}: HTTP ${res.status}`)
  const j = await res.json()
  return Number(j.total_price)
}

export async function GET(req) {
  const id = getId(req)
  if (!id) return Response.json({ error: 'Bitte ?id=ANGEBOTSNUMMER oder ?url=TNC-LINK angeben' }, { status: 400 })

  try {
    const html = await (await fetch(`${BASE}/de/product/${id}`, { cache: 'no-store' })).text()
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!m) return Response.json({ error: 'Seite konnte nicht gelesen werden (keine Angebotsdaten gefunden)' }, { status: 502 })
    const page = JSON.parse(m[1]).props?.pageProps
    const sign = page?.data?.signs?.[0]
    if (!sign) return Response.json({ error: 'Kein Schild im Angebot gefunden' }, { status: 404 })

    const minW = Number(sign.min_width) || Number(sign.width) || 0
    const options = (sign.sizes?.options || [])
      .map(o => ({ ...o, w: Number(String(o.value).split('x')[0]), h: Number(String(o.value).split('x')[1]) }))
      .filter(o => o.w >= 50 && o.w <= MAX_W)

    const size_options = []
    for (const o of options) {
      const disabled = o.disabled || o.w < minW
      if (disabled) { size_options.push({ w: o.w, h: o.h, vk: null, disabled: true }); continue }
      const partner = await partnerPrice(page, sign, { name: o.name, value: o.value, disabled: false })
      const vk = r2(partner * VK_FACTOR)
      size_options.push({ w: o.w, h: o.h, partner, vk, kunde: r2(vk * 1.10), disabled: false })
      await sleep(150) // ruhig nacheinander, nicht alles auf einmal
    }

    const file = sign.selectedFile || sign.files?.[0] || {}
    return Response.json({
      num: page.data.id,
      date: page.data.date,
      colors: (sign.colors?.current || []).map(c => c.name).join(', '),
      backplate: mapBackplate(sign.backplates?.current?.name || sign.backplate),
      usage: mapUsage(sign.useCases?.current?.name || sign.indoor_or_outdoor),
      min: { w: minW, h: Number(sign.minSize?.value?.split('x')[1]) || Number(String(sign.sizes?.minSize?.value || '').split('x')[1]) || Number(sign.height) || 0 },
      design_image: file.permanent_url || file.webp_url || '', realistic_image: sign.realisticPreviewUrl || '',
      design_name: file.name || '',
      size_options,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
