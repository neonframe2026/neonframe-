import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }) {
  return { title: 'Ihr persönliches Angebot – NeonFrame' }
}

async function getOffer(id) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  // Try custom_id first, then UUID
  let { data } = await supabase.from('offers').select('*').eq('custom_id', id).eq('published', true).single()
  if (!data) {
    const res = await supabase.from('offers').select('*').eq('id', id).eq('published', true).single()
    data = res.data
  }
  return data || null
}

function colorDot(s = '') {
  const c = s.toLowerCase()
  if (c.includes('ice blue') || c.includes('blue') || c.includes('blau')) return '#60c8f0'
  if (c.includes('warm white') || c.includes('warm')) return '#fef3c7'
  if (c.includes('white') || c.includes('weiß')) return '#f3f4f6'
  if (c.includes('red') || c.includes('rot')) return '#ef4444'
  if (c.includes('green') || c.includes('grün')) return '#22c55e'
  if (c.includes('pink')) return '#ec4899'
  if (c.includes('purple') || c.includes('lila')) return '#a855f7'
  if (c.includes('yellow') || c.includes('gelb')) return '#f59e0b'
  if (c.includes('soft orange') || c.includes('orange')) return '#fb923c'
  return '#9ca3af'
}

// Split comma-separated colors into individual pills
function parseColors(colorStr = '') {
  return colorStr.split(',').map(c => c.trim()).filter(Boolean)
}

