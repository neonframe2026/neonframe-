import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Push-Nachrichten aufs Handy (Zentrale-App)
// Braucht in Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY
export const pushDb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

export async function sendPush({ title, body, url = '/admin', tag }) {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { sent: 0, info: 'Push nicht eingerichtet' }
  webpush.setVapidDetails('mailto:info@neonframe.de', pub, priv)
  const { data: subs } = await pushDb().from('push_subs').select('*')
  let sent = 0
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(s.sub, JSON.stringify({ title, body, url, tag }), { TTL: 86400 })
      sent++
    } catch (e) {
      // Gerät abgemeldet oder App gelöscht -> Eintrag entfernen
      if (e.statusCode === 404 || e.statusCode === 410) await pushDb().from('push_subs').delete().eq('id', s.id)
    }
  }
  return { sent }
}
