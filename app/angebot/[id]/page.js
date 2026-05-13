import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }) {
  return { title: `Ihr persönliches Angebot – NeonFrame` }
}

async function getOffer(id) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('id', id)
    .eq('published', true)
    .single()
  if (error || !data) return null
  return data
}

function colorDot(s = '') {
  const c = s.toLowerCase()
  if (c.includes('ice blue') || c.includes('blue') || c.includes('blau')) return '#60c8f0'
  if (c.includes('warm white') || c.includes('warm')) return '#fff8e1'
  if (c.includes('white') || c.includes('weiß')) return '#f0f0f0'
  if (c.includes('red') || c.includes('rot')) return '#ef4444'
  if (c.includes('green') || c.includes('grün')) return '#22c55e'
  if (c.includes('pink')) return '#ec4899'
  if (c.includes('purple') || c.includes('lila')) return '#a855f7'
  if (c.includes('yellow') || c.includes('gelb')) return '#f59e0b'
  if (c.includes('orange')) return '#f97316'
  return '#aaa'
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
  const discVal = parseFloat(offer.disc_val) || 20
  const dot = colorDot(offer.colors)
  const img = offer.preview_image
  const discDisplay = discType === 'pct' ? `${discVal}%` : `€ ${discVal.toFixed(2)}`
  const discAmt = discType === 'pct' ? basePrice * (discVal / 100) : discVal
  const vatAmt = finalPrice - netAfterDisc

  return (
    <>
      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        :root {
          --dark: #0a0a14;
          --accent: #b4ff00;
          --text: #111827;
          --muted: #6b7280;
          --border: #e5e7eb;
          --surface: #f9fafb;
          --green: #16a34a;
          --radius: 12px;
          --radius-lg: 20px;
        }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: var(--text); background: #fff; }

        /* HEADER */
        .hdr {
          background: var(--dark);
          padding: 0 32px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 20px rgba(0,0,0,.5);
        }
        .hdr-logo img { height: 34px; display: block; }
        .hdr-badge {
          background: rgba(180,255,0,.12);
          border: 1px solid rgba(180,255,0,.3);
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 20px;
          letter-spacing: .04em;
        }

        /* LAYOUT */
        .product-wrap {
          max-width: 1160px;
          margin: 0 auto;
          padding: 40px 24px 60px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 56px;
          align-items: start;
        }
        @media(max-width:860px) {
          .product-wrap { grid-template-columns: 1fr; gap: 32px; padding: 24px 16px 40px; }
        }

        /* IMAGE COL */
        .img-sticky { position: sticky; top: 80px; }
        .img-main {
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: #f3f4f6;
          aspect-ratio: 4/3;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: 0 8px 40px rgba(0,0,0,.1);
        }
        .img-main img { width:100%; height:100%; object-fit:cover; display:block; }
        .img-ph { color:#9ca3af; font-size:14px; text-align:center; }
        .img-badge {
          position: absolute;
          bottom: 14px; right: 14px;
          background: rgba(0,0,0,.75);
          backdrop-filter: blur(8px);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 5px 10px;
          border-radius: 6px;
          letter-spacing: .06em;
        }
        .icon-strip {
          display: flex;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        .icon-item {
          display: flex;
          align-items: center;
          gap: 5px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 5px 10px;
          font-size: 11px;
          color: var(--muted);
          font-weight: 500;
        }

        /* DETAIL COL */
        .prod-title {
          font-size: 26px;
          font-weight: 800;
          line-height: 1.2;
          color: var(--dark);
          margin-bottom: 22px;
          letter-spacing: -.02em;
        }
        .cfg-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: .07em;
          color: var(--muted);
          font-weight: 600;
          display: block;
          margin-bottom: 5px;
        }
        .cfg-group { margin-bottom: 14px; }
        .cfg-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
        .cfg-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1.5px solid var(--dark);
          border-radius: 30px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 600;
          color: var(--dark);
          background: #fff;
        }
        .color-dot {
          width: 11px; height: 11px;
          border-radius: 50%;
          border: 1.5px solid rgba(0,0,0,.15);
          display: inline-block;
          flex-shrink: 0;
        }

        /* TOOLTIP */
        .tt-wrap { position: relative; display: inline; }
        .tt-trigger { border-bottom: 1px dashed #9ca3af; cursor: default; }
        .tt-box {
          display: none;
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--dark);
          color: #fff;
          font-size: 12px;
          padding: 9px 13px;
          border-radius: 8px;
          white-space: nowrap;
          z-index: 50;
          pointer-events: none;
          line-height: 1.6;
          box-shadow: 0 4px 20px rgba(0,0,0,.3);
        }
        .tt-box::after {
          content: '';
          position: absolute;
          top: 100%; left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: var(--dark);
        }
        .tt-wrap:hover .tt-box { display: block; }

        /* CHECKLIST */
        .checks { display:flex; flex-direction:column; gap:8px; margin-bottom:22px; }
        .check-row { display:flex; align-items:flex-start; gap:10px; font-size:13px; color:#374151; line-height:1.5; }
        .check-icon { color: var(--green); font-size:15px; flex-shrink:0; margin-top:2px; }

        /* PRICE TABLE */
        .price-section {
          background: var(--dark);
          border-radius: var(--radius-lg);
          padding: 22px 24px;
          margin-bottom: 18px;
          color: #fff;
        }
        .price-table { width:100%; border-collapse:collapse; }
        .price-table td { padding: 5px 0; font-size: 13px; vertical-align: middle; }
        .price-table td:last-child { text-align:right; font-weight:500; }
        .price-table .muted td { color: rgba(255,255,255,.45); }
        .price-table .disc td { color: #4ade80; }
        .price-table .divider td { border-top: 1px solid rgba(255,255,255,.12); padding-top:10px; }
        .price-table .total-row td { padding-top: 6px; }
        .price-total-label { font-size:13px; font-weight:700; color:rgba(255,255,255,.7); }
        .price-total-val { font-size:30px !important; font-weight:800 !important; color: var(--accent) !important; letter-spacing:-.02em; }
        .price-note { font-size:11px; color:rgba(255,255,255,.35); margin-top:8px; }
        .price-rrp { font-size:12px; color:rgba(255,255,255,.35); margin-top:3px; }
        .price-rrp s { color:rgba(255,255,255,.25); }

        /* SHIPPING */
        .ship-box {
          background:#f0fdf4;
          border:1px solid #bbf7d0;
          border-radius:var(--radius);
          padding:13px 16px;
          display:flex;
          align-items:flex-start;
          gap:12px;
          margin-bottom:6px;
        }
        .ship-icon { font-size:20px; flex-shrink:0; margin-top:2px; }
        .ship-text strong { display:block; font-size:13px; font-weight:700; color:#166534; margin-bottom:2px; }
        .ship-text span { font-size:12px; color:#166534; display:block; }
        .express-row {
          display:flex; align-items:center; gap:6px;
          font-size:12px; color:var(--muted);
          margin-bottom:18px; margin-top:6px;
        }

        /* CTA */
        .cta-btn {
          width:100%;
          background: var(--dark);
          color:#fff;
          border:none;
          border-radius:var(--radius);
          padding:17px;
          font-size:16px;
          font-weight:800;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          margin-bottom:14px;
          font-family:inherit;
          letter-spacing:.02em;
          transition:.2s;
          text-decoration:none;
          position:relative;
          overflow:hidden;
        }
        .cta-btn:hover { background:#1a1a2e; transform:translateY(-1px); box-shadow:0 8px 30px rgba(0,0,0,.25); }

        /* PAYMENTS */
        .payments {
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          flex-wrap:wrap;
          padding:12px;
          background:var(--surface);
          border-radius:var(--radius);
          border:1px solid var(--border);
          margin-bottom:8px;
        }
        .pay-badge {
          height:22px;
          background:#fff;
          border:1px solid #e5e7eb;
          border-radius:5px;
          padding:0 8px;
          display:inline-flex;
          align-items:center;
          font-size:11px;
          font-weight:700;
          color:#374151;
        }

        /* VALIDITY */
        .validity { text-align:right; font-size:11px; color:var(--muted); margin-top:8px; }

        /* FEATURE CARDS */
        .features { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:20px; }
        .feat {
          background:var(--surface);
          border:1px solid var(--border);
          border-radius:var(--radius);
          padding:14px;
          display:flex;
          align-items:flex-start;
          gap:10px;
          transition:.15s;
        }
        .feat:hover { border-color:#d1d5db; background:#fff; }
        .feat-icon {
          width:36px; height:36px;
          background:var(--dark);
          border-radius:8px;
          display:flex; align-items:center; justify-content:center;
          font-size:16px; flex-shrink:0;
        }
        .feat-title { display:block; font-size:12px; font-weight:700; color:var(--dark); margin-bottom:2px; }
        .feat-sub { font-size:11px; color:var(--muted); line-height:1.4; }

        /* CONTACT SECTION */
        .contact-wrap {
          max-width:1160px;
          margin:0 auto;
          padding:0 24px 40px;
        }
        .contact-box {
          background:var(--surface);
          border:1px solid var(--border);
          border-radius:var(--radius-lg);
          padding:28px 32px;
          display:grid;
          grid-template-columns:52px 1fr;
          gap:18px;
          align-items:start;
        }
        @media(max-width:600px){ .contact-box { grid-template-columns:1fr; } }
        .contact-avatar {
          width:52px; height:52px;
          border-radius:50%;
          background:var(--dark);
          display:flex; align-items:center; justify-content:center;
          font-size:22px; flex-shrink:0;
        }
        .contact-name { font-size:15px; font-weight:700; display:block; margin-bottom:3px; }
        .contact-sub { font-size:13px; color:var(--muted); margin-bottom:14px; display:block; }
        .contact-textarea {
          width:100%;
          border:1.5px solid var(--border);
          border-radius:var(--radius);
          padding:11px 14px;
          font-size:13px;
          color:var(--text);
          background:#fff;
          resize:vertical;
          min-height:80px;
          font-family:inherit;
          outline:none;
          transition:.15s;
          margin-bottom:10px;
          display:block;
        }
        .contact-textarea:focus { border-color:var(--dark); }
        .contact-btn {
          display:inline-flex;
          align-items:center;
          gap:8px;
          background:var(--dark);
          color:#fff;
          border:none;
          border-radius:var(--radius);
          padding:11px 22px;
          font-size:13px;
          font-weight:600;
          cursor:pointer;
          font-family:inherit;
          transition:.15s;
          text-decoration:none;
        }
        .contact-btn:hover { background:#1a1a2e; }

        /* DESCRIPTION */
        .desc-wrap {
          max-width:1160px;
          margin:0 auto;
          padding:0 24px 80px;
        }
        .desc-inner {
          border:1px solid var(--border);
          border-radius:var(--radius-lg);
          overflow:hidden;
        }
        .desc-header {
          padding:24px 28px;
          border-bottom:1px solid var(--border);
          background:var(--surface);
        }
        .desc-header h2 { font-size:18px; font-weight:800; color:var(--dark); margin-bottom:8px; }
        .desc-header p { font-size:13px; color:#4b5563; line-height:1.7; }
        .desc-body {
          max-height:0;
          overflow:hidden;
          transition:max-height .45s ease;
          padding:0 28px;
        }
        .desc-body.open { max-height:3000px; }
        .desc-body-inner { padding:24px 0; }
        .desc-body-inner h3 {
          font-size:14px; font-weight:700; color:var(--dark);
          margin:22px 0 6px;
          text-decoration:underline;
          text-underline-offset:3px;
        }
        .desc-body-inner h3:first-child { margin-top:0; }
        .desc-body-inner p { font-size:13px; color:#374151; line-height:1.75; margin-bottom:8px; }
        .desc-body-inner ul { padding-left:18px; margin-bottom:10px; }
        .desc-body-inner li { font-size:13px; color:#374151; line-height:1.8; }
        .desc-body-inner strong { font-weight:700; }
        .desc-toggle {
          width:100%;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          padding:15px;
          background:#fff;
          border:none;
          border-top:1px solid var(--border);
          font-size:13px;
          font-weight:600;
          color:var(--dark);
          cursor:pointer;
          font-family:inherit;
          transition:.15s;
        }
        .desc-toggle:hover { background:var(--surface); }
      `}</style>

      <script dangerouslySetInnerHTML={{__html:`
        function toggleDesc() {
          var b = document.getElementById('desc-body');
          var t = document.getElementById('desc-toggle');
          var open = b.classList.toggle('open');
          t.innerHTML = open ? '&#9650; Weniger anzeigen' : '&#9660; Mehr anzeigen';
        }
        function sendEmail() {
          var msg = document.getElementById('contact-msg').value;
          var subj = encodeURIComponent('Frage zu Angebot ${offer.offer_num||''}');
          var body = encodeURIComponent(msg);
          window.location.href = 'mailto:info@neonframe.de?subject=' + subj + '&body=' + body;
        }
      `}} />

      {/* HEADER */}
      <header className="hdr">
        <a href="https://neonframe.de" className="hdr-logo">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" />
        </a>
        {offer.offer_num && <div className="hdr-badge">Angebot #{offer.offer_num}</div>}
      </header>

      {/* PRODUCT */}
      <div className="product-wrap">

        {/* LEFT */}
        <div className="img-sticky">
          <div className="img-main">
            {img
              ? <img src={img} alt="Neon Sign" />
              : <div className="img-ph"><div style={{fontSize:44,marginBottom:8}}>💡</div><div>Neon Sign Vorschau</div></div>}
            <div className="img-badge">PREMIUM POWERLEDS™</div>
          </div>
          <div className="icon-strip">
            {[['🎮','Fernbedienung'],['✅','10J. Garantie'],['💡','Dimmer'],['⚡','PowerLEDs™'],['🔌','Adapter inkl.']].map(([ic,lb])=>(
              <div key={lb} className="icon-item"><span>{ic}</span>{lb}</div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <h1 className="prod-title">Individuelles LED-Neon-Schild –<br/>personalisiert nach Wunsch</h1>

          {/* SIZE */}
          {offer.width && offer.height && (
            <div className="cfg-group">
              <span className="cfg-label">Größe (Breite × Höhe)</span>
              <div className="cfg-pill">{offer.width} × {offer.height} cm</div>
            </div>
          )}

          {/* COLOR / BACKPLATE / USAGE */}
          <div className="cfg-row">
            {offer.colors && (
              <div>
                <span className="cfg-label">Farbe</span>
                <div className="cfg-pill">
                  <span className="color-dot" style={{background: dot}} />
                  {offer.colors}
                </div>
              </div>
            )}
            {offer.backplate && (
              <div>
                <span className="cfg-label">Rückwand</span>
                <div className="cfg-pill">{offer.backplate}</div>
              </div>
            )}
            {offer.usage && (
              <div>
                <span className="cfg-label">Modell</span>
                <div className="cfg-pill">{offer.usage}</div>
              </div>
            )}
          </div>

          {/* CHECKLIST */}
          <div className="checks">
            <div className="check-row">
              <span className="check-icon">✅</span>
              <span>Einfach zu installieren mit dem mitgelieferten{' '}
                <span className="tt-wrap">
                  <span className="tt-trigger">Montagematerial</span>
                  <span className="tt-box">Inklusive Schrauben, Dübel und Abstandhalter.<br/>(Aufhängkabel auf Anfrage)</span>
                </span>
              </span>
            </div>
            <div className="check-row">
              <span className="check-icon">✅</span>
              <span>Inklusive Fernbedienung, 3 Meter Stromkabel, Adapter und Dimmer</span>
            </div>
            <div className="check-row">
              <span className="check-icon">✅</span>
              <span>Seit über 10 Jahren die höchste Qualität Neon Signs in Europa</span>
            </div>
          </div>

          {/* PRICE */}
          <div className="price-section">
            <table className="price-table">
              <tbody>
                {basePrice > 0 && (
                  <tr className="muted">
                    <td>Listenpreis (netto)</td>
                    <td>€ {basePrice.toFixed(2)}</td>
                  </tr>
                )}
                {discAmt > 0 && (
                  <tr className="disc">
                    <td>− Partnerrabatt ({discDisplay})</td>
                    <td>− € {discAmt.toFixed(2)}</td>
                  </tr>
                )}
                {netAfterDisc > 0 && (
                  <tr>
                    <td style={{paddingTop:8}}>Netto-Preis nach Rabatt</td>
                    <td style={{paddingTop:8}}>€ {netAfterDisc.toFixed(2)}</td>
                  </tr>
                )}
                {vatAmt > 0 && (
                  <tr className="muted">
                    <td>+ MwSt. ({vatPct}%)</td>
                    <td>+ € {vatAmt.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="divider"><td colSpan={2}></td></tr>
                <tr className="total-row">
                  <td className="price-total-label">Gesamtbetrag</td>
                  <td className="price-total-val">{finalPrice > 0 ? `€ ${finalPrice.toFixed(2)}` : '–'}</td>
                </tr>
              </tbody>
            </table>
            <div className="price-note">Inkl. MwSt. · Kostenloser Versand nach Deutschland</div>
            {rrp > 0 && <div className="price-rrp">Empfohlener Verkaufspreis: <s>€ {rrp.toFixed(2)}</s></div>}
          </div>

          {/* SHIPPING */}
          <div className="ship-box">
            <div className="ship-icon">🚚</div>
            <div className="ship-text">
              <strong>Kostenloser Versand</strong>
              <span>Lieferzeit 2–3 Wochen</span>
            </div>
          </div>
          <div className="express-row">
            ⚡{' '}
            <span className="tt-wrap">
              <span className="tt-trigger">Expressversand anfordern</span>
              <span className="tt-box">Bitte im Anpassungsfeld anfordern.<br/>Expressversand: ca. 7–10 Werktage.</span>
            </span>
          </div>

          {/* CTA */}
          <a href={offer.checkout_url || '#'} className="cta-btn" target={offer.checkout_url ? '_blank' : undefined} rel="noopener noreferrer">
            ✅ Angebot annehmen
          </a>

          {/* PAYMENTS */}
          <div className="payments">
            <span className="pay-badge">PayPal</span>
            <span className="pay-badge">Visa</span>
            <span className="pay-badge">Mastercard</span>
            <span className="pay-badge">Klarna</span>
            <span className="pay-badge">Apple Pay</span>
            <span className="pay-badge">Google Pay</span>
            <span className="pay-badge">SEPA</span>
            <span className="pay-badge">Rechnung</span>
          </div>

          {(offer.valid_until || offer.offer_date) && (
            <div className="validity">
              {offer.offer_date && `Datum: ${offer.offer_date}`}
              {offer.offer_date && offer.valid_until && ' · '}
              {offer.valid_until && `Gültig bis: ${offer.valid_until}`}
            </div>
          )}

          {/* FEATURES */}
          <div className="features">
            {[
              ['🛡️','2 Jahre Garantie','Auf alle Innen-Neon-Schilder'],
              ['📦','Komplettpaket','Alles für sofortige Montage'],
              ['⚡','Einfache Installation','In wenigen Minuten montiert'],
              ['♾️','100.000 Std. Lebensdauer','Langlebige PowerLEDs™ Technik'],
            ].map(([ic,ti,su])=>(
              <div key={ti} className="feat">
                <div className="feat-icon">{ic}</div>
                <div><span className="feat-title">{ti}</span><span className="feat-sub">{su}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CONTACT */}
      <div className="contact-wrap">
        <div className="contact-box">
          <div className="contact-avatar">👤</div>
          <div>
            <span className="contact-name">Stelle eine Frage an Kenzo</span>
            <span className="contact-sub">Kenzo ist Ihr persönlicher Neon-Spezialist – für Fragen, Anpassungswünsche oder Expressversand.</span>
            <textarea
              id="contact-msg"
              className="contact-textarea"
              placeholder="Zum Beispiel: Kann die Farbe noch angepasst werden? Ich benötige Expressversand..."
              rows={3}
            />
            <button className="contact-btn" onClick="sendEmail()">
              ✉️ Per E-Mail senden
            </button>
          </div>
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="desc-wrap">
        <div className="desc-inner">
          <div className="desc-header">
            <h2>Produktbeschreibung</h2>
            <p>Unsere maßgeschneiderten Neon-Schilder werden vollständig individuell mit hochwertiger PowerLEDs™ Beleuchtung produziert. Jedes Schild wird speziell für Sie entworfen – ganz nach Ihren Wünschen auf Basis Ihres Textes, Logos oder Designs.</p>
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
              <p>Mit UV-Druck können wir Ihr Design haarscharf direkt auf die Acryl-Rückplatte drucken – auch Details, die nicht in Neon gefertigt werden können, bleiben klar sichtbar.</p>

              <h3>Verwendung</h3>
              <ul>
                <li><strong>Innen</strong> – für alle Innenräume geeignet</li>
                <li><strong>Außen</strong> – IP65 wasserdicht und UV-beständig</li>
              </ul>

              <h3>Fernbedienung</h3>
              <p>Jedes Neon-Schild wird mit einer Fernbedienung geliefert: dimmen, ein-/ausschalten und verschiedene Effekte wählen. Bei der Full Color Option auch Farbwechsel per Fernbedienung.</p>

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
              <p>Kontaktieren Sie uns unter <a href="mailto:info@neonframe.de" style={{color:'#7c3aed',fontWeight:600}}>info@neonframe.de</a> – wir helfen Ihnen gerne weiter.</p>
            </div>
          </div>
          <button className="desc-toggle" id="desc-toggle" onClick="toggleDesc()">
            ▼ Mehr anzeigen
          </button>
        </div>
      </div>
    </>
  )
}
