// Diese Datei heißt page.jsx und liegt in deinem app/angebot/[id]/ Ordner
// Die eigentliche Komponente (AngebotPage) wurde in angebot-client.jsx ausgelagert

import { createClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import AngebotPage from './angebot-client'
import Bestellstatus from './bestellstatus'
import { expireIfDue } from '../../../lib/discount'
import { getBW } from '../../../lib/blackweek'
import Abgelaufen from './abgelaufen'

export const revalidate = 0
export const maxDuration = 60

export async function generateMetadata() {
  return { title: 'Ihr persönliches Angebot – NeonFrame' }
}

async function getOffer(id) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
       (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
let { data } = await supabase.from('offers').select('*').eq('custom_id', id).single()
  if (!data) {
    const res = await supabase.from('offers').select('*').eq('id', id).single()
    data = res.data
  }
  // Extra-Rabatt abgelaufen? -> automatisch entfernen, bevor der Kunde das Angebot sieht
  return data ? await expireIfDue(supabase, data) : null
}

export default async function Page({ params }) {
  const raw = await getOffer(params.id)
  const offer = raw && (({ ek_net, paid_ek, ...rest }) => rest)(raw) // Einkaufspreis nie an den Kunden geben
  // Gelöscht oder nach Black Week deaktiviert -> Abgelaufen-Seite statt 404
  if (!offer) return <Abgelaufen />
  if (['confirmed', 'in_production', 'shipped', 'delivered'].includes(offer.status)) {
    if (offer.offer_num) redirect(`/status/${offer.offer_num}`)
    return <Bestellstatus offer={offer} />
  }
  if (!offer.published && offer.expired_at) return <Abgelaufen nr={offer.custom_id || offer.id} />
  let bwEnd = null
  if (offer.black_week) { try { bwEnd = (await getBW(createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)))).end } catch {} }
  return <AngebotPage offer={offer} bwEnd={bwEnd} />
}
