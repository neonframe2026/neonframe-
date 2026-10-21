import { createClient } from '@supabase/supabase-js'
import { knowledgeText } from './wissen'

// Strategie & Planung: Kennzahlen aus Angeboten, Anfragen und Nachrichten + KI (David & Clara)
export const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const BOUGHT = ['confirmed', 'in_production', 'shipped', 'delivered']
const H = 3600000, D = 24 * H
const t = (d) => (d ? new Date(d).getTime() : 0)
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : 0 }

// ---------- Zeit (deutsche Zeit) ----------
function parts(ms) { const s = new Date(ms).toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }); return { y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) } }
function berlinMidnight(y, m, d) { // 0:00 Uhr deutscher Zeit -> ms
  const guess = Date.UTC(y, m - 1, d); const s = new Date(guess).toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' })
  const off = Date.parse(s.replace(' ', 'T') + 'Z') - guess; return guess - off
}
const fmt = (ms) => new Date(ms).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' })
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
export function periods(now = Date.now()) {
  const p = parts(now)
  const today = berlinMidnight(p.y, p.m, p.d)
  const wd = (new Date(today + 12 * H).getUTCDay() + 6) % 7 // 0 = Montag
  const wk = today - wd * D // Montag dieser Woche (ungefähr, Sommerzeit egal für Zählung)
  const weekStart = (ms) => { const q = parts(ms); return berlinMidnight(q.y, q.m, q.d) }
  const w0 = weekStart(wk), w1 = weekStart(wk - 7 * D + 2 * H), w2 = weekStart(wk - 14 * D + 2 * H)
  const m0 = berlinMidnight(p.y, p.m, 1)
  const pm = p.m === 1 ? { y: p.y - 1, m: 12 } : { y: p.y, m: p.m - 1 }
  const ppm = pm.m === 1 ? { y: pm.y - 1, m: 12 } : { y: pm.y, m: pm.m - 1 }
  const m1 = berlinMidnight(pm.y, pm.m, 1), m2 = berlinMidnight(ppm.y, ppm.m, 1)
  const ly = berlinMidnight(pm.y - 1, pm.m, 1), lyEnd = berlinMidnight(pm.m === 12 ? pm.y : pm.y - 1, pm.m === 12 ? 1 : pm.m + 1, 1)
  const y0 = berlinMidnight(p.y, 1, 1), y1 = berlinMidnight(p.y - 1, 1, 1)
  const kw = (ms) => { const dt = new Date(ms + 12 * H); const th = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate() + 3 - ((dt.getUTCDay() + 6) % 7))); const f = new Date(Date.UTC(th.getUTCFullYear(), 0, 4)); return 1 + Math.round(((th - f) / D - 3 + ((f.getUTCDay() + 6) % 7)) / 7) }
  return {
    week: { key: 'week-' + fmt(w1), label: `KW ${kw(w1)} (${fmt(w1).slice(0, 6)} bis ${fmt(w0 - D).slice(0, 6)})`, cur: [w1, w0], prev: [w2, w1], prevLabel: `KW ${kw(w2)}`, now: [w0, now], nowPrev: [w1, w1 + (now - w0)], nowLabel: `Diese Woche (${fmt(w0).slice(0, 6)} bis heute)`, nowPrevLabel: 'Vorwoche bis gleicher Tag' },
    month: { key: `month-${pm.y}-${pm.m}`, label: `${MON[pm.m - 1]} ${pm.y}`, cur: [m1, m0], prev: [m2, m1], prevLabel: `${MON[ppm.m - 1]} ${ppm.y}`, ly: [ly, lyEnd], lyLabel: `${MON[pm.m - 1]} ${pm.y - 1}`, now: [m0, now], nowPrev: [m1, m1 + (now - m0)], nowLabel: `${MON[p.m - 1]} bis heute`, nowPrevLabel: `${MON[pm.m - 1]} bis gleicher Tag` },
    year: { key: `year-${p.y}-${p.m}`, label: `${p.y} bis heute`, cur: [y0, now], prev: [y1, y1 + (now - y0)], prevLabel: `${p.y - 1} gleicher Zeitraum`, full: [y1, y0], fullLabel: `${p.y - 1} gesamt`, now: [y0, now], nowPrev: [y1, y1 + (now - y0)], nowLabel: `${p.y} bis heute`, nowPrevLabel: `${p.y - 1} bis gleicher Tag` },
    monthKey: `${p.y}-${String(p.m).padStart(2, '0')}`, monthName: MON[p.m - 1], monthRange: [m0, now],
  }
}

