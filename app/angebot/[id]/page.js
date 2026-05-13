import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }) {
  return { title: `Angebot – NeonFrame` }
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
  if (c.includes('white') || c.includes('weiß')) return '#eee'
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

  const p = parseFloat(offer.final_price) || 0
  const rrp = parseFloat(offer.rrp_price) || 0
  const discType = offer.disc_type || 'pct'
  const discVal = parseFloat(offer.disc_val) || 20
  const discLabel = discType === 'pct'
    ? `${discVal}% Partner-Rabatt inklusive`
    : `€${discVal.toFixed(2)} Rabatt inklusive`
  const dot = colorDot(offer.colors)
  const img = offer.preview_image

  return (
    <>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#222;background:#fff;padding-bottom:70px}
        a{color:#1a8a3a}
        .hdr{background:#111;padding:12px 24px;display:flex;align-items:center;justify-content:space-between}
        .logo{color:#fff;font-size:20px;font-weight:800}
        .logosub{color:#aaa;font-size:11px}
        .rbar{background:#f9fafb;border-bottom:1px solid #e5e5e5;padding:8px 24px;display:flex;gap:20px;font-size:12px;color:#555;flex-wrap:wrap}
        .gbar{background:#1a8a3a;color:#fff;text-align:center;padding:10px 16px;font-size:13px;font-weight:600}
        .bc{padding:10px 24px;font-size:12px;color:#888;border-bottom:1px solid #eee}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;padding:24px;max-width:1200px;margin:0 auto}
        @media(max-width:860px){.grid{grid-template-columns:1fr;padding:16px}}
        .linner{display:flex;gap:10px}
        .istrip{display:flex;flex-direction:column;border:1px solid #e5e5e5;border-radius:4px;width:72px;flex-shrink:0;overflow:hidden}
        .isi{display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px;border-bottom:1px solid #eee;font-size:9px;color:#666;text-align:center}
        .isi:last-child{border:none}
        .isi-icon{font-size:20px}
        .imgarea{flex:1}
        .imgmain{position:relative;background:#f5f5f5;border-radius:4px;aspect-ratio:4/3;overflow:hidden;display:flex;align-items:center;justify-content:center}
        .imgmain img{width:100%;height:100%;object-fit:cover;display:block}
        .imgph{color:#bbb;font-size:13px;text-align:center}
        .imgbadges{position:absolute;bottom:12px;right:12px;display:flex;gap:6px}
        .ibadge{background:rgba(0,0,0,.7);color:#fff;font-size:9px;padding:3px 8px;border-radius:3px;font-weight:700}
        .thumbs{display:flex;gap:6px;margin-top:8px}
        .thumb{width:64px;height:64px;background:#f5f5f5;border-radius:4px;overflow:hidden;border:2px solid #1a8a3a}
        .thumb img{width:100%;height:100%;object-fit:cover}
        .aid{font-size:11px;color:#bbb;margin-top:6px}
        .rating{display:flex;align-items:center;gap:8px;margin-bottom:10px}
        .stars{color:#f59e0b;font-size:15px}
        .rnum{font-size:14px;font-weight:700}
        .rcnt{font-size:12px;color:#666}
        .title{font-size:22px;font-weight:800;line-height:1.2;margin-bottom:8px}
        .ptag{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
        .pt1{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px}
        .pt2{background:#1a8a3a;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}
        .slbl{font-size:12px;font-weight:700;display:block;margin-bottom:6px}
        .sval{display:inline-block;border:2px solid #1a8a3a;border-radius:6px;padding:7px 18px;font-size:13px;font-weight:600;color:#1a8a3a;background:#f0fdf4;margin-bottom:14px}
        .cfg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px}
        .cv{display:inline-flex;align-items:center;gap:5px;border:1px solid #1a8a3a;border-radius:20px;padding:5px 12px;font-size:11px;font-weight:600;color:#1a8a3a;background:#f0fdf4;margin-top:4px}
        .dot{width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,.1);display:inline-block}
        .qty{margin-bottom:14px}
        .qsel{border:1px solid #ddd;border-radius:4px;padding:6px 12px;font-size:12px}
        .checks{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}
        .ck{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:1.5}
        .cki{color:#1a8a3a;font-size:14px;flex-shrink:0;margin-top:1px}
        .pbox{background:#f9fafb;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin-bottom:14px}
        .plbl{font-size:11px;font-weight:800;color:#1a8a3a;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
        .pbig{font-size:30px;font-weight:800;color:#111;margin-bottom:3px}
        .pnote{font-size:11px;color:#888;margin-bottom:4px}
        .prrp{font-size:12px;color:#888}
        .prrp s{color:#bbb}
        .ship{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;display:flex;align-items:center;gap:10px;margin-bottom:6px}
        .shi{font-size:22px}
        .sht strong{display:block;font-size:13px;color:#166534;margin-bottom:1px}
        .sht span{font-size:12px;color:#555}
        .exp{font-size:12px;color:#555;display:flex;align-items:center;gap:4px;margin-bottom:14px}
        .cta{width:100%;background:#1a8a3a;color:#fff;border:none;border-radius:8px;padding:16px;font-size:15px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;font-family:Arial;text-decoration:none}
        .cta:hover{background:#166534}
        .pays{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
        .pay{background:#f5f5f5;border:1px solid #e5e5e5;border-radius:4px;padding:4px 10px;font-size:10px;font-weight:600;color:#555}
        .fgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px}
        .fi{background:#f9fafb;border:1px solid #e5e5e5;border-radius:8px;padding:10px 12px;display:flex;align-items:flex-start;gap:8px}
        .fii{font-size:16px;flex-shrink:0}
        .fit strong{display:block;font-size:11px;font-weight:700;margin-bottom:1px}
        .fit span{font-size:10px;color:#666;line-height:1.4}
        .vld{font-size:11px;color:#aaa;margin-top:8px;text-align:right}
        .chat-section{max-width:1200px;margin:0 auto;padding:0 24px 20px}
        .chatbox{background:#f9fafb;border:1px solid #e5e5e5;border-radius:8px;padding:16px;display:flex;gap:12px}
        .avatar{width:40px;height:40px;border-radius:50%;background:#e5e5e5;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
        .chatbody strong{display:block;font-size:13px;font-weight:700;margin-bottom:2px}
        .chatbody p{font-size:12px;color:#666;margin-bottom:8px}
        .chatinput{width:100%;border:1px solid #ddd;border-radius:6px;padding:8px 12px;font-size:12px;color:#333;background:#fff;resize:none;font-family:Arial;min-height:60px}
        .chatbtns{display:flex;gap:8px;margin-top:8px}
        .cbtn{padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:Arial}
        .cbtn-out{background:#fff;border:1px solid #ddd;color:#333}
        .cbtn-grn{background:#1a8a3a;color:#fff;border:none}
        .desc{max-width:1200px;margin:0 auto;padding:0 24px 80px}
        .desc h2{font-size:20px;font-weight:800;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #eee}
        .desc h3{font-size:14px;font-weight:700;margin:20px 0 8px;text-decoration:underline}
        .desc p{font-size:13px;line-height:1.7;color:#333;margin-bottom:10px}
        .desc ul{padding-left:20px;margin-bottom:10px}
        .desc li{font-size:13px;line-height:1.8;color:#333}
        .note-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:14px 16px;color:#166534;font-weight:500;margin-bottom:14px}
        .sticky{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e5e5;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 -4px 20px rgba(0,0,0,.08);z-index:100}
        .stleft{display:flex;align-items:center;gap:12px}
        .stimg{width:44px;height:44px;border-radius:4px;object-fit:cover;background:#f5f5f5}
        .sttitle{font-size:13px;font-weight:700;margin-bottom:1px}
        .stprice{font-size:12px;color:#555}
        .stbtn{background:#1a8a3a;color:#fff;border:none;border-radius:6px;padding:10px 28px;font-size:13px;font-weight:800;cursor:pointer;font-family:Arial;text-decoration:none;display:inline-block}
      `}</style>

      {/* HEADER */}
      <div className="hdr">
        <div>
          <div className="logo">🔆 THE NEON COMPANY</div>
          <div className="logosub">neonframe.de</div>
        </div>
        <div style={{color:'#888',fontSize:12}}>DE</div>
      </div>

      {/* REVIEW BAR */}
      <div className="rbar">
        <span>⭐ <strong>4.8 Google Reviews</strong> <span style={{color:'#f59e0b'}}>★★★★★</span></span>
        <span style={{marginLeft:'auto'}}>4.7 <span style={{color:'#f59e0b'}}>★★★★½</span> | 674 Bewertungen <strong>Trustpilot</strong></span>
      </div>

      {/* GREEN BAR */}
      <div className="gbar">✅ REDUZIERTE PREISAKTUALISIERUNG ANGEWENDET – NIEDRIGSTE IN EUROPA</div>

      {/* BREADCRUMB */}
      <div className="bc">
        <a href="/">Startseite</a> / <a href="/">Neon Signs</a> / <strong>{offer.project || 'Premium LED Neon Sign'}</strong>
      </div>

      {/* PRODUCT GRID */}
      <div className="grid">

        {/* LEFT */}
        <div>
          <div className="linner">
            <div className="istrip">
              {[['🎮','REMOTE CONTROL'],['✅','WARRANTY'],['💡','DIMMER'],['⚡','PowerLEDs™'],['🔌','ADAPTER'],['🔋','POWER CABLE']].map(([icon,lbl]) => (
                <div key={lbl} className="isi"><div className="isi-icon">{icon}</div>{lbl}</div>
              ))}
            </div>
            <div className="imgarea">
              <div className="imgmain">
                {img
                  ? <img src={img} alt="Neon Sign" />
                  : <div className="imgph"><div style={{fontSize:40}}>💡</div><div>Neon Sign Vorschau</div></div>}
                <div className="imgbadges">
                  <div className="ibadge">10 YEARS LIFETIME</div>
                  <div className="ibadge">PREMIUM POWERLEDS™</div>
                </div>
              </div>
              <div className="thumbs">
                {img && <div className="thumb"><img src={img} alt="" /></div>}
              </div>
              {offer.offer_num && <div className="aid">Angebots-ID: {offer.offer_num}</div>}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <div className="rating">
            <span className="stars">★★★★★</span>
            <span className="rnum">4.9</span>
            <span className="rcnt">(1146+ bewertungen)</span>
          </div>

          <div className="title">Premium PowerLEDs™ Neon Sign – Neonframe</div>

          {offer.project && (
            <div className="ptag">
              <span className="pt1">Kundenspezifisch für {offer.project}</span>
              <span className="pt2">JETZT MIT PARTNER-RABATT</span>
            </div>
          )}

          <span className="slbl">Größe (Breite x Höhe):</span>
          <div className="sval">{offer.width && offer.height ? `${offer.width} x ${offer.height} CM` : '– x – CM'}</div>

          <div className="cfg">
            <div><span className="slbl">Farbe:</span><div className="cv"><span className="dot" style={{background: dot}} />{offer.colors || '–'}</div></div>
            <div><span className="slbl">Rückwand:</span><div className="cv">{offer.backplate || '–'}</div></div>
            <div><span className="slbl">Modell:</span><div className="cv">{offer.usage || '–'}</div></div>
          </div>

          <div className="qty">
            <span className="slbl">Anzahl:</span>
            <select className="qsel"><option>1</option></select>
          </div>

          <div className="checks">
            <div className="ck"><span className="cki">✅</span><span>Einfach zu installieren mit dem mitgelieferten <strong>Montagematerial</strong></span></div>
            <div className="ck"><span className="cki">✅</span><span>Inklusive Fernbedienung, 3 Meter Stromkabel, Adapter, Dimmer und Montagematerial</span></div>
            <div className="ck"><span className="cki">✅</span><span>Seit über 10 Jahren die höchste Qualität Neon Signs in Europa</span></div>
          </div>

          <div className="pbox">
            <div className="plbl">Partnerpreis</div>
            <div className="pbig">{p > 0 ? `€ ${p.toFixed(2)}` : '€ –'}</div>
            <div className="pnote">exklusive MwSt. · {discLabel}</div>
            {rrp > 0 && <div className="prrp">Empfohlener Verkaufspreis: <s>€ {rrp.toFixed(2)}</s></div>}
          </div>

          <div className="ship">
            <div className="shi">🚚</div>
            <div className="sht">
              <strong>Kostenloser Versand</strong>
              <span>{offer.delivery ? `Geliefert zwischen ${offer.delivery}` : 'Lieferzeit auf Anfrage'}</span>
            </div>
          </div>
          <div className="exp">⚡ <strong>Schnell benötigt?</strong>&nbsp;Expressversand wählen</div>

          <a href={offer.checkout_url || '#'} className="cta" target={offer.checkout_url ? '_blank' : undefined} rel="noopener noreferrer">
            🛒 BESTÄTIGEN
          </a>

          <div className="pays">
            {['PayPal','💳 Karte','Klarna','SEPA','📄 Rechnung'].map(x => <span key={x} className="pay">{x}</span>)}
          </div>

          <div className="fgrid">
            {[['🛡️','Qualitätsgarantie','Handgefertigte PowerLEDs™'],['📦','Komplettpaket','Montagematerial + Controller'],['⚡','Einfache Installation','In wenigen Minuten fertig'],['♾️','10+ Jahre Lebensdauer','100.000 Brennstunden']].map(([icon,title,sub]) => (
              <div key={title} className="fi"><span className="fii">{icon}</span><div className="fit"><strong>{title}</strong><span>{sub}</span></div></div>
            ))}
          </div>

          {(offer.valid_until || offer.offer_date) && (
            <div className="vld">
              {offer.offer_date && `Datum: ${offer.offer_date} · `}
              {offer.valid_until && `Gültig bis: ${offer.valid_until}`}
            </div>
          )}
        </div>
      </div>

      {/* CHAT */}
      <div className="chat-section">
        <div className="chatbox">
          <div className="avatar">👤</div>
          <div className="chatbody" style={{flex:1}}>
            <strong>Stelle eine Frage an Kenzo</strong>
            <p>Kenzo ist Neon-Spezialist für alle Ihre Fragen und Wünsche</p>
            <textarea className="chatinput" placeholder="Zum Beispiel: Können Sie Farbe und Größe anpassen?" />
            <div className="chatbtns">
              <button className="cbtn cbtn-out">Frage stellen</button>
              <a href={offer.checkout_url || '#'} className="cbtn cbtn-grn" style={{textDecoration:'none'}}>Jetzt bestellen</a>
            </div>
          </div>
        </div>
      </div>

      {/* DESCRIPTION */}
      <div className="desc">
        <h2>Produktbeschreibung</h2>
        <p>Unsere maßgeschneiderten Neon-Schilder werden vollständig individuell mit hochwertiger PowerLEDs™ Beleuchtung produziert.</p>
        {offer.note && <div className="note-box">{offer.note}</div>}
        <h3>Premium-Beleuchtung</h3>
        <p>Die LED-Neon-Röhren sorgen für ein gleichmäßiges, helles Leuchten ohne Flackern. Dank PowerLEDs™ Technologie ist das Schild energieeffizient und langlebig.</p>
        <h3>Rückplatte &amp; Finish</h3>
        <p>Präzise lasergeschnittene Acryl-Rückplatte. Wählen zwischen: <strong>Ausgeschnitten</strong>, <strong>Quadratisch</strong> oder <strong>Ohne Rückplatte</strong>.</p>
        <h3>Garantie</h3>
        <p>2 Jahre Garantie auf Innen-Schilder, 1 Jahr auf Außen-Schilder.</p>
        <h3>Was ist in der Box?</h3>
        <ul>
          <li>Handgefertigtes maßgeschneidertes Neon-Schild</li>
          <li>Adapter · Dimmer · Fernbedienung</li>
          <li>Stromkabel 300cm</li>
          <li>Montagematerial – Schrauben, Dübel, Abstandshalter</li>
        </ul>
      </div>

      {/* STICKY */}
      <div className="sticky">
        <div className="stleft">
          {img ? <img src={img} className="stimg" alt="" /> : <div className="stimg" />}
          <div>
            <div className="sttitle">Custom PowerLEDs™ Neon Sign</div>
            {p > 0 && <div className="stprice">€ {p.toFixed(2)} exklusive MwSt.</div>}
          </div>
        </div>
        <a href={offer.checkout_url || '#'} className="stbtn" target={offer.checkout_url ? '_blank' : undefined} rel="noopener noreferrer">
          🛒 BESTÄTIGEN
        </a>
      </div>
    </>
  )
}
