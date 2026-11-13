import { createClient } from '@supabase/supabase-js'
import { requireUser } from '../../../lib/api-auth'
import { claude, context } from '../../../lib/strategie'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Clara · Content-Planung: Posts für Instagram + Facebook planen und zum Termin posten.
// Tabelle content_posts (kind 'post' | 'idea'), Medien im Bucket offer-images unter content/.
// GET                          -> { posts, ideas, connected: { page, ig } }
// GET ?check=1                 -> Verbindung zu Seite + Instagram prüfen
// GET ?run=1&key=FOLLOWUP_KEY  -> Cron (alle 5 Min.): fällige Posts veröffentlichen
// POST { action:'upload', name }                         -> signierte Upload-URL
// POST { action:'caption', path, type, wish, caption }   -> Clara schreibt Caption + Hashtags
// POST { action:'save', id?, path, type, caption, nets, post_at, status }  (status 'entwurf' | 'geplant')
// POST { action:'delete', id }
// POST { action:'ideas' }  /  POST { action:'idea_del', id }
const V = 'v23.0'
const BUCKET = 'offer-images'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const fail = (m, s = 400) => Response.json({ error: m }, { status: s })

const CLARA = `Du bist Clara Vogel, Social-Media- und Content-Managerin für NeonFrame (individuelle LED-Neonschilder, nur Deutschland, Instagram @neonframe.de und Facebook). Du schreibst Captions, die sich echt und menschlich lesen: kurz, locker, per du, 1 bis 3 Sätze, 1 bis 2 passende Emojis, ein klarer Call-to-Action (z. B. "Jetzt gestalten, Link in der Bio"). Keine Gedankenstriche (– oder —). Prozent ohne Leerzeichen ("30%"). Keine erfundenen Fakten oder Zahlen. Nicht behaupten: "1.500 zufriedene Kunden", 5 Sterne, Halo/3D-Buchstaben. Danach 5 bis 8 passende deutsche und englische Hashtags in einer Zeile.`

