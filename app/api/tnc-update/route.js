import { createClient } from '@supabase/supabase-js'
import { syncOfferShopify } from '../../../lib/shopify-admin'
import { logEmail } from '../../../lib/email-log'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Änderung von TNC in ein BESTEHENDES Angebot übernehmen
// GET  ?id=TNC-NUMMER        -> Vorher/Nachher anzeigen (speichert nichts)
// POST { id, notify: true }  -> Angebot + Shopify aktualisieren, Kunde bekommt Mail

const SITE = 'https://angebote.neonframe.de'
const r2 = n => Math.round(n * 100) / 100
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))

async function load(req, id) {
  const { data: list } = await db().from('offers').select('*').eq('offer_num', String(id)).order('created_at', { ascending: false }).limit(1)
  const offer = list?.[0]
  if (!offer) throw new Error(`Kein Angebot mit TNC-Nummer ${id} gefunden`)
  const origin = new URL(req.url).origin
  const tnc = await (await fetch(`${origin}/api/tnc-import?id=${id}`, { cache: 'no-store' })).json()
  if (tnc.error) throw new Error(tnc.error)
  const rows = (tnc.size_options || []).filter(r => !r.disabled && r.vk > 0)
  const cur = tnc.current?.w ? tnc.current : tnc.min
  const row = rows.find(r => r.w === cur?.w) || rows[0]
  if (!row) throw new Error('Keine Preise von TNC erhalten')
  const next = {
    width: row.w, height: row.h, vk: row.vk, final: r2(row.vk * 1.10),
    colors: tnc.colors || offer.colors, backplate: tnc.backplate || offer.backplate, usage: tnc.usage || offer.usage,
    realistic_image: tnc.realistic_image || '', design_image: tnc.design_image || '',
    size_options: rows.filter(r => r.w !== row.w).map(r => ({ w: r.w, h: r.h, vk: r.vk })),
    all: rows.map(r => ({ w: r.w, h: r.h, vk: r.vk })),
  }
  return { offer, next }
}

// TNC-Bild in den eigenen Speicher kopieren (damit es dauerhaft beim Kunden lädt)
async function copyImage(url, offerId, n) {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
    const path = `${offerId}-tnc-${n}-${Date.now()}.${ext}`
    const { error } = await db().storage.from('offer-images').upload(path, Buffer.from(await res.arrayBuffer()), { contentType: type, upsert: true })
    if (error) return null
    return db().storage.from('offer-images').getPublicUrl(path).data.publicUrl
  } catch { return null }
}

