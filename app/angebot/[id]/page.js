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
  if (c.includes('white') || c.includes('weiß')) return '#e5e5e5'
  if (c.includes('red') || c.includes('rot')) return '#ef4444'
  if (c.includes('green') || c.includes('grün')) return '#22c55e'
  if (c.includes('pink')) return '#ec4899'
  if (c.includes('purple') || c.includes('lila')) return '#a855f7'
  if (c.includes('yellow') || c.includes('gelb')) return '#f59e0b'
  if (c.includes('soft orange') || c.includes('orange')) return '#fb923c'
  return '#9ca3af'
}

function parseColors(s = '') {
  return s.split(',').map(c => c.trim()).filter(Boolean)
}

export default async function AngebotPage({ params }) {
  const offer = await getOffer(params.id)
  if (!offer) notFound()

  const net = parseFloat(offer.net_price) || 0
  const vatPct = parseFloat(offer.vat_pct) || 19
  const final = parseFloat(offer.final_price) || 0
  const rrp = parseFloat(offer.rrp_price) || 0
  const base = parseFloat(offer.base_price) || 0
  const discType = offer.disc_type || 'pct'
  const discVal = parseFloat(offer.disc_val) || 0
  const vatAmt = final - net
  const discAmt = discType === 'pct' ? base * (discVal / 100) : discVal
  const discDisplay = discType === 'pct' ? `${discVal}%` : `€ ${discVal.toFixed(2)}`
  const img = offer.preview_image
  const colors = parseColors(offer.colors)
  const displayId = offer.offer_num || offer.custom_id || offer.id?.slice(0, 8)

  return (
    <>
      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        html { font-size:16px; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #f0f0f0;
          background: #1c1c1c;
          -webkit-font-smoothing: antialiased;
        }

        .hdr {
          background: #141414;
          border-bottom: 1px solid #2a2a2a;
          padding: 0 48px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .hdr-logo img { height: 46px; display: block; }
        .hdr-badge {
          background: #0d2a20;
          border: 1px solid #1a4a30;
          color: #4dbb8a;
          font-size: 14px;
          font-weight: 600;
          padding: 8px 18px;
          border-radius: 20px;
        }

        .page-wrap {
          max-width: 1400px;
          margin: 0 auto;
          padding: 52px 48px 70px;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 60px;
          align-items: start;
        }
        @media(max-width:960px){
          .page-wrap { grid-template-columns:1fr; gap:32px; padding:28px 20px 50px; }
          .hdr { padding:0 20px; }
        }

        .left-col { position: sticky; top: 88px; }

        .img-box {
          border-radius: 18px;
          overflow: hidden;
          background: #222;
          border: 1px solid #2a2a2a;
          aspect-ratio: 4/3;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .img-box img { width:100%; height:100%; object-fit:cover; display:block; }
        .img-ph { color:#333; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px; }
        .img-ph svg { width:60px; height:60px; }
        .img-ph span { font-size:15px; }

        .contact-card {
          margin-top: 20px;
          background: #222;
          border: 1px solid #2a2a2a;
          border-radius: 16px;
          padding: 24px;
        }
        .contact-title { font-size:17px; font-weight:700; color:#f0f0f0; margin-bottom:6px; }
        .contact-sub { font-size:14px; color:#606060; margin-bottom:16px; line-height:1.6; }
        .contact-textarea {
          width:100%;
          background:#1a1a1a;
          border:1px solid #333;
          border-radius:10px;
          padding:13px 15px;
          font-size:14px;
          color:#e0e0e0;
          resize:vertical;
          min-height:96px;
          font-family:inherit;
          outline:none;
          transition:border-color .15s;
          display:block;
          margin-bottom:12px;
        }
        .contact-textarea:focus { border-color:#4dbb8a; }
        .contact-textarea::placeholder { color:#3a3a3a; }
        .contact-btn {
          display:inline-flex;
          align-items:center;
          gap:8px;
          background:#4dbb8a;
          color:#0a1a14;
          border:none;
          border-radius:10px;
          padding:13px 24px;
          font-size:14px;
          font-weight:700;
          cursor:pointer;
          font-family:inherit;
          transition:background .15s;
        }
        .contact-btn:hover { background:#3da87a; }
        .contact-btn:disabled { opacity:.6; cursor:not-allowed; }
        .contact-btn svg { width:16px; height:16px; }
        .contact-status { font-size:13px; margin-top:10px; padding:9px 13px; border-radius:8px; display:none; }
        .contact-status.ok { background:#0d2a20; border:1px solid #1a4a30; color:#4dbb8a; display:block; }
        .contact-status.err { background:#2a1010; border:1px solid #4a1a1a; color:#cc6666; display:block; }

        .prod-title {
          font-size:30px;
          font-weight:800;
          line-height:1.2;
          color:#f0f0f0;
          margin-bottom:26px;
          letter-spacing:-.02em;
        }

        .cfg-label {
          font-size:11px;
          font-weight:700;
          text-transform:uppercase;
          letter-spacing:.08em;
          color:#484848;
          display:block;
          margin-bottom:7px;
        }
        .cfg-group { margin-bottom:16px; }
        .cfg-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:24px; align-items:flex-end; }
        .cfg-pill {
          display:inline-flex;
          align-items:center;
          gap:7px;
          background:#252525;
          border:1px solid #333;
          border-radius:20px;
          padding:9px 18px;
          font-size:14px;
          font-weight:500;
          color:#d0d0d0;
        }
        .color-dot {
          width:12px; height:12px;
          border-radius:50%;
          border:1.5px solid rgba(255,255,255,.15);
          display:inline-block;
          flex-shrink:0;
        }

        .tt { position:relative; display:inline; }
        .tt-t { border-bottom:1px dashed #444; cursor:default; }
        .tt-box {
          display:none;
          position:absolute;
          bottom:calc(100% + 8px);
          left:50%;
          transform:translateX(-50%);
          background:#2e2e2e;
          color:#e0e0e0;
          font-size:13px;
          padding:10px 14px;
          border-radius:8px;
          white-space:nowrap;
          z-index:50;
          pointer-events:none;
          line-height:1.6;
          border:1px solid #3a3a3a;
        }
        .tt-box::after {
          content:'';
          position:absolute;
          top:100%; left:50%;
          transform:translateX(-50%);
          border:5px solid transparent;
          border-top-color:#2e2e2e;
        }
        .tt:hover .tt-box { display:block; }

        .checks { margin-bottom:26px; display:flex; flex-direction:column; gap:12px; }
        .check-row { display:flex; align-items:flex-start; gap:12px; font-size:15px; color:#a0a0a0; line-height:1.5; }
        .check-icon { width:20px; height:20px; flex-shrink:0; margin-top:2px; color:#4dbb8a; }

        .price-section {
          background:#222;
          border:1px solid #2a2a2a;
          border-radius:16px;
          padding:24px;
          margin-bottom:18px;
        }
        .price-table { width:100%; border-collapse:collapse; }
        .price-table td { padding:6px 0; font-size:15px; vertical-align:middle; }
        .price-table td:last-child { text-align:right; font-weight:500; }
        .pr-muted td { color:#484848; }
        .pr-disc td { color:#4dbb8a; font-weight:600; }
        .pr-divider td { border-top:1px solid #2a2a2a; padding-top:14px; }
        .pr-total td:first-child { font-size:15px; font-weight:700; color:#808080; padding-top:7px; }
        .pr-total td:last-child { font-size:26px; font-weight:800; color:#f0f0f0; padding-top:7px; letter-spacing:-.02em; }
        .pr-total-note { font-size:11px; color:#484848; text-align:right; margin-top:3px; }
        .pr-note { font-size:12px; color:#484848; margin-top:9px; }
        .pr-rrp { font-size:12px; color:#484848; margin-top:3px; }
        .pr-rrp s { color:#333; }

        .ship-box {
          background:#222;
          border:1px solid #2a2a2a;
          border-radius:13px;
          padding:15px 18px;
          display:flex;
          align-items:flex-start;
          gap:13px;
          margin-bottom:8px;
        }
        .ship-icon { width:22px; height:22px; flex-shrink:0; margin-top:2px; color:#4dbb8a; }
        .ship-text strong { display:block; font-size:15px; font-weight:700; color:#d0d0d0; margin-bottom:3px; }
        .ship-text span { font-size:13px; color:#606060; }
        .express-row { display:flex; align-items:center; gap:7px; font-size:14px; color:#606060; margin-bottom:22px; margin-top:8px; }
        .express-icon { width:16px; height:16px; color:#f59e0b; flex-shrink:0; }

        .cta-btn {
          width:100%;
          background:#4dbb8a;
          color:#0a1a14;
          border:none;
          border-radius:13px;
          padding:19px;
          font-size:18px;
          font-weight:800;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          margin-bottom:14px;
          font-family:inherit;
          transition:background .15s, transform .1s;
          text-decoration:none;
        }
        .cta-btn:hover { background:#3da87a; transform:translateY(-1px); }
        .cta-btn svg { width:22px; height:22px; }

        .payments {
          display:flex;
          align-items:center;
          justify-content:center;
          gap:7px;
          flex-wrap:wrap;
          padding:14px;
          background:#222;
          border-radius:13px;
          border:1px solid #2a2a2a;
          margin-bottom:12px;
        }
        .pay-item {
          background:#1a1a1a;
          border:1px solid #2e2e2e;
          border-radius:6px;
          width:52px;
          height:32px;
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
          padding:3px;
        }
        .pay-item img { max-width:44px; max-height:24px; object-fit:contain; filter:brightness(.75) grayscale(.2); }
        .pay-item-text {
          background:#1a1a1a;
          border:1px solid #2e2e2e;
          border-radius:6px;
          height:32px;
          padding:0 10px;
          display:flex;
          align-items:center;
          font-size:11px;
          font-weight:700;
          color:#606060;
          letter-spacing:.03em;
        }

        .features { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:22px; }
        .feat {
          background:#222;
          border:1px solid #2a2a2a;
          border-radius:13px;
          padding:16px;
          display:flex;
          align-items:flex-start;
          gap:12px;
          transition:border-color .15s;
        }
        .feat:hover { border-color:#333; }
        .feat-icon-wrap {
          width:38px; height:38px;
          background:#1a1a1a;
          border-radius:10px;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0;
        }
        .feat-icon-wrap svg { width:20px; height:20px; color:#4dbb8a; }
        .feat-title { display:block; font-size:14px; font-weight:700; color:#d0d0d0; margin-bottom:4px; }
        .feat-sub { font-size:12px; color:#606060; line-height:1.5; }

        .desc-section { max-width:1400px; margin:0 auto; padding:0 48px 90px; }
        @media(max-width:960px){ .desc-section { padding:0 20px 60px; } }
        .desc-inner { border:1px solid #2a2a2a; border-radius:18px; overflow:hidden; }
        .desc-header { padding:28px 32px; border-bottom:1px solid #2a2a2a; background:#1e1e1e; }
        .desc-header h2 { font-size:20px; font-weight:800; color:#f0f0f0; margin-bottom:10px; }
        .desc-header p { font-size:15px; color:#606060; line-height:1.7; }
        .desc-body { max-height:0; overflow:hidden; transition:max-height .45s ease; padding:0 32px; background:#1c1c1c; }
        .desc-body.open { max-height:5000px; }
        .desc-body-inner { padding:28px 0; }
        .desc-body-inner h3 { font-size:15px; font-weight:700; color:#d0d0d0; margin:24px 0 8px; border-bottom:1px solid #252525; padding-bottom:6px; }
        .desc-body-inner h3:first-child { margin-top:0; }
        .desc-body-inner p { font-size:14px; color:#808080; line-height:1.8; margin-bottom:10px; }
        .desc-body-inner ul { padding-left:20px; margin-bottom:12px; }
        .desc-body-inner li { font-size:14px; color:#808080; line-height:1.9; }
        .desc-body-inner strong { font-weight:700; color:#a0a0a0; }
        .desc-body-inner a { color:#4dbb8a; text-decoration:none; }
        .desc-toggle {
          width:100%;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          padding:18px;
          background:#1e1e1e;
          border:none;
          border-top:1px solid #2a2a2a;
          font-size:15px;
          font-weight:600;
          color:#808080;
          cursor:pointer;
          font-family:inherit;
          transition:background .15s;
        }
        .desc-toggle:hover { background:#222; color:#a0a0a0; }
        .desc-toggle svg { width:17px; height:17px; transition:transform .3s; }
        .desc-toggle.open svg { transform:rotate(180deg); }
      `}</style>

      <script dangerouslySetInnerHTML={{__html:`
        function toggleDesc() {
          var b = document.getElementById('desc-body');
          var t = document.getElementById('desc-toggle');
          var isOpen = b.classList.toggle('open');
          t.classList.toggle('open', isOpen);
          t.querySelector('.toggle-text').textContent = isOpen ? 'Weniger anzeigen' : 'Mehr anzeigen';
        }

        async function sendContact() {
          var msg = document.getElementById('contact-msg').value.trim();
          var btn = document.getElementById('contact-btn');
          var status = document.getElementById('contact-status');
          if (!msg) {
            status.className = 'contact-status err';
            status.textContent = 'Bitte eine Nachricht eingeben.';
            return;
          }
          btn.disabled = true;
          btn.textContent = 'Wird gesendet...';
          status.className = 'contact-status';
          try {
            var res = await fetch('/api/contact', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({
                message: msg,
                offerNum: '${displayId}',
                customerName: '${(offer.project || '').replace(/'/g, "\\'")}'
              })
            });
            var data = await res.json();
            if (data.success) {
              status.className = 'contact-status ok';
              status.textContent = 'Nachricht gesendet! Wir melden uns bald.';
              document.getElementById('contact-msg').value = '';
            } else {
              throw new Error(data.error || 'Fehler');
            }
          } catch(e) {
            status.className = 'contact-status err';
            status.textContent = 'Fehler beim Senden. Bitte direkt an info@neonframe.de schreiben.';
          }
          btn.disabled = false;
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg> Per E-Mail senden';
        }
      `}} />

      {/* HEADER */}
      <header className="hdr">
        <a href="https://neonframe.de">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" style={{height:46,display:'block'}} />
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
              : <div className="img-ph">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg>
                  <span>Vorschau-Bild</span>
                </div>}
          </div>

          <div className="contact-card">
            <div className="contact-title">Fragen oder Anpassungswünsche?</div>
            <div className="contact-sub">Teilen Sie uns diese direkt hier mit – wir melden uns schnellstmöglich bei Ihnen.</div>
            <textarea id="contact-msg" className="contact-textarea" placeholder="z.B. Kann die Farbe noch angepasst werden? Ich benötige Expressversand..." rows={3} />
            <button id="contact-btn" className="contact-btn" onClick="sendContact()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
              Per E-Mail senden
            </button>
            <div id="contact-status" className="contact-status"></div>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <h1 className="prod-title">Individuelles LED-Neon-Schild –<br/>personalisiert nach Wunsch</h1>

          {(offer.width || offer.height) && (
            <div className="cfg-group">
              <span className="cfg-label">Größe (Breite × Höhe)</span>
              <div className="cfg-pill" style={{display:'inline-flex', marginTop:2}}>
                {offer.width && offer.height ? `${offer.width} × ${offer.height} cm` : offer.width || offer.height}
              </div>
            </div>
          )}

          <div className="cfg-row">
            {colors.map((c, i) => (
              <div key={i} style={{display:'flex',flexDirection:'column',gap:6}}>
                {i === 0 && <span className="cfg-label">Farbe</span>}
                {i > 0 && <span className="cfg-label" style={{opacity:0}}>–</span>}
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
                <div className="cfg-pill">{offer.usage}</div>
              </div>
            )}
          </div>

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
              <span>Präzise Verarbeitung für ein besonders edles Finish</span>
            </div>
          </div>

          {/* PRICE */}
          <div className="price-section">
            <table className="price-table">
              <tbody>
                {base > 0 && (
                  <tr className="pr-muted">
                    <td>Listenpreis (netto)</td>
                    <td>€ {base.toFixed(2)}</td>
                  </tr>
                )}
                {discAmt > 0 && (
                  <tr className="pr-disc">
                    <td>− Rabatt ({discDisplay})</td>
                    <td>− € {discAmt.toFixed(2)}</td>
                  </tr>
                )}
                {net > 0 && (
                  <tr>
                    <td style={{paddingTop:10}}>Netto-Preis nach Rabatt</td>
                    <td style={{paddingTop:10}}>€ {net.toFixed(2)}</td>
                  </tr>
                )}
                {vatAmt > 0 && (
                  <tr className="pr-muted">
                    <td>+ MwSt. ({vatPct}%)</td>
                    <td>+ € {vatAmt.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="pr-divider"><td colSpan={2}></td></tr>
                <tr className="pr-total">
                  <td>Gesamtbetrag</td>
                  <td>{final > 0 ? `€ ${final.toFixed(2)}` : '–'}</td>
                </tr>
              </tbody>
            </table>
            {final > 0 && <div className="pr-total-note" style={{textAlign:'right',fontSize:11,color:'#484848',marginTop:3}}>(inkl. MwSt.)</div>}
            <div className="pr-note">Kostenloser Versand nach Deutschland</div>
            {rrp > 0 && <div className="pr-rrp">Empfohlener Verkaufspreis: <s>€ {rrp.toFixed(2)}</s></div>}
          </div>

          {/* SHIPPING */}
          <div className="ship-box">
            <svg className="ship-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>
            <div className="ship-text">
              <strong>Kostenloser Versand</strong>
              <span>{offer.delivery ? `Geliefert zwischen ${offer.delivery}` : 'Lieferzeit 2–3 Wochen'}</span>
            </div>
          </div>
          <div className="express-row">
            <svg className="express-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span className="tt">
              <span className="tt-t">Expressversand anfordern</span>
              <span className="tt-box">Expressversand: ca. 7–10 Werktage.<br/>Bitte im Anpassungsfeld anfordern.</span>
            </span>
          </div>

          {/* CTA */}
          <a href={offer.checkout_url || '#'} className="cta-btn" target={offer.checkout_url ? '_blank' : undefined} rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Angebot annehmen
          </a>

          {/* PAYMENTS */}
          <div className="payments">
            <div className="pay-item"><img src="https://cdn.shopify.com/shopifycloud/shopify/assets/payment_icons/paypal-49e4c1e03244b6d2de0d270ca0d22dd15da4bf9be78e57cbc6ca954fb3d86a2f.svg" alt="PayPal" /></div>
            <div className="pay-item"><img src="https://cdn.shopify.com/shopifycloud/shopify/assets/payment_icons/klarna-606519f3c0c469e01b3e60ad2fec1f97f02a86c2f49f5d74f3d1c879b4e2a5a.svg" alt="Klarna" /></div>
            <div className="pay-item"><img src="https://cdn.shopify.com/shopifycloud/shopify/assets/payment_icons/visa-319d545c6fd255c9aad5eeaad21fd6f7f7b4fbe64f34abdb9d0d5463c58a3a3.svg" alt="Visa" /></div>
            <div className="pay-item"><img src="https://cdn.shopify.com/shopifycloud/shopify/assets/payment_icons/master-173035bc8124581983d4efa50cf8626e8553c2b311353fbf67485f9c1a2b88d1.svg" alt="Mastercard" /></div>
            <div className="pay-item"><img src="https://cdn.shopify.com/shopifycloud/shopify/assets/payment_icons/maestro-5e3a72b2d78d88bbc32cce06ad5da2f19bc1bef8cab01de8db10baa4f6df0432.svg" alt="Maestro" /></div>
            <div className="pay-item"><img src="https://cdn.shopify.com/shopifycloud/shopify/assets/payment_icons/apple_pay-f6db0077dc7c325b436ecef9f9e041c0be7d7a52b9e0f83723f31f5e702e3eb7.svg" alt="Apple Pay" /></div>
            <div className="pay-item"><img src="https://cdn.shopify.com/shopifycloud/shopify/assets/payment_icons/google_pay-c66a29c63facf2053bf69352982c958e9675cabea4f2f7ccec08d4c7f4f3d9db.svg" alt="Google Pay" /></div>
            <div className="pay-item-text">SEPA</div>
          </div>

          {/* FEATURES */}
          <div className="features">
            {[
              [<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>, 'Qualitätsgarantie', 'Hochwertige LED-Neonfertigung mit präziser Handarbeit'],
              [<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>, 'Komplettpaket', 'Inklusive Netzteil, Dimmer, Fernbedienung und Montagematerial'],
              [<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>, 'Einfache Installation', 'Montieren Sie Ihr Neon Sign in wenigen Minuten'],
              [<><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>, 'Extrem langlebig', 'Energieeffiziente LEDs mit bis zu 100.000 Stunden Lebensdauer'],
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
                <li><strong>Quadratische Rückplatte:</strong> Rahmt das gesamte Design für einen klassischen, eleganten Look.</li>
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
                <li>Netzteil · Dimmer · Fernbedienung</li>
                <li>Stromkabel 300 cm (optional länger auf Anfrage)</li>
                <li>Montagematerial – Schrauben, Dübel, Abstandshalter</li>
              </ul>
              <h3>Weitere Informationen</h3>
              <p>Kontaktieren Sie uns unter <a href="mailto:info@neonframe.de">info@neonframe.de</a> – wir helfen Ihnen gerne weiter.</p>
            </div>
          </div>
          <button className="desc-toggle" id="desc-toggle" onClick="toggleDesc()">
            <span className="toggle-text">Mehr anzeigen</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>
    </>
  )
}
