// Bestellstatus-Link für Kunden: angebote.neonframe.de/status/2631
import { createClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import Bestellstatus from '../../angebot/[id]/bestellstatus'

export const revalidate = 0
export const metadata = { title: 'Dein Bestellstatus · NeonFrame' }

export default async function Page({ params }) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const r1 = await supabase.from('offers').select('*').eq('custom_id', params.id).single()
  let offer = r1.data
  if (!offer) offer = (await supabase.from('offers').select('*').eq('id', params.id).single()).data
  if (!offer) return <pre style={{ padding: 20 }}>Status-Seite: nicht gefunden ({String(params.id)}) {r1.error?.message || ''}</pre>
  // Noch nicht bestellt -> normales Angebot zeigen
  if (!['confirmed', 'in_production', 'shipped', 'delivered'].includes(offer.status)) redirect(`/angebot/${params.id}`)
  return <Bestellstatus offer={offer} />
}
