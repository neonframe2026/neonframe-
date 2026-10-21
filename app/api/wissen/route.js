import { wissenDb, extractDoc } from '../../../lib/wissen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

// Wissen (angemeldet)
// GET                                   -> Dokumente, Regeln, gelernte Beispiele
// POST { action:'upload', name }        -> Upload-Link für eine Datei
// POST { action:'doc', path, name, mime } -> Datei lesen lassen und als Wissen speichern
// POST { action:'rule', id?, title, content } -> Regel anlegen oder ändern
// DELETE ?id=...                        -> Eintrag löschen
const BUCKET = 'offer-images'
const fail = (e) => Response.json({ error: e.message }, { status: e.status || 500 })
async function user(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  const { data, error } = await wissenDb().auth.getUser(token)
  if (error || !data?.user) throw Object.assign(new Error('Nicht angemeldet'), { status: 401 })
  return data.user
}

export async function GET(req) {
  try {
    await user(req)
    const { data, error } = await wissenDb().from('wissen').select('*').order('created_at', { ascending: false })
    if (error) throw error
    const rows = data || []
    const v = (r) => ({ id: r.id, title: r.title, content: r.content, at: r.created_at, meta: r.meta || {} })
    return Response.json({
      docs: rows.filter(r => r.type === 'doc').map(v),
      rules: rows.filter(r => r.type === 'rule').map(v),
      examples: rows.filter(r => r.type === 'example').map(v),
    })
  } catch (e) { return fail(e) }
}

export async function POST(req) {
  try {
    await user(req)
    const b = await req.json()
    const db = wissenDb()
    if (b.action === 'upload') {
      const ext = (String(b.name || '').split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `wissen/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error) throw error
      return Response.json({ path, token: data.token })
    }
    if (b.action === 'doc') {
      if (!String(b.path || '').startsWith('wissen/')) return Response.json({ error: 'Ungültige Datei' }, { status: 400 })
      const url = db.storage.from(BUCKET).getPublicUrl(b.path).data.publicUrl
      let content
      try { content = await extractDoc({ url, name: b.name, mime: b.mime }) }
      finally { await db.storage.from(BUCKET).remove([b.path]).catch(() => {}) } // Datei danach wieder löschen
      if (!content) throw new Error('In der Datei wurde nichts Brauchbares gefunden')
      const { error } = await db.from('wissen').insert([{ type: 'doc', title: String(b.name || 'Dokument').slice(0, 200), content, meta: { source: 'upload', size: b.size || null } }])
      if (error) throw error
      return Response.json({ success: true })
    }
    if (b.action === 'rule') {
      const title = String(b.title || '').trim(), content = String(b.content || '').trim()
      if (!title || !content) return Response.json({ error: 'Bitte Thema und Antwort ausfüllen' }, { status: 400 })
      const q = b.id ? db.from('wissen').update({ title, content }).eq('id', b.id).eq('type', 'rule') : db.from('wissen').insert([{ type: 'rule', title, content }])
      const { error } = await q
      if (error) throw error
      return Response.json({ success: true })
    }
    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (e) { return fail(e) }
}

export async function DELETE(req) {
  try {
    await user(req)
    const id = new URL(req.url).searchParams.get('id')
    const { error } = await wissenDb().from('wissen').delete().eq('id', id)
    if (error) throw error
    return Response.json({ success: true })
  } catch (e) { return fail(e) }
}