// ---------- Rohdaten einmal laden ----------
export async function loadData(db, since) {
  const iso = new Date(since).toISOString()
  const [{ data: offers }, { data: ek }, { data: inbox }, { data: msgs }] = await Promise.all([
    db.from('offers').select('id,created_at,status,final_price,customer_email,recontacted_at,extra_discount_at,discount_reminder_sent_at,order_email_sent_at,review_email_sent_at').gte('created_at', new Date(since - 120 * D).toISOString()).limit(5000),
    db.from('einkauf').select('created_at,kind,email,status').gte('created_at', iso).limit(5000),
    db.from('inbox').select('created_at,kind,action').gte('created_at', iso).limit(5000),
    db.from('social_msgs').select('thread_id,dir,at').eq('dir', 'in').gte('at', iso).limit(10000),
  ])
  return { offers: offers || [], ek: ek || [], inbox: inbox || [], msgs: msgs || [] }
}

// ---------- Kennzahlen für einen Zeitraum ----------
export function stats(D0, [a, b]) {
  const inR = (d) => { const x = t(d); return x >= a && x < b }
  const ek = D0.ek.filter(r => inR(r.created_at))
  const offers = D0.offers.filter(o => inR(o.created_at))
  const bought = D0.offers.filter(o => BOUGHT.includes(o.status) && inR(o.order_email_sent_at || o.created_at))
  const umsatz = bought.reduce((s, o) => s + num(o.final_price), 0)
  const fragen = D0.inbox.filter(r => r.kind === 'kundenfrage' && inR(r.created_at)).length
  const chats = new Set(D0.msgs.filter(m => inR(m.at)).map(m => m.thread_id)).size
  // Zeit von Anfrage bis Angebot (gleiche E-Mail, Anfrage max. 7 Tage vorher)
  const req = D0.ek.map(r => ({ e: String(r.email || '').toLowerCase(), t: t(r.created_at) })).filter(r => r.e)
  const waits = offers.map(o => { const e = String(o.customer_email || '').toLowerCase(); const ot = t(o.created_at); const r = req.filter(x => x.e === e && x.t <= ot && ot - x.t < 7 * D).sort((p, q) => q.t - p.t)[0]; return r ? (ot - r.t) / H : null }).filter(x => x != null).sort((p, q) => p - q)
  const wait = waits.length ? waits[Math.floor(waits.length / 2)] : null
  return {
    anfragen: ek.length, logo: ek.filter(r => r.kind === 'logo').length, text: ek.filter(r => r.kind !== 'logo').length,
    angebote: offers.length, verkaeufe: bought.length, umsatz: Math.round(umsatz),
    warenkorb: bought.length ? Math.round(umsatz / bought.length) : 0,
    conversion: offers.length ? Math.round(bought.length / offers.length * 100) : 0,
    erinnerungen: D0.offers.filter(o => inR(o.recontacted_at)).length,
    rabatte: D0.offers.filter(o => inR(o.extra_discount_at)).length,
    gemeldet: fragen + chats, mails: fragen, chats,
    offen: offers.filter(o => !BOUGHT.includes(o.status)).length,
    wartezeit: wait == null ? null : Math.round(wait * 10) / 10,
  }
}

// ---------- KI ----------
const BASE = `NeonFrame (neonframe.de): Phillip Nägele verkauft individuelle LED-Neonschilder (Text oder Logo) nur in Deutschland, Einzelunternehmen, Onlineshop auf Shopify.
Ablauf: Kunde fragt im Konfigurator an, bekommt werktags in ca. 6 Std. ein Angebot mit 3D-Vorschau per Mail, danach automatisch Erinnerung nach 12 Std., Rabatt-Mail (Extra-Rabatt) 12 Std. später, Rabatt-Erinnerung vor Ablauf. Kauf über Shopify-Checkout.
Lieferung Standard 2 bis 3 Wochen, Express 7 bis 10 Werktage (+30%). Versand gratis. Keine Rückgabe (personalisiert). Ads laufen auf Meta (Instagram, Facebook).
Team aus KI-Agenten in der Zentrale: Lisa (Angebote), Sarah (Mail-Postfach), Jonas (Instagram/Facebook), Mia (Ad-Prompts), Noah (Bilder/Videos), Anna (Einkauf), Emma (Follow-up-Mails), David (Berichte & Ziele), Clara (Kampagnen).
Regeln: Antworte auf Deutsch, per du, direkt und konkret wie ein Top-Berater. Keine Gedankenstriche (– oder —). Prozent ohne Leerzeichen ("+30%"). Hersteller oder Lieferanten nie nennen. Nichts erfinden: Zahlen nur aus den Daten unten, sonst sagen, dass die Zahl fehlt.`