// ---------- Meta ----------
async function g(path, params = {}, token = process.env.META_ADS_TOKEN) {
  const r = await fetch(`https://graph.facebook.com/${V}/${path}?` + new URLSearchParams({ ...params, access_token: token }), { cache: 'no-store' })
  const j = await r.json()
  if (j.error) throw new Error('Meta: ' + (j.error.error_user_msg || j.error.message))
  return j
}
async function p(path, body, token) {
  const r = await fetch(`https://graph.facebook.com/${V}/${path}`, { method: 'POST', body: new URLSearchParams({ ...body, access_token: token }), cache: 'no-store' })
  const j = await r.json()
  if (j.error) throw new Error('Meta: ' + (j.error.error_user_msg || j.error.message))
  return j
}
// Facebook-Seite (mit Seiten-Token) und verbundenes Instagram-Konto
async function accounts() {
  const j = await g('me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: 25 })
  const page = (j.data || []).find(x => /neon/i.test(x.name)) || (j.data || [])[0]
  if (!page) throw new Error('Keine Facebook-Seite gefunden. Hat der Systemnutzer Zugriff auf die Seite?')
  return { page: { id: page.id, name: page.name, token: page.access_token }, ig: page.instagram_business_account || null }
}

// Einen Post veröffentlichen (wird vom Cron aufgerufen, auch mehrfach bei Reels)
async function publish(sb, row, acc) {
  const upd = {}
  const nets = row.nets || []
  const isVid = row.media_type === 'video'
  // Facebook
  if (nets.includes('facebook') && !row.fb_id) {
    const r = isVid
      ? await p(`${acc.page.id}/videos`, { file_url: row.media_url, description: row.caption || '' }, acc.page.token)
      : await p(`${acc.page.id}/photos`, { url: row.media_url, message: row.caption || '' }, acc.page.token)
    upd.fb_id = r.post_id || r.id
  }
  // Instagram: erst Container anlegen, bei Videos warten bis fertig verarbeitet, dann veröffentlichen
  if (nets.includes('instagram') && !row.ig_id) {
    if (!acc.ig) throw new Error('Kein Instagram-Konto mit der Seite verbunden')
    let cid = row.ig_container
    if (!cid) {
      const r = await p(`${acc.ig.id}/media`, isVid ? { media_type: 'REELS', video_url: row.media_url, caption: row.caption || '', share_to_feed: 'true' } : { image_url: row.media_url, caption: row.caption || '' }, process.env.META_ADS_TOKEN)
      cid = r.id; upd.ig_container = cid
    }
    const st = await g(cid, { fields: 'status_code' })
    if (st.status_code === 'ERROR') throw new Error('Instagram konnte das Video nicht verarbeiten')
    if (st.status_code === 'FINISHED') upd.ig_id = (await p(`${acc.ig.id}/media_publish`, { creation_id: cid }, process.env.META_ADS_TOKEN)).id
  }
  const done = (!nets.includes('facebook') || row.fb_id || upd.fb_id) && (!nets.includes('instagram') || row.ig_id || upd.ig_id)
  if (done) { upd.status = 'gepostet'; upd.posted_at = new Date().toISOString(); upd.error = null }
  await sb.from('content_posts').update(upd).eq('id', row.id)
  return done
}

export async function GET(req) {
  const sp = new URL(req.url).searchParams
  const sb = db()
  if (sp.get('run')) {
    if (!process.env.FOLLOWUP_KEY || sp.get('key') !== process.env.FOLLOWUP_KEY) return fail('Falscher Schlüssel', 401)
    const { data: due } = await sb.from('content_posts').select('*').eq('kind', 'post').eq('status', 'geplant').lte('post_at', new Date().toISOString()).order('post_at').limit(5)
    if (!due?.length) return Response.json({ success: true, done: 0 })
    let acc
    try { acc = await accounts() } catch (e) { return fail(e.message, 500) }
    let n = 0
    for (const row of due) {
      try { if (await publish(sb, row, acc)) n++ }
      catch (e) { await sb.from('content_posts').update({ status: 'fehler', error: String(e.message).slice(0, 500) }).eq('id', row.id) }
    }
    return Response.json({ success: true, done: n })
  }
  const no = await requireUser(req); if (no) return no
  if (sp.get('check')) {
    try { const a = await accounts(); return Response.json({ page: a.page.name, ig: a.ig?.username || null }) }
    catch (e) { return fail(e.message, 502) }
  }
  const { data, error } = await sb.from('content_posts').select('*').order('post_at', { ascending: true, nullsFirst: false }).limit(500)
  if (error) return fail(error.message, 500)
  return Response.json({ posts: (data || []).filter(r => r.kind === 'post'), ideas: (data || []).filter(r => r.kind === 'idea') })
}

export async function POST(req) {
  const no = await requireUser(req); if (no) return no
  const sb = db()
  try {
    const b = await req.json()
    if (b.action === 'upload') {
      const ext = (String(b.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `content/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error) throw new Error(error.message)
      return Response.json({ path, token: data.token, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl })
    }
    if (b.action === 'caption') {
      const url = b.path ? sb.storage.from(BUCKET).getPublicUrl(b.path).data.publicUrl : ''
      const content = []
      if (url && b.type !== 'video') content.push({ type: 'image', source: { type: 'url', url } })
      content.push({ type: 'text', text: `Schreib eine Caption für diesen ${b.type === 'video' ? 'Reel (Video)' : 'Bild-Post'}.${b.type === 'video' && b.name ? ' Dateiname: ' + b.name + '.' : ''}${b.caption ? '\n\nBisherige Caption:\n' + b.caption : ''}${b.wish ? '\n\nWunsch von Phillip: ' + b.wish : ''}\n\nAntworte NUR mit dem fertigen Text (Caption, Leerzeile, Hashtags), ohne Erklärung.` })
      const out = await claude({ system: CLARA, messages: [{ role: 'user', content }], max: 1200 })
      return Response.json({ caption: out.trim() })
    }
    if (b.action === 'save') {
      if (!b.path) return fail('Bitte zuerst ein Bild oder Video hochladen')
      const nets = (b.nets || []).filter(n => ['instagram', 'facebook'].includes(n))
      if (!nets.length) return fail('Bitte Instagram und/oder Facebook auswählen')
      const status = b.status === 'geplant' ? 'geplant' : 'entwurf'
      const at = b.post_at ? new Date(b.post_at) : null
      if (status === 'geplant' && (!at || isNaN(at))) return fail('Bitte Datum und Uhrzeit wählen')
      if (status === 'geplant' && at < Date.now() - 60000) return fail('Der Termin liegt in der Vergangenheit')
      const row = { kind: 'post', status, media_path: b.path, media_url: sb.storage.from(BUCKET).getPublicUrl(b.path).data.publicUrl, media_type: b.type === 'video' ? 'video' : 'image', caption: String(b.caption || '').slice(0, 2200), nets, post_at: at ? at.toISOString() : null, error: null }
      const q = b.id ? sb.from('content_posts').update(row).eq('id', b.id).neq('status', 'gepostet') : sb.from('content_posts').insert([row])
      const { error } = await q
      if (error) throw new Error(error.message)
      return Response.json({ success: true })
    }
    if (b.action === 'delete' || b.action === 'idea_del') {
      const { data: r } = await sb.from('content_posts').select('id,media_path,status').eq('id', b.id).maybeSingle()
      if (!r) return fail('Nicht gefunden', 404)
      await sb.from('content_posts').delete().eq('id', r.id)
      if (r.media_path && r.status !== 'gepostet') sb.storage.from(BUCKET).remove([r.media_path]).catch(() => {})
      return Response.json({ success: true })
    }
    if (b.action === 'ideas') {
      const { data: last } = await sb.from('content_posts').select('caption,title,post_at,kind').order('created_at', { ascending: false }).limit(20)
      const out = await claude({
        system: CLARA + '\n\n' + await context(sb),
        messages: [{ role: 'user', content: `Gib mir 4 neue, konkrete Content-Ideen für Instagram und Facebook für die nächsten 2 Wochen (Bilder oder Reels), passend zur Saison und zu den Zahlen. Nicht wiederholen, was schon geplant oder als Idee da ist:\n${(last || []).map(r => '- ' + (r.title || r.caption || '').slice(0, 80)).join('\n') || '(nichts)'}\n\nAntworte NUR mit JSON: {"ideas":[{"title":"max 5 Wörter","text":"1 Satz: was zeigen und warum"}]}` }],
        json: true,
      })
      const rows = (out.ideas || []).slice(0, 4).map(i => ({ kind: 'idea', status: 'idee', title: String(i.title || '').slice(0, 80), caption: String(i.text || '').slice(0, 300) }))
      await sb.from('content_posts').delete().eq('kind', 'idea')
      if (rows.length) await sb.from('content_posts').insert(rows)
      return Response.json({ success: true })
    }
    return fail('Unbekannte Aktion')
  } catch (e) { return fail(e.message, 500) }
}
