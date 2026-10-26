// Bestellstatus-Link für Kunden: angebote.neonframe.de/status/13287430172 (TNC-Nummer)
import { createClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import Bestellstatus from '../../angebot/[id]/bestellstatus'

export const revalidate = 0
export const metadata = { title: 'Dein Bestellstatus · NeonFrame' }

export default async function Page({ params }) {
  const id = String(params.id || '').trim()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const find = async (col) => (await supabase.from('offers').select('*').eq(col, id).order('created_at', { ascending: false }).limit(1)).data?.[0] || null
  const offer = await find('offer_num')
  if (!offer) notFound()
  // Noch nicht bestellt -> normales Angebot zeigen
  if (!['confirmed', 'in_production', 'shipped', 'delivered'].includes(offer.status)) redirect(`/angebot/${offer.custom_id || offer.id}`)
  return <Bestellstatus offer={offer} />
}