export async function GET(req) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return Response.json({ error: 'TNC-Nummer fehlt' }, { status: 400 })
    const { offer, next } = await load(req, id)
    return Response.json({
      before: {
        id: offer.id, custom_id: offer.custom_id, project: offer.project, customer_email: offer.customer_email, status: offer.status,
        width: offer.width, height: offer.height, colors: offer.colors, backplate: offer.backplate, usage: offer.usage,
        final: offer.final_price, images: [offer.preview_image, offer.preview_image_2, offer.preview_image_3].filter(Boolean),
        customer_note: offer.customer_note || '', offer,
      },
      after: next,
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { id, notify, edit } = await req.json()
    const { offer: o, next } = await load(req, id)

    // Eigene Änderungen aus dem Admin übernehmen (Komma oder Punkt erlaubt)
    const ed = edit || {}
    const num = v => { const t = String(v ?? '').trim(); if (!t) return NaN; return t.includes(',') ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t) }
    if (num(ed.width) > 0) next.width = num(ed.width)
    if (num(ed.height) > 0) next.height = num(ed.height)
    if (num(ed.final) > 0) next.final = r2(num(ed.final))
    for (const k of ['colors', 'backplate', 'usage']) if (ed[k]) next[k] = ed[k]
    next.size_options = next.all.filter(r => r.w !== next.width)

    // Preis wie bei der Größenauswahl: Endpreis = Empf. VK + 10 %, daraus Listenpreis netto zurückrechnen
    const dType = o.disc_type || 'pct'
    const dVal = parseFloat(o.disc_val) || 0
    const vat = 1 + (parseFloat(o.vat_pct) || 19) / 100
    const ex = (parseFloat(o.extra_disc_pct) || 0) / 100
    const base = Math.round((dType === 'pct' ? next.final / vat / (1 - dVal / 100) : next.final / vat + dVal) * 10000) / 10000
    const net = (dType === 'pct' ? base * (1 - dVal / 100) : Math.max(0, base - dVal)) * (1 - ex)

    const img1 = ed.img1 || await copyImage(next.realistic_image, o.id, 1)
    const img2 = ed.img2 || await copyImage(next.design_image, o.id, 2)
    const imgs = [img1, img2].filter(Boolean)

    const updated = {
      width: String(next.width), height: String(next.height),
      colors: next.colors, backplate: next.backplate, usage: next.usage,
      base_price: base, net_price: r2(net), final_price: r2(net * vat), rrp_price: r2(base * vat),
      size_options: next.size_options.length ? next.size_options : null,
      ...(imgs[0] ? { preview_image: imgs[0] } : {}),
      ...(imgs[1] ? { preview_image_2: imgs[1] } : {}),
      ...(ed.checkout_image ? { checkout_image: ed.checkout_image } : imgs.length ? { checkout_image: null } : {}),
      ...(typeof ed.customer_note === 'string' ? { customer_note: ed.customer_note.trim() || null } : {}),
    }

    let ids = {}
    let shopifyError = null
    try {
      const shopImg = ed.checkout_image || imgs[1] || imgs[0]
      ids = await syncOfferShopify({ ...o, ...updated }, shopImg ? { imageUrl: shopImg, refreshImage: true } : {})
    } catch (e) { shopifyError = e.message }

    const { error } = await db().from('offers').update({ ...updated, ...ids }).eq('id', o.id)
    if (error) throw new Error(error.message)
    await db().from('agent_tasks').update({ status: 'done', done_at: new Date().toISOString() }).eq('type', 'update').eq('tnc_id', String(id)).eq('status', 'open')

    let mailSent = false
    if (notify && o.customer_email && process.env.RESEND_API_KEY) {
      const link = `${SITE}/angebot/${o.custom_id || o.id}`
      const first = (o.project || '').split(' ')[0] || 'dort'
      const subject = 'Dein Angebot wurde angepasst 💡'
      const html = buildMail({ first, link, image: imgs[0] || imgs[1] || o.preview_image, size: `${next.width} × ${next.height} cm`, colors: next.colors, variant: next.usage, discount: o.disc_type === 'pct' && parseFloat(o.disc_val) > 0 ? o.disc_val : null, price: r2(net * vat) })
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'NeonFrame <angebote@neonframe.de>', to: [o.customer_email], subject, html }),
      })
      mailSent = res.ok
      if (res.ok) await logEmail(o.id, 'angebot_update', subject, html, o.customer_email)
    }

    return Response.json({ success: true, offerId: o.custom_id || o.id, mailSent, shopifyError })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

