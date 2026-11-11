// Preis-Einstellungen
// Aufschlag auf den empf. VK von TNC. Alte Angebote ohne gespeicherten Wert = 10 %.
export const DEFAULT_MARKUP = 10

export function markupFactor(offer) {
  const m = offer && offer.markup != null && offer.markup !== '' ? parseFloat(offer.markup) : DEFAULT_MARKUP
  return 1 + (isNaN(m) ? DEFAULT_MARKUP : m) / 100
}

export async function getSetting(supabase, key, fallback = null) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle()
  return data?.value ?? fallback
}

// Aktueller Aufschlag für NEUE Angebote (aus den Einstellungen)
export async function currentMarkup(supabase) {
  const p = await getSetting(supabase, 'pricing', {})
  const m = parseFloat(p?.markup)
  return isNaN(m) ? DEFAULT_MARKUP : m
}
