import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const { id, reason, comment } = await req.json()
    if (!id || !reason) {
      return Response.json({ error: 'Angaben fehlen' }, { status: 400 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { error } = await supabase
      .from('offers')
      .update({
        unsubscribed: true,
        unsubscribe_reason: String(reason).slice(0, 100),
        unsubscribe_comment: comment ? String(comment).slice(0, 1000) : null,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
