import { sendPush, pushDb } from './push'

// System-Warnungen: Glocke in der Zentrale + Push aufs Handy
// Gespeichert in settings (key 'alerts'), max. 30 Stück
async function read(sb) {
  const { data } = await sb.from('settings').select('value').eq('key', 'alerts').maybeSingle()
  return Array.isArray(data?.value) ? data.value : []
}
async function write(sb, list) {
  await sb.from('settings').upsert({ key: 'alerts', value: list.slice(0, 30), updated_at: new Date().toISOString() })
}

export async function addAlert({ kind = 'info', title, body }) {
  try {
    const sb = pushDb()
    const list = await read(sb)
    list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind, title, body, at: new Date().toISOString() })
    await write(sb, list)
  } catch (e) { console.error('alert', e) }
  await sendPush({ title, body, tag: kind + '-' + Date.now() }).catch(() => {})
}

export async function getAlerts() {
  try { return await read(pushDb()) } catch { return [] }
}

export async function dismissAlert(id) {
  const sb = pushDb()
  await write(sb, (await read(sb)).filter(a => a.id !== id))
}