function buildMail({ first, link, image, size, colors, variant, price, discount, assets }) {
  const F = 'font-family:Arial,Helvetica,sans-serif;'
  const A = assets || 'https://angebote.neonframe.de/email'
  const eur = Number(price).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const specRows = [['Größe', size], ['Ausführung', variant], ['Farben', colors], ['Preis', eur]]
    .filter(([, v]) => v)
    .map(([l, v]) => `<tr><td width="100" valign="top" style="${F}padding:6px 0;font-size:14px;line-height:20px;font-weight:bold;color:#475569;width:100px">${l}:</td><td valign="top" style="${F}padding:6px 0;font-size:14px;line-height:20px;color:#111111">${v}</td></tr>`).join('')
  const imageCell = image ? `<td class="stack" width="160" valign="top" align="center" style="width:160px;padding:0 18px 0 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
        <tr><td align="center"><a href="${link}" target="_blank" style="text-decoration:none;border:0"><img class="stack-img" src="${image}" width="140" alt="Deine neue Vorschau" style="display:block;width:140px;max-width:140px;height:auto;border:2px solid #0ea5e9;border-radius:10px;margin:0 auto"></a></td></tr>
        ${discount ? `<tr><td height="10" style="height:10px;font-size:1px;line-height:1px">&nbsp;</td></tr><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#10b981" style="${F}padding:5px 12px;font-size:12px;line-height:16px;font-weight:bold;color:#ffffff;border-radius:6px">${discount} % RABATT</td></tr></table></td></tr>` : ''}
      </table></td>` : ''
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<style>:root{color-scheme:light only;supported-color-schemes:light only}@media (max-width:600px){.pad{padding:26px 20px 22px !important}.stack{display:block !important;width:100% !important;padding:0 !important}.stack-img{margin:0 auto 10px !important}.stack-spec{padding-top:12px !important}.btn{padding:16px 20px !important}.btntxt{font-size:16px !important}}</style></head>
<body style="margin:0;padding:0;background:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f5" style="background:#f4f4f5"><tr><td align="center" style="padding:32px 10px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td bgcolor="#09080a" style="background:#09080a;padding:0;font-size:0;line-height:0"><img src="${A}/header.png" width="600" alt="NeonFrame" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>
<tr><td class="pad" bgcolor="#ffffff" style="background:#ffffff;padding:36px 36px 28px">
<div style="${F}margin:0 0 16px;font-size:22px;line-height:28px;font-weight:bold;color:#111111">Hallo ${first},</div>
<div style="${F}margin:0 0 20px;font-size:15px;line-height:24px;color:#333333">wir haben dein Angebot nach deinen Wünschen angepasst. Die neuen Details haben wir dir hier zusammengefasst. Dein Angebot ist weiterhin für dich reserviert.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8fafc" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px"><tr><td style="padding:16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${imageCell}<td class="stack stack-spec" valign="middle"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${specRows}</table></td></tr></table>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="24" style="height:24px;font-size:1px;line-height:1px">&nbsp;</td></tr><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" class="btn" bgcolor="#0ea5e9" style="background:#0ea5e9;border-radius:12px;padding:18px 40px"><a class="btntxt" href="${link}" target="_blank" style="${F}white-space:nowrap;font-size:18px;line-height:22px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block"><span style="color:#ffffff;text-decoration:none">Angepasstes Angebot ansehen</span></a></td></tr></table>
</td></tr><tr><td height="30" style="height:30px;font-size:1px;line-height:1px">&nbsp;</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0;line-height:0;font-size:0"><a href="mailto:info@neonframe.de" style="text-decoration:none;border:0"><img src="${A}/kontakt.png" width="528" alt="Noch Fragen? Antworte einfach auf diese E-Mail oder schreib an info@neonframe.de" style="display:block;width:100%;max-width:528px;height:auto;border:0;border-radius:12px"></a></td></tr></table>
<div style="${F}margin:26px 0 4px;font-size:15px;line-height:22px;color:#555555">Viele Grüße</div>
<div style="${F}margin:0;font-size:15px;line-height:22px;font-weight:bold;color:#111111">Dein NeonFrame-Team</div>
</td></tr>
<tr><td align="center" bgcolor="#f8fafc" style="${F}background:#f8fafc;border-top:1px solid #eeeeee;padding:20px 36px;font-size:12px;line-height:18px;color:#aaaaaa;border-radius:0 0 16px 16px"><a href="https://neonframe.de" style="color:#0ea5e9;text-decoration:none">neonframe.de</a> &nbsp;·&nbsp; <a href="mailto:info@neonframe.de" style="color:#0ea5e9;text-decoration:none">info@neonframe.de</a></td></tr>
</table></td></tr></table></body></html>`.replace(/>\s+</g, '><')
}
