export const dynamic = 'force-dynamic'

// Lädt ein Bild von TNC (tnc-app.dev) über den Server, damit der Browser es übernehmen darf
// Aufruf: /api/tnc-image?url=https://tnc-app.dev/...
export async function GET(req) {
  const url = new URL(req.url).searchParams.get('url') || ''
  let host = ''
  try { host = new URL(url).hostname } catch {}
  if (host !== 'tnc-app.dev') return new Response('Nur Bilder von tnc-app.dev erlaubt', { status: 400 })
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return new Response('Bild nicht gefunden', { status: 404 })
  return new Response(res.body, { headers: { 'Content-Type': res.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'no-store' } })
}