export default async function AngebotPage({ params }) {
  const offer = await getOffer(params.id)
  if (!offer) notFound()

  const netAfterDisc = parseFloat(offer.net_price) || 0
  const vatPct = parseFloat(offer.vat_pct) || 19
  const finalPrice = parseFloat(offer.final_price) || 0
  const rrp = parseFloat(offer.rrp_price) || 0
  const basePrice = parseFloat(offer.base_price) || 0
  const discType = offer.disc_type || 'pct'
  const discVal = parseFloat(offer.disc_val) || 0
  const vatAmt = finalPrice - netAfterDisc
  const discDisplay = discType === 'pct' ? `${discVal}%` : `€ ${discVal.toFixed(2)}`
  const discAmt = discType === 'pct' ? basePrice * (discVal / 100) : discVal
  const img = offer.preview_image
  const colors = parseColors(offer.colors)
  const displayId = offer.custom_id || offer.offer_num || offer.id?.slice(0,8)

  return (
    <>
      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        html { font-size: 16px; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
          color: #111827;
          background: #fff;
          -webkit-font-smoothing: antialiased;
        }

        /* HEADER */
        .hdr {
          background: #fff;
          border-bottom: 1px solid #e5e7eb;
          padding: 0 40px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .hdr-logo img { height: 40px; display: block; }
        .hdr-badge {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
          font-size: 13px;
          font-weight: 600;
          padding: 7px 16px;
          border-radius: 20px;
        }

        /* LAYOUT */
        .page-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 48px 40px 80px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: start;
        }
        @media(max-width:900px){
          .page-wrap { grid-template-columns:1fr; gap:32px; padding:24px 20px 60px; }
          .hdr { padding: 0 20px; }
        }

        /* LEFT COL */
        .left-col { position: sticky; top: 88px; }

        .img-box {
          border-radius: 16px;
          overflow: hidden;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          aspect-ratio: 4/3;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .img-box img { width:100%; height:100%; object-fit:cover; display:block; }
        .img-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: #9ca3af;
        }
        .img-placeholder svg { width:56px; height:56px; }
        .img-placeholder span { font-size: 14px; }

        .contact-card {
          margin-top: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 22px 24px;
          background: #fff;
        }
        .contact-title {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 6px;
        }
        .contact-sub {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .contact-textarea {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 14px;
          color: #111827;
          background: #f9fafb;
          resize: vertical;
          min-height: 90px;
          font-family: inherit;
          outline: none;
          transition: border-color .15s;
          display: block;
          margin-bottom: 12px;
        }
        .contact-textarea:focus { border-color: #374151; background: #fff; }
        .contact-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #111827;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 12px 22px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background .15s;
          text-decoration: none;
        }
        .contact-btn:hover { background: #1f2937; }
        .contact-btn svg { width:16px; height:16px; flex-shrink:0; }

        /* RIGHT COL */
        .prod-title {
          font-size: 28px;
          font-weight: 800;
          line-height: 1.2;
          color: #111827;
          margin-bottom: 28px;
          letter-spacing: -.02em;
        }

        /* Config section */
        .cfg-section { margin-bottom: 22px; }
        .cfg-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: #9ca3af;
          display: block;
          margin-bottom: 8px;
        }
        .cfg-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .cfg-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1.5px solid #d1d5db;
          border-radius: 30px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          color: #111827;
          background: #fff;
        }
        .color-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 1.5px solid rgba(0,0,0,.12);
          display: inline-block;
          flex-shrink: 0;
        }
        .cfg-all-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 28px;
        }

        /* Checklist */
        .checks { margin-bottom: 28px; display: flex; flex-direction: column; gap: 10px; }
        .check-row { display: flex; align-items: flex-start; gap: 10px; font-size: 15px; color: #374151; line-height: 1.5; }
        .check-icon { width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px; color: #16a34a; }

        /* Tooltip */
        .tt { position: relative; display: inline; }
        .tt-t { border-bottom: 1.5px dashed #9ca3af; cursor: default; }
        .tt-box {
          display: none;
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: #1f2937;
          color: #f9fafb;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 10px;
          white-space: nowrap;
          z-index: 50;
          pointer-events: none;
          line-height: 1.6;
          box-shadow: 0 4px 16px rgba(0,0,0,.2);
        }
        .tt-box::after {
          content:'';
          position:absolute;
          top:100%; left:50%;
          transform:translateX(-50%);
          border:6px solid transparent;
          border-top-color:#1f2937;
        }
        .tt:hover .tt-box { display:block; }

        /* PRICE */
        .price-section {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 24px;
          margin-bottom: 20px;
          background: #fff;
        }
        .price-table { width:100%; border-collapse:collapse; }
        .price-table td { padding: 6px 0; font-size: 15px; vertical-align: middle; }
        .price-table td:last-child { text-align:right; font-weight:500; }
        .price-muted td { color: #9ca3af; }
        .price-disc td { color: #16a34a; font-weight: 600; }
        .price-divider td { border-top: 1px solid #e5e7eb; padding-top: 14px; }
        .price-total td:first-child { font-size: 15px; font-weight: 700; color: #374151; padding-top: 6px; }
        .price-total td:last-child { font-size: 32px; font-weight: 800; color: #111827; padding-top: 6px; letter-spacing: -.02em; }
        .price-note { font-size: 13px; color: #9ca3af; margin-top: 10px; }
        .price-rrp { font-size: 13px; color: #9ca3af; margin-top: 4px; }
        .price-rrp s { color: #d1d5db; }

        /* SHIPPING */
        .ship-box {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 8px;
        }
        .ship-icon { width:22px; height:22px; flex-shrink:0; margin-top:2px; color:#16a34a; }
        .ship-text strong { display:block; font-size:15px; font-weight:700; color:#166534; margin-bottom:3px; }
        .ship-text span { font-size:14px; color:#166534; display:block; }
        .express-row {
          display:flex; align-items:center; gap:8px;
          font-size:14px; color:#6b7280;
          margin-bottom:22px; margin-top:8px;
        }
        .express-icon { width:16px; height:16px; color:#f59e0b; }

        /* CTA */
        .cta-btn {
          width: 100%;
          background: #16a34a;
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 18px;
          font-size: 17px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 14px;
          font-family: inherit;
          letter-spacing: .01em;
          transition: background .15s, transform .1s;
          text-decoration: none;
        }
        .cta-btn:hover { background: #15803d; transform: translateY(-1px); }
        .cta-btn svg { width:20px; height:20px; }

        /* PAYMENTS */
        .payments {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
          padding: 14px;
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          margin-bottom: 10px;
        }
        .pay-icon {
          height: 24px;
          width: auto;
          object-fit: contain;
          filter: grayscale(15%);
          opacity: .85;
        }

        /* FEATURES */
        .features { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:24px; }
        .feat {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: #fff;
          transition: border-color .15s;
        }
        .feat:hover { border-color: #9ca3af; }
        .feat-icon-wrap {
          width: 38px; height: 38px;
          background: #f3f4f6;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .feat-icon-wrap svg { width:20px; height:20px; color:#374151; }
        .feat-title { display:block; font-size:14px; font-weight:700; color:#111827; margin-bottom:3px; }
        .feat-sub { font-size:13px; color:#6b7280; line-height:1.4; }

        /* DESCRIPTION */
        .desc-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 40px 100px;
        }
        @media(max-width:900px){ .desc-section { padding: 0 20px 60px; } }
        .desc-inner {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          overflow: hidden;
        }
        .desc-header {
          padding: 28px 32px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }
        .desc-header h2 { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 10px; }
        .desc-header p { font-size: 15px; color: #4b5563; line-height: 1.7; }
        .desc-body { max-height:0; overflow:hidden; transition:max-height .4s ease; padding:0 32px; }
        .desc-body.open { max-height:4000px; }
        .desc-body-inner { padding: 28px 0; }
        .desc-body-inner h3 { font-size:15px; font-weight:700; color:#111827; margin:24px 0 8px; text-decoration:underline; text-underline-offset:3px; }
        .desc-body-inner h3:first-child { margin-top:0; }
        .desc-body-inner p { font-size:15px; color:#374151; line-height:1.75; margin-bottom:10px; }
        .desc-body-inner ul { padding-left:20px; margin-bottom:12px; }
        .desc-body-inner li { font-size:15px; color:#374151; line-height:1.8; }
        .desc-body-inner strong { font-weight:700; }
        .desc-toggle {
          width:100%;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          padding:18px;
          background:#fff;
          border:none;
          border-top:1px solid #e5e7eb;
          font-size:15px;
          font-weight:600;
          color:#374151;
          cursor:pointer;
          font-family:inherit;
          transition:background .15s;
        }
        .desc-toggle:hover { background:#f9fafb; }
        .desc-toggle svg { width:16px; height:16px; transition:transform .3s; }
        .desc-toggle.open svg { transform: rotate(180deg); }
      `}</style>

      <script dangerouslySetInnerHTML={{__html:`
        function toggleDesc() {
          var b = document.getElementById('desc-body');
          var t = document.getElementById('desc-toggle');
          var isOpen = b.classList.toggle('open');
          t.classList.toggle('open', isOpen);
          t.querySelector('span').textContent = isOpen ? 'Weniger anzeigen' : 'Mehr anzeigen';
        }
        function sendEmail() {
          var msg = document.getElementById('contact-msg').value;
          var subj = encodeURIComponent('Frage zu Angebot #${displayId}');
          var body = encodeURIComponent(msg);
          window.location.href = 'mailto:info@neonframe.de?subject=' + subj + '&body=' + body;
        }
      `}} />

      {/* HEADER */}
      <header className="hdr">
        <a href="https://neonframe.de">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735"
            alt="NeonFrame"
            style={{height:40,display:'block',filter:'invert(1)'}}
          />
        </a>
        {displayId && <div className="hdr-badge">Angebot #{displayId}</div>}
      </header>

      {/* PRODUCT */}
      <div className="page-wrap">

        {/* LEFT */}
        <div className="left-col">
          <div className="img-box">
            {img
              ? <img src={img} alt="Neon Sign" />
              : <div className="img-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg>
                  <span>Vorschau-Bild</span>
                </div>}
          </div>

          {/* CONTACT CARD – sticky under image */}
          <div className="contact-card">
            <div className="contact-title">Fragen oder Anpassungswünsche?</div>
            <div className="contact-sub">Teilen Sie uns diese direkt hier mit – wir melden uns schnellstmöglich.</div>
            <textarea
              id="contact-msg"
              className="contact-textarea"
              placeholder="z.B. Kann die Farbe noch angepasst werden? Ich benötige Expressversand..."
              rows={3}
            />
            <button className="contact-btn" onClick="sendEmail()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
              Per E-Mail senden
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <h1 className="prod-title">Individuelles LED-Neon-Schild –<br/>personalisiert nach Wunsch</h1>

          {/* SIZE */}
          {(offer.width || offer.height) && (
            <div className="cfg-section">
              <span className="cfg-label">Größe (Breite × Höhe)</span>
              <div className="cfg-pill" style={{display:'inline-flex'}}>
                {offer.width && offer.height ? `${offer.width} × ${offer.height} cm` : offer.width ? `${offer.width} cm` : `${offer.height} cm`}
              </div>
            </div>
          )}

          {/* FARBE / RÜCKWAND / MODELL in einer Reihe */}
          <div className="cfg-all-row">
            {colors.map((c, i) => (
              <div key={i} style={{display:'flex',flexDirection:'column',gap:6}}>
                {i === 0 && <span className="cfg-label">Farbe</span>}
                {i > 0 && <span className="cfg-label" style={{opacity:0}}>-</span>}
                <div className="cfg-pill">
                  <span className="color-dot" style={{background: colorDot(c)}} />
                  {c}
                </div>
              </div>
            ))}
            {offer.backplate && (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <span className="cfg-label">Rückwand</span>
                <div className="cfg-pill">{offer.backplate}</div>
              </div>
            )}
            {offer.usage && (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <span className="cfg-label">Modell</span>
                <div className="cfg-pill">{offer.usage.replace(/innen farbe\(n\).*$/i,'').trim() || offer.usage}</div>
              </div>
            )}
          </div>

          {/* CHECKLIST */}
          <div className="checks">
            <div className="check-row">
              <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              <span>Einfach zu installieren mit dem mitgelieferten{' '}
                <span className="tt">
                  <span className="tt-t">Montagematerial</span>
                  <span className="tt-box">Inklusive Schrauben, Dübel und Abstandhalter.<br/>(Aufhängkabel auf Anfrage)</span>
                </span>
              </span>
            </div>
            <div className="check-row">
              <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              <span>Inklusive Fernbedienung, 3 Meter Stromkabel, Adapter und Dimmer</span>
            </div>
            <div className="check-row">
              <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              <span>Seit über 10 Jahren die höchste Qualität Neon Signs in Europa</span>
            </div>
          </div>

          {/* PRICE */}
          <div className="price-section">
            <table className="price-table">
              <tbody>
                {basePrice > 0 && (
                  <tr className="price-muted">
                    <td>Listenpreis (netto)</td>
                    <td>€ {basePrice.toFixed(2)}</td>
                  </tr>
                )}
                {discAmt > 0 && (
                  <tr className="price-disc">
                    <td>− Rabatt ({discDisplay})</td>
                    <td>− € {discAmt.toFixed(2)}</td>
                  </tr>
                )}
                {netAfterDisc > 0 && (
                  <tr>
                    <td style={{paddingTop:10}}>Netto-Preis nach Rabatt</td>
                    <td style={{paddingTop:10}}>€ {netAfterDisc.toFixed(2)}</td>
                  </tr>
                )}
                {vatAmt > 0 && (
                  <tr className="price-muted">
                    <td>+ MwSt. ({vatPct}%)</td>
                    <td>+ € {vatAmt.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="price-divider"><td colSpan={2}></td></tr>
                <tr className="price-total">
                  <td>Gesamtbetrag</td>
                  <td>{finalPrice > 0 ? `€ ${finalPrice.toFixed(2)}` : '–'}</td>
                </tr>
              </tbody>
            </table>
            <div className="price-note">Inkl. MwSt. · Kostenloser Versand nach Deutschland</div>
            {rrp > 0 && <div className="price-rrp">Empfohlener Verkaufspreis: <s>€ {rrp.toFixed(2)}</s></div>}
          </div>

          {/* SHIPPING */}
          <div className="ship-box">
            <svg className="ship-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>
            <div className="ship-text">
              <strong>Kostenloser Versand</strong>
              <span>Lieferzeit 2–3 Wochen</span>
            </div>
          </div>
          <div className="express-row">
            <svg className="express-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span className="tt">
              <span className="tt-t">Expressversand anfordern</span>
              <span className="tt-box">Expressversand: ca. 7–10 Werktage.<br/>Bitte im Anpassungsfeld unten anfordern.</span>
            </span>
          </div>

          {/* CTA */}
          <a href={offer.checkout_url || '#'} className="cta-btn" target={offer.checkout_url ? '_blank' : undefined} rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Angebot annehmen
          </a>

          {/* PAYMENTS */}
          <div className="payments">
            <img className="pay-icon" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/124px-PayPal.svg.png" alt="PayPal" />
            <img className="pay-icon" src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/120px-Visa_Inc._logo.svg.png" alt="Visa" />
            <img className="pay-icon" src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/120px-Mastercard-logo.svg.png" alt="Mastercard" />
            <img className="pay-icon" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Klarna_Payment_Badge.svg/120px-Klarna_Payment_Badge.svg.png" alt="Klarna" style={{height:18}} />
            <img className="pay-icon" src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Apple_logo_black.svg/60px-Apple_logo_black.svg.png" alt="Apple Pay" style={{height:20}} />
            <img className="pay-icon" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Pay_Logo_%282020%29.svg/120px-Google_Pay_Logo_%282020%29.svg.png" alt="Google Pay" />
            <img className="pay-icon" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/SEPA_Logo.svg/120px-SEPA_Logo.svg.png" alt="SEPA" />
          </div>

          {/* FEATURES */}
          <div className="features">
            {[
              [<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>, '2 Jahre Garantie', 'Auf alle Innen-Neon-Schilder'],
              [<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>, 'Komplettpaket', 'Alles für sofortige Montage'],
              [<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>, 'Einfache Installation', 'In wenigen Minuten fertig'],
              [<><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>, '100.000 Std. Lebensdauer', 'Langlebige PowerLEDs™'],
            ].map(([pathEl, title, sub], i) => (
              <div key={i} className="feat">
                <div className="feat-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{pathEl}</svg>
                </div>
                <div>
                  <span className="feat-title">{title}</span>
                  <span className="feat-sub">{sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="desc-section">
        <div className="desc-inner">
          <div className="desc-header">
            <h2>Produktbeschreibung</h2>
            <p>Unsere maßgeschneiderten Neon-Schilder werden vollständig individuell mit hochwertiger PowerLEDs™ Beleuchtung produziert. Jedes Schild wird speziell für Sie entworfen – ganz nach Ihren Wünschen auf Basis Ihres Textes, Logos oder Designs angefertigt.</p>
          </div>
          <div className="desc-body" id="desc-body">
            <div className="desc-body-inner">
              <h3>Premium-Beleuchtung</h3>
              <p>Die LED-Neon-Röhren sorgen für ein gleichmäßiges, helles Leuchten ohne Flackern oder sichtbare Lichtpunkte. Dank unserer patentierten PowerLEDs™ Technologie ist das Neon-Schild energieeffizient, langlebig und sicher im Gebrauch.</p>
              <h3>Rückplatte &amp; Finish</h3>
              <p>Das Neon-Schild wird auf einer stabilen Acryl-Rückplatte montiert, die präzise lasergeschnitten ist. Je nach Design wählen Sie zwischen:</p>
              <ul>
                <li><strong>Ausgeschnittene Rückplatte:</strong> Folgt exakt der Form Ihres Designs – minimalistisch und modern.</li>
                <li><strong>Quadratische Rückplatte:</strong> Rahmt das gesamte Design für einen klassischen Look.</li>
                <li><strong>Ohne Rückplatte:</strong> Vollständig schwebender Effekt, eng um die Neon-Röhre geschnitten.</li>
              </ul>
              <p>Standardmäßig transparent – auf Wunsch in jeder Farbe erhältlich.</p>
              <h3>Farben</h3>
              <p>Wählen Sie aus einer Vielzahl von Farben oder entscheiden Sie sich für die <strong>Full Color Option (+15%)</strong> – alle Farben, dynamisch anpassbar per Fernbedienung.</p>
              <h3>UV-Druck</h3>
              <p>Mit UV-Druck drucken wir Ihr Design haarscharf direkt auf die Acryl-Rückplatte – auch Details, die nicht in Neon gefertigt werden können, bleiben klar sichtbar.</p>
              <h3>Verwendung</h3>
              <ul>
                <li><strong>Innen</strong> – für alle Innenräume geeignet</li>
                <li><strong>Außen</strong> – IP65 wasserdicht und UV-beständig</li>
              </ul>
              <h3>Fernbedienung</h3>
              <p>Jedes Neon-Schild wird mit einer Fernbedienung geliefert: dimmen, ein-/ausschalten und verschiedene Effekte wählen. Bei der Full Color Option zusätzlich Farbwechsel per Fernbedienung.</p>
              <h3>Garantie</h3>
              <p>2 Jahre Garantie auf Innen-Neon-Schilder · 1 Jahr auf Außen-Neon-Schilder.</p>
              <h3>Was ist in der Box?</h3>
              <ul>
                <li>Handgefertigtes, maßgeschneidertes Neon-Schild</li>
                <li>Adapter · Dimmer · Fernbedienung</li>
                <li>Stromkabel 300 cm (optional länger auf Anfrage)</li>
                <li>Montagematerial – Schrauben, Dübel, Abstandshalter (Aufhängeseile auf Anfrage)</li>
              </ul>
              <h3>Weitere Informationen</h3>
              <p>Kontaktieren Sie uns unter <a href="mailto:info@neonframe.de" style={{color:'#6d28d9',fontWeight:600}}>info@neonframe.de</a> – wir helfen Ihnen gerne weiter.</p>
            </div>
          </div>
          <button className="desc-toggle" id="desc-toggle" onClick="toggleDesc()">
            <span>Mehr anzeigen</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
    </>
  )
}
