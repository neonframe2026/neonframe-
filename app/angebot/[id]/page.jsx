// Diese Datei heißt page.jsx und liegt in deinem app/angebot/[id]/ Ordner
// Die eigentliche Komponente (AngebotPage) wurde in angebot-client.jsx ausgelagert

import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import AngebotPage from './angebot-client'

export const revalidate = 0

export async function generateMetadata() {
  return { title: 'Ihr persönliches Angebot – NeonFrame' }
}

async function getOffer(id) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  let { data } = await supabase.from('offers').select('*').eq('custom_id', id).eq('published', true).single()
  if (!data) {
    const res = await supabase.from('offers').select('*').eq('id', id).eq('published', true).single()
    data = res.data
  }
  return data || null
}

export default async function Page({ params }) {
  const offer = await getOffer(params.id)
  if (!offer) notFound()
  return <AngebotPage offer={offer} />
}
