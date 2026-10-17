'use client'
import { useState, useEffect } from 'react'

// Änderung von TNC: Vorher/Nachher, Werte selbst anpassen, Checkout-Bild zuschneiden, mit einem Klick übernehmen
export default function TncUpdatePage2({ id, onBack, CheckoutImageField, uploadCheckoutImage }) {
  const [d, setD] = useState(null)
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [notify, setNotify] = useState(true)
  const [checkoutImg, setCheckoutImg] = useState(null)

  useEffect(() => {
    fetch('/api/tnc-update?id=' + encodeURIComponent(id)).then(r => r.json()).then(j => {
      if (j.error) return setErr(j.error)
      setD(j)
      setF({
        width: String(j.after.width), height: String(j.after.height),
        final: String(j.after.final).replace('.', ','),
        colors: j.after.colors || '', backplate: j.after.backplate || '', usage: j.after.usage || '',
      })
    }).catch(e => setErr(e.message))
  }, [id])

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const eur = (n) => (parseFloat(String(n).replace(',', '.')) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const newImg = d ? (d.after.realistic_image || d.after.design_image) : ''
  const cropSrc = newImg ? '/api/tnc-image?url=' + encodeURIComponent(newImg) : null

  async function apply() {
    setBusy(true); setErr('')
    try {
      let checkout_image = null
      if (checkoutImg) {
        checkout_image = await uploadCheckoutImage(checkoutImg, d.before.id)
        if (!checkout_image) throw new Error('Checkout-Bild konnte nicht hochgeladen werden')
      }
      const j = await (await fetch('/api/tnc-update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notify, edit: { ...f, checkout_image } }),
      })).json()
      if (j.error) throw new Error(j.error)
      setDone(j)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const box = { background: 'var(--card, #14161c)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }
  const inp = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input-bg, transparent)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }
  const grid = { display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) minmax(0,1fr)', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }
  const row = (label, before, nextVal, input) => {
    const ch = String(before ?? '') !== String(nextVal ?? '')
    return (
      <div style={grid}>
        <span style={{ color: 'var(--text-faint)' }}>{label}</span>
        <span style={{ color: ch ? 'var(--text-faint)' : 'var(--text)', textDecoration: ch ? 'line-through' : 'none' }}>{before || '–'}</span>
        <div style={{ outline: ch ? '1px solid #22c55e66' : 'none', borderRadius: 8 }}>{input}</div>
      </div>
    )
  }
  const btn = { padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none' }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div onClick={onBack} style={{ cursor: 'pointer', color: 'var(--text-faint)', fontSize: 13 }}>← Zur Startseite</div>
      <h1 style={{ margin: 0, fontSize: 28 }}>🔄 Angebot geändert</h1>
      {err && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#ef44441a', border: '1px solid #ef444455', color: '#ef4444', fontSize: 13 }}>{err}</div>}
      {!d && !err && <div style={{ color: 'var(--text-faint)' }}>Neue Daten werden von TNC geladen... (ca. 10 Sek.)</div>}
      {d && f && (
        <>
          <div style={{ fontSize: 14, color: 'var(--text-faint)' }}>TNC-Angebot <b style={{ color: 'var(--text)' }}>{id}</b> · {d.before.project || 'ohne Projekt'} · {d.before.customer_email || 'keine E-Mail'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <div style={box}>
              <b>Vorher</b>
              {d.before.images[0] && <img src={d.before.images[0]} alt="" style={{ width: '100%', borderRadius: 10 }} />}
            </div>
            <div style={{ ...box, borderColor: '#22c55e66' }}>
              <b style={{ color: '#22c55e' }}>Nachher</b>
              {newImg && <img src={newImg} alt="" style={{ width: '100%', borderRadius: 10 }} />}
            </div>
          </div>

          <CheckoutImageField src={checkoutImg} onChange={setCheckoutImg} inputId="update-checkout-img" dark cropSrc={cropSrc} />

          <div style={box}>
            <div style={{ ...grid, fontSize: 12, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}><span></span><span>Vorher</span><span>Nachher (änderbar)</span></div>
            {row('Breite (cm)', d.before.width, f.width, <input style={inp} value={f.width} onChange={e => set('width', e.target.value)} inputMode="numeric" />)}
            {row('Höhe (cm)', d.before.height, f.height, <input style={inp} value={f.height} onChange={e => set('height', e.target.value)} inputMode="numeric" />)}
            {row('Endpreis (€)', eur(d.before.final), eur(f.final), <input style={inp} value={f.final} onChange={e => set('final', e.target.value)} inputMode="decimal" />)}
            {row('Farbe', d.before.colors, f.colors, <input style={inp} value={f.colors} onChange={e => set('colors', e.target.value)} />)}
            {row('Rückwand', d.before.backplate, f.backplate,
              <select style={inp} value={f.backplate} onChange={e => set('backplate', e.target.value)}>{['Ausgeschnitten', 'Quadratisch', 'Ohne'].map(o => <option key={o}>{o}</option>)}</select>)}
            {row('Verwendung', d.before.usage, f.usage,
              <select style={inp} value={f.usage} onChange={e => set('usage', e.target.value)}>{['Innen', 'Außen IP65'].map(o => <option key={o}>{o}</option>)}</select>)}
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Die Größentabelle kommt von TNC. Bild 3 (Lieferumfang) bleibt. Ohne eigenes Checkout-Bild nimmt Shopify das neue Design.</div>
          </div>

          {done ? (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#22c55e1a', border: '1px solid #22c55e55', color: '#22c55e', fontSize: 14, lineHeight: 1.6 }}>
              ✓ Angebot aktualisiert{done.mailSent ? ' und Kunde per Mail informiert' : ''}.<br />
              {done.shopifyError && <span style={{ color: '#f59e0b' }}>Shopify: {done.shopifyError}<br /></span>}
              <a href={`/angebot/${done.offerId}`} target="_blank" rel="noreferrer" style={{ color: '#22c55e' }}>Angebotsseite ansehen</a>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={apply} disabled={busy} style={{ ...btn, background: '#60c8f0', color: '#04101f', opacity: busy ? .6 : 1 }}>{busy ? 'Wird übernommen...' : 'Übernehmen'}</button>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} disabled={!d.before.customer_email} />
                Kunde per Mail informieren
              </label>
              <button onClick={onBack} style={{ ...btn, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}>Abbrechen</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