export const PERSONA = {
  david: `Du bist David Lehmann, Senior E-Commerce-Analyst und Growth-Stratege mit 15 Jahren Erfahrung in DTC-Shops (Shopify, Meta Ads, CRO, Pricing, Retention). Du liest Zahlen wie ein CFO und denkst wie ein Gründer: Was bringt am meisten Umsatz mit dem wenigsten Aufwand? Du nennst Ursachen, priorisierst (Wirkung x Aufwand) und machst konkrete, umsetzbare Vorschläge mit Zahlenziel. Du bist zuständig für Wochen-, Monats- und Jahresberichte und die Ziele.`,
  clara: `Du bist Clara Vogel, Head of Campaigns mit 12 Jahren Erfahrung in Performance-Marketing und Saison-Kampagnen für Onlineshops (Black Friday, Weihnachten, Valentinstag, Muttertag, Vatertag, Ostern, Hochzeit, Geburtstag, Business-Kunden). Du planst Kampagnen von der Idee bis zur Umsetzung: Angebot und Mechanik (Rabatt, Bundle, Deadline, Gratis-Extra), Zeitplan, Ads (Hooks, Formate, Budget-Verteilung), Mails, Shop-Anpassungen, Lieferfristen (Bestellschluss für pünktliche Lieferung!). Du achtest auf Marge und schlägst clevere Alternativen zu plumpen Rabatten vor. Du bist zuständig für den Kampagnen-Kalender.`,
}

export async function claude({ system, messages, max = 1500, json }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY fehlt in Vercel')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    // Genug Platz lassen (das Modell denkt zuerst nach, das zählt mit)
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: json ? 8000 : Math.max(max, 4000), system, messages }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error('KI: ' + (j?.error?.message || r.status))
  let txt = (j.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('').trim()
  if (!txt) throw new Error('KI hat keine Antwort geschrieben' + (j.stop_reason === 'max_tokens' ? ' (zu lang)' : '') + ', bitte nochmal versuchen')
  if (!json) return txt
  txt = txt.replace(/```(json)?/g, '')
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}')
  try { return JSON.parse(txt.slice(a, b + 1)) }
  catch (e) { console.log('Strategie: JSON kaputt', j.stop_reason, txt.slice(0, 300)); throw new Error('KI-Antwort war unvollständig' + (j.stop_reason === 'max_tokens' ? ' (zu lang)' : '') + ', bitte nochmal versuchen') }
}

export async function context(db, extra = '') {
  const P = periods()
  const D0 = await loadData(db, P.year.prev[0] - 40 * D)
  const S = (r) => JSON.stringify(stats(D0, r))
  const { data: rows } = await db.from('strategie').select('type,title,content,data,created_at').in('type', ['goal', 'campaign']).order('created_at', { ascending: true })
  const goals = (rows || []).filter(r => r.type === 'goal').map(r => `- ${r.title} (${r.data?.month || ''})`).join('\n')
  const camps = (rows || []).filter(r => r.type === 'campaign').map(r => `- ${r.title}: ${r.data?.start || ''} bis ${r.data?.end || ''}, ${r.data?.offer || ''}, Status ${r.data?.status || 'idee'}, Schritte: ${(r.data?.steps || []).map(s => `${s.t}${s.done ? ' (erledigt)' : ''}`).join('; ')}`).join('\n')
  const wissen = (await knowledgeText().catch(() => '')).slice(0, 5000)
  return `${BASE}

Heute: ${fmt(Date.now())}
Kennzahlen (anfragen = Konfigurator-Anfragen seit Start der Erfassung, gemeldet = Kundenfragen per Mail + Chats, wartezeit = Std. bis Angebot, umsatz in Euro brutto):
${P.week.label}: ${S(P.week.cur)}
${P.week.prevLabel}: ${S(P.week.prev)}
${P.week.nowLabel}: ${S(P.week.now)}
${P.month.label}: ${S(P.month.cur)}
${P.month.prevLabel}: ${S(P.month.prev)}
${P.month.nowLabel}: ${S(P.month.now)}
${P.year.label}: ${S(P.year.cur)}
${P.year.prevLabel}: ${S(P.year.prev)}
Ziele:
${goals || '(noch keine)'}
Kampagnen:
${camps || '(noch keine)'}
${extra}
Wissen aus Phillips Unterlagen:
${wissen}`
}
