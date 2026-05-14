import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

export async function generateMetadata() {
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

const backplateImages = {
  'ausgeschnitten': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/backing-cutout_800x800.png?v=1777906190',
  'quadratisch': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/backing-square_800x800.png?v=1777580592',
  'ohne': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/backing-none_800x800.png?v=1777580593',
}
const backplateColorImages = {
  'transparent': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_02_34_00_800x800.png?v=1778719148',
  'schwarz': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_02_39_25_800x800.png?v=1778719182',
  'weiß': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_02_36_15_800x800.png?v=1778719148',
}
const usageImages = {
  'innen': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_04_05_10_800x800.png?v=1778724405',
  'außen': 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_04_03_27_800x800.png?v=1778724405',
}
const colorHoverImage = 'https://cdn.shopify.com/s/files/1/0922/0911/9605/files/ChatGPT_Image_14._Mai_2026_01_58_48_800x800.png?v=1778716750'

function getTooltipImg(val, map) {
  if (!val) return null
  const lower = val.toLowerCase()
  return map[lower] || map[Object.keys(map).find(k => lower.includes(k))] || null
}

export default async function AngebotPage({ params }) {
  const offer = await getOffer(params.id)
  if (!offer) notFound()

  const net = parseFloat(offer.net_price) || 0
  const vatPct = parseFloat(offer.vat_pct) || 19
  const final = parseFloat(offer.final_price) || 0
  const base = parseFloat(offer.base_price) || 0
  const discType = offer.disc_type || 'pct'
  const discVal = parseFloat(offer.disc_val) || 0
  const vatAmt = final - net
  const discAmt = discType === 'pct' ? base * (discVal / 100) : discVal
  const discDisplay = discType === 'pct' ? `${discVal}%` : `€ ${discVal.toFixed(2)}`
  const colors = parseColors(offer.colors)
  const displayId = offer.offer_num || offer.custom_id || offer.id?.slice(0, 8)

  // Build image array from offer
  const images = []
  if (offer.preview_image) images.push(offer.preview_image)
  if (offer.preview_image_2) images.push(offer.preview_image_2)
  if (offer.preview_image_3) images.push(offer.preview_image_3)

  const backplateImg = getTooltipImg(offer.backplate, backplateImages)
  const backplateColorImg = getTooltipImg(offer.backplate_color, backplateColorImages)
  const usageImg = getTooltipImg(offer.usage, usageImages)

  return (
    <>
      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111; background:#fff; -webkit-font-smoothing:antialiased; }

        .hdr {
          background: #0a0a0a;
          padding: 0 52px;
          height: 96px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        @media(max-width:900px){ .hdr { padding:0 20px; height:76px; } }
        .hdr-logo img { height: 82px; display: block; }
        .hdr-badge {
          background: rgba(96,200,240,.12);
          border: 1px solid rgba(96,200,240,.3);
          color: #60c8f0;
          font-size: 14px;
          font-weight: 600;
          padding: 9px 22px;
          border-radius: 20px;
        }

        .page-wrap {
          max-width: 1380px;
          margin: 0 auto;
          padding: 52px 52px 60px;
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 64px;
          align-items: start;
        }
        @media(max-width:960px){ .page-wrap { grid-template-columns:1fr; gap:32px; padding:28px 20px; } }

        /* IMAGE GALLERY */
        .left-col { position: sticky; top: 112px; }
        .gallery { display:flex; flex-direction:column; gap:12px; }
        .gallery-main {
          border-radius: 18px;
          overflow: hidden;
          background: #f5f5f5;
          border: 1px solid #eee;
          aspect-ratio: 4/3;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gallery-img { width:100%; height:100%; object-fit:cover; display:none; position:absolute; inset:0; }
        .gallery-ph { color:#ccc; display:flex; flex-direction:column; align-items:center; gap:10px; }
        .gallery-ph svg { width:52px; height:52px; }

        /* Arrow buttons */
        .gallery-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(255,255,255,.92);
          border: 1px solid #eee;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          transition: background .15s;
          box-shadow: 0 2px 8px rgba(0,0,0,.1);
        }
        .gallery-arrow:hover { background: #fff; }
        .gallery-arrow.prev { left: 12px; }
        .gallery-arrow.next { right: 12px; }
        .gallery-arrow svg { width:18px; height:18px; color:#111; }

        /* Thumbnails */
        .gallery-thumbs { display:flex; gap:10px; }
        .gallery-thumb {
          width: 80px;
          height: 60px;
          border-radius: 10px;
          overflow: hidden;
          border: 2px solid transparent;
          cursor: pointer;
          transition: border-color .15s;
          flex-shrink: 0;
          background: #f5f5f5;
        }
        .gallery-thumb.active { border-color: #60c8f0; }
        .gallery-thumb img { width:100%; height:100%; object-fit:cover; display:block; }

        /* CONTACT */
        .contact-card { margin-top:20px; background:#fff; border:1px solid #eee; border-radius:16px; padding:24px; }
        .contact-title { font-size:17px; font-weight:700; color:#111; margin-bottom:5px; }
        .contact-sub { font-size:14px; color:#999; margin-bottom:14px; line-height:1.5; }
        .contact-textarea { width:100%; background:#fafafa; border:1px solid #e8e8e8; border-radius:10px; padding:13px 15px; font-size:14px; color:#111; resize:vertical; min-height:88px; font-family:inherit; outline:none; transition:border-color .15s; display:block; margin-bottom:12px; }
        .contact-textarea:focus { border-color:#60c8f0; }
        .contact-textarea::placeholder { color:#ccc; }
        .contact-btn { display:inline-flex; align-items:center; gap:8px; background:#0a0a0a; color:#fff; border:none; border-radius:10px; padding:13px 22px; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .15s; }
        .contact-btn:hover { background:#222; }
        .contact-btn:disabled { opacity:.5; cursor:not-allowed; }
        .contact-status { font-size:13px; margin-top:10px; padding:9px 13px; border-radius:8px; display:none; }
        .contact-status.ok { background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; display:block; }
        .contact-status.err { background:#fef2f2; border:1px solid #fecaca; color:#dc2626; display:block; }

        /* RIGHT */
        .prod-title { font-size:30px; font-weight:800; line-height:1.2; color:#111; margin-bottom:10px; letter-spacing:-.02em; }
        .stars-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .stars-wrap { display:flex; gap:0; letter-spacing:-3px; }
        .star { color:#f59e0b; font-size:20px; line-height:1; letter-spacing:-2px; }
        .stars-label { font-size:14px; color:#666; font-weight:500; }
        .made-for { font-size:15px; color:#111; font-weight:400; margin-bottom:22px; }

        .cfg-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#bbb; display:block; margin-bottom:6px; }
        .cfg-group { margin-bottom:16px; }
        .cfg-row { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:22px; align-items:flex-end; }
.cfg-pill {
  display:inline-flex;
  align-items:center;
  gap:7px;
  background:#f5f5f5;
  border:1px solid #e8e8e8;
  border-radius:20px;
  padding:8px 16px;
  font-size:14px;
  font-weight:500;
  color:#333;
}
        .color-dot { width:11px; height:11px; border-radius:50%; border:1.5px solid rgba(0,0,0,.08); display:inline-block; flex-shrink:0; }

        /* Image tooltip */
        .img-tt { position:relative; display:inline-flex; }
        .img-tt-box {
          display:none;
          position:absolute;
          bottom:calc(100% + 10px);
          left:50%;
          transform:translateX(-50%);
          background:#fff;
          border:1px solid #eee;
          border-radius:12px;
          padding:6px 6px 6px 0px;
          box-shadow:0 8px 30px rgba(0,0,0,.12);
          z-index:200;
          pointer-events:none;
        }
        .img-tt-box img { display:block; border-radius:8px; }
        .img-tt-box.square img { width:148px; height:148px; object-fit:cover; }
 object-fit:cover; }
.img-tt-box.wide img {
  width: 300px;
  height: auto;
  object-fit: contain;
}
        .img-tt:hover .img-tt-box { display:block; }

        /* Text tooltip */
        .tt { position:relative; display:inline; }
        .tt-t { border-bottom:1px dashed #ccc; cursor:default; }
        .tt-box { display:none; position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%); background:#111; color:#f0f0f0; font-size:12px; padding:9px 13px; border-radius:8px; white-space:nowrap; z-index:50; pointer-events:none; line-height:1.6; }
        .tt-box::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:5px solid transparent; border-top-color:#111; }
        .tt:hover .tt-box { display:block; }

        .checks { margin-bottom:24px; display:flex; flex-direction:column; gap:10px; }
        .check-row { display:flex; align-items:flex-start; gap:10px; font-size:15px; color:#555; line-height:1.5; }
        .check-icon { width:20px; height:20px; flex-shrink:0; margin-top:2px; color:#60c8f0; }

        /* PRICE – all black text */
        .price-section { background:#fff; border:1px solid #e8e8e8; border-radius:16px; padding:24px; margin-bottom:18px; }
        .price-table { width:100%; border-collapse:collapse; }
        .price-table td { padding:6px 0; font-size:15px; vertical-align:middle; color:#111; }
        .price-table td:last-child { text-align:right; font-weight:500; }
        .pr-disc td { color:#16a34a !important; font-weight:600; }
        .pr-divider td { border-top:1px solid #f0f0f0; padding-top:14px; }
        .pr-total td:first-child { font-size:16px; font-weight:700; color:#111; padding-top:6px; }
        .pr-total td:last-child { font-size:28px; font-weight:800; color:#111; padding-top:6px; letter-spacing:-.02em; }
        .pr-total-note { font-size:11px; color:#111; text-align:right; margin-top:3px; }

        .ship-box { background:#f0fbff; border:1px solid #b8e8f8; border-radius:13px; padding:15px 18px; display:flex; align-items:flex-start; gap:13px; margin-bottom:8px; }
        .ship-icon { width:22px; height:22px; flex-shrink:0; margin-top:2px; color:#60c8f0; }
        .ship-text strong { display:block; font-size:15px; font-weight:700; color:#111; margin-bottom:3px; }
        .ship-text span { font-size:13px; color:#888; }
        .express-row { display:flex; align-items:center; gap:7px; font-size:14px; color:#999; margin-bottom:22px; margin-top:8px; }
        .express-icon { width:16px; height:16px; color:#f59e0b; flex-shrink:0; }

        .cta-btn { width:100%; background:#16a34a; color:#fff; border:none; border-radius:13px; padding:19px; font-size:18px; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:16px; font-family:inherit; transition:background .15s, transform .1s; text-decoration:none; }
        .cta-btn:hover { background:#15803d; transform:translateY(-1px); }
        .cta-btn svg { width:22px; height:22px; }

        .features { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:20px; }
        .feat { background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; display:flex; align-items:flex-start; gap:12px; transition:border-color .15s; }
        .feat:hover { border-color:#b8e8f8; }
        .feat-icon-wrap { width:38px; height:38px; background:#f0fbff; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid #d0f0fc; }
        .feat-icon-wrap svg { width:20px; height:20px; color:#60c8f0; }
        .feat-title { display:block; font-size:14px; font-weight:700; color:#111; margin-bottom:4px; }
        .feat-sub { font-size:12px; color:#888; line-height:1.5; }

        .desc-section { max-width:1380px; margin:0 auto; padding:0 52px 90px; }
        @media(max-width:960px){ .desc-section { padding:0 20px 60px; } }
        .desc-inner { border:1px solid #eee; border-radius:18px; overflow:hidden; }
        .desc-header { padding:28px 32px; border-bottom:1px solid #f0f0f0; background:#fafafa; }
        .desc-header h2 { font-size:20px; font-weight:800; color:#111; margin-bottom:10px; }
        .desc-header p { font-size:15px; color:#666; line-height:1.7; }
        .desc-body { padding:28px 32px; background:#fff; }
        .desc-body h3 { font-size:15px; font-weight:700; color:#111; margin:24px 0 8px; padding-bottom:6px; border-bottom:1px solid #f5f5f5; }
        .desc-body h3:first-child { margin-top:0; }
        .desc-body p { font-size:15px; color:#555; line-height:1.8; margin-bottom:10px; }
        .desc-body ul { padding-left:20px; margin-bottom:12px; }
        .desc-body li { font-size:15px; color:#555; line-height:1.9; }
        .desc-body strong { font-weight:700; color:#333; }
        .desc-body a { color:#60c8f0; text-decoration:none; }
      `}</style>

      <script dangerouslySetInnerHTML={{__html:`
        var currentImg = 0;
        var totalImgs = ${images.length};

        function showImg(idx) {
          if (totalImgs === 0) return;
          currentImg = ((idx % totalImgs) + totalImgs) % totalImgs;
          document.querySelectorAll('.gallery-img').forEach(function(el, i) {
            el.style.display = i === currentImg ? 'block' : 'none';
          });
          document.querySelectorAll('.gallery-thumb').forEach(function(el, i) {
            el.classList.toggle('active', i === currentImg);
          });
          // Smart arrows: hide prev on first, hide next on last
          var prev = document.querySelector('.gallery-arrow.prev');
          var next = document.querySelector('.gallery-arrow.next');
          if (prev) prev.style.display = currentImg === 0 ? 'none' : 'flex';
          if (next) next.style.display = currentImg === totalImgs - 1 ? 'none' : 'flex';
        }

        function prevImg() { showImg(currentImg - 1); }
        function nextImg() { showImg(currentImg + 1); }

        window.addEventListener('DOMContentLoaded', function() {
          // Init all imgs hidden except first
          document.querySelectorAll('.gallery-img').forEach(function(el, i) {
            el.style.display = i === 0 ? 'block' : 'none';
          });
          // Attach thumb clicks
          document.querySelectorAll('.gallery-thumb').forEach(function(el, i) {
            el.addEventListener('click', function() { showImg(i); });
          });
          showImg(0);
        });

        async function sendContact() {
          var msg = document.getElementById('contact-msg').value.trim();
          var btn = document.getElementById('contact-btn');
          var status = document.getElementById('contact-status');
          if (!msg) { status.className='contact-status err'; status.textContent='Bitte eine Nachricht eingeben.'; return; }
          btn.disabled = true; btn.textContent = 'Wird gesendet...';
          status.className = 'contact-status';
          try {
            var res = await fetch('/api/contact', { method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ message:msg, offerNum:'${displayId}', customerName:'${(offer.project||'').replace(/'/g,"\\'")}' }) });
            var data = await res.json();
            if (data.success) { status.className='contact-status ok'; status.textContent='Nachricht gesendet! Wir melden uns bald.'; document.getElementById('contact-msg').value=''; }
            else throw new Error(data.error);
          } catch(e) { status.className='contact-status err'; status.textContent='Fehler. Bitte direkt an info@neonframe.de schreiben.'; }
          btn.disabled=false;
          btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg> Per E-Mail senden';
        }
      `}} />

      {/* HEADER */}
      <header className="hdr">
        <a href="https://neonframe.de">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" style={{height:72,display:'block'}} />
        </a>
        {displayId && <div className="hdr-badge">Angebot #{displayId}</div>}
      </header>

      <div className="page-wrap">
        {/* LEFT */}
        <div className="left-col">
          <div className="gallery">
            {/* Main image */}
            <div className="gallery-main">
              {images.length > 0 ? (
                <>
                  {images.map((src, i) => (
                    <img key={i} src={src} alt={`Neon Sign ${i+1}`} className={`gallery-img${i === 0 ? ' active' : ''}`} />
                  ))}
                  {images.length > 1 && (
                    <>
                      <button className="gallery-arrow prev" onClick="prevImg()" aria-label="Vorheriges Bild">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      <button className="gallery-arrow next" onClick="nextImg()" aria-label="Nächstes Bild">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="gallery-ph">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"/></svg>
                  <span style={{fontSize:14,color:'#bbb'}}>Vorschau-Bild</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="gallery-thumbs">
                {images.map((src, i) => (
                  <div key={i} className={`gallery-thumb${i === 0 ? ' active' : ''}`}>
                    <img src={src} alt={`Vorschau ${i+1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="contact-card">
            <div className="contact-title">Noch Fragen oder Änderungswünsche?</div>
            <div className="contact-sub">Teilen Sie uns diese direkt hier mit – wir melden uns schnellstmöglich.</div>
            <textarea id="contact-msg" className="contact-textarea" placeholder="z.B. Kann die Farbe noch angepasst werden? Ich benötige Expressversand..." rows={3} />
            <button id="contact-btn" className="contact-btn" onClick="sendContact()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg>
              Per E-Mail senden
            </button>
            <div id="contact-status" className="contact-status"></div>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <h1 className="prod-title">Individuelles LED-Neon-Schild –<br/>personalisiert nach Wunsch</h1>

          {/* STARS */}
<div className="stars-row">
  <div
    className="stars-wrap"
    style={{
      display:'flex',
      alignItems:'center',
      gap:'4px'
    }}
  >
    <span className="star">★</span>
    <span className="star">★</span>
    <span className="star">★</span>
    <span className="star">★</span>

    {/* Halber Stern */}
    <span
      style={{
        position:'relative',
display:'inline-block',
width:'20px',
height:'20px',
fontSize:'20px',
lineHeight:'20px',
color:'#e5e7eb'
      }}
    >
      ★

      <span
        style={{
position:'absolute',
left:0,
top:0,
width:'50%',
height:'100%',
overflow:'hidden',
color:'#f59e0b',
lineHeight:'20px'
        }}
      >
        ★
      </span>
    </span>
  </div>

  <span className="stars-label">4,5/5 Sternen</span>
</div>

          {/* MADE FOR */}
          {offer.project && (
            <div className="made-for">Individuell angefertigt für <strong>{offer.project}</strong></div>
          )}

          {/* MAßE */}
          {(offer.width || offer.height) && (
            <div className="cfg-group">
              <span className="cfg-label">Maße (Breite × Höhe)</span>
              <div className="cfg-pill" style={{display:'inline-flex',marginTop:2}}>
                {offer.width && offer.height ? `${offer.width} × ${offer.height} cm` : offer.width || offer.height}
              </div>
            </div>
          )}

          {/* FARBEN */}
          {colors.length > 0 && (
            <div className="cfg-group">
              <span className="cfg-label">Farbe</span>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:2}}>
                {colors.map((c, i) => (
                  <div key={i} className="img-tt">
                    <div className="cfg-pill">
                      <span className="color-dot" style={{background: colorDot(c)}} />
                      {c}
                    </div>
                    <div className="img-tt-box wide">
                      <img src={colorHoverImage} alt="Farbbeispiel" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RÜCKWANDFORM / RÜCKWANDFARBE / VERWENDUNGSZWECK */}
          <div className="cfg-row" style={{marginBottom:22}}>
            {offer.backplate && (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <span className="cfg-label">Rückwandform</span>
                <div className="img-tt">
                  <div className="cfg-pill">{offer.backplate}</div>
                  {backplateImg && <div className="img-tt-box square"><img src={backplateImg} alt={offer.backplate} /></div>}
                </div>
              </div>
            )}
            {offer.backplate_color && (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <span className="cfg-label">Rückwandfarbe</span>
                <div className="img-tt">
                  <div className="cfg-pill">{offer.backplate_color}</div>
                  {backplateColorImg && <div className="img-tt-box square"><img src={backplateColorImg} alt={offer.backplate_color} /></div>}
                </div>
              </div>
            )}
            {offer.usage && (
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <span className="cfg-label">Verwendungszweck</span>
                <div className="img-tt">
                  <div className="cfg-pill">{offer.usage}</div>
                  {usageImg && <div className="img-tt-box square"><img src={usageImg} alt={offer.usage} /></div>}
                </div>
              </div>
            )}
          </div>

          {/* CHECKS */}
          <div className="checks">
            {[
              <>Einfach zu installieren mit dem mitgelieferten <span className="tt"><span className="tt-t">Montagematerial</span><span className="tt-box">Inklusive Schrauben, Dübel und Abstandhalter.<br/>(Aufhängkabel auf Anfrage)</span></span></>,
              <>Inklusive Fernbedienung, 3 Meter Stromkabel, Adapter und Dimmer</>,
              <>Entwickelt für eine langlebige und hochwertige Nutzung</>,
            ].map((text, i) => (
              <div key={i} className="check-row">
                <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* PRICE – all black */}
          <div className="price-section">
            <table className="price-table">
              <tbody>
                {base > 0 && <tr><td>Listenpreis (netto)</td><td>€ {base.toFixed(2)}</td></tr>}
                {discAmt > 0 && <tr className="pr-disc"><td style={{paddingTop:8}}>− Rabatt ({discDisplay})</td><td style={{paddingTop:8}}>− € {discAmt.toFixed(2)}</td></tr>}
                {net > 0 && <tr><td style={{paddingTop:6}}>Netto-Preis nach Rabatt</td><td style={{paddingTop:6}}>€ {net.toFixed(2)}</td></tr>}
                {vatAmt > 0 && <tr><td>+ MwSt. ({vatPct}%)</td><td>+ € {vatAmt.toFixed(2)}</td></tr>}
                <tr className="pr-divider"><td colSpan={2}></td></tr>
                <tr className="pr-total"><td>Gesamtbetrag</td><td>{final > 0 ? `€ ${final.toFixed(2)}` : '–'}</td></tr>
              </tbody>
            </table>
            {final > 0 && <div className="pr-total-note">(inkl. MwSt.)</div>}
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
            <span className="tt"><span className="tt-t">Expressversand anfordern</span><span className="tt-box">Expressversand: ca. 7–10 Werktage.<br/>Bitte im Anpassungsfeld anfordern.</span></span>
          </div>

          {/* CTA */}
          <a href={offer.checkout_url || '#'} className="cta-btn" target={offer.checkout_url ? '_blank' : undefined} rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Angebot annehmen
          </a>

          {/* FEATURES */}
          <div className="features">
            {[
              [<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>, 'Qualitätsgarantie', 'Hochwertige LED-Neonfertigung mit präziser Handarbeit'],
              [<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>, 'Komplettpaket', 'Inklusive Netzteil, Dimmer, Fernbedienung und Montagematerial'],
              [<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>, 'Einfache Installation', 'Montieren Sie Ihr Neon Sign in wenigen Minuten'],
              [<><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>, 'Extrem langlebig', 'Energieeffiziente LEDs mit bis zu 100.000 Stunden Lebensdauer'],
            ].map(([pathEl, title, sub], i) => (
              <div key={i} className="feat">
                <div className="feat-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{pathEl}</svg></div>
                <div><span className="feat-title">{title}</span><span className="feat-sub">{sub}</span></div>
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
          <div className="desc-body">
            <h3>Premium-Beleuchtung</h3>
            <p>Die LED-Neon-Röhren sorgen für ein gleichmäßiges, helles Leuchten ohne Flackern oder sichtbare Lichtpunkte. Dank unserer patentierten PowerLEDs™ Technologie ist das Neon-Schild energieeffizient, langlebig und sicher im Gebrauch.</p>
            <h3>Rückplatte &amp; Finish</h3>
            <p>Das Neon-Schild wird auf einer stabilen Acryl-Rückplatte montiert. Je nach Design wählen Sie zwischen:</p>
            <ul>
              <li><strong>Ausgeschnittene Rückplatte:</strong> Folgt exakt der Form Ihres Designs – minimalistisch und modern.</li>
              <li><strong>Quadratische Rückplatte:</strong> Rahmt das gesamte Design für einen klassischen Look.</li>
              <li><strong>Ohne Rückplatte:</strong> Vollständig schwebender Effekt.</li>
            </ul>
            <p>Standardmäßig transparent – auf Wunsch in jeder Farbe erhältlich.</p>
            <h3>Farben</h3>
            <p>Wählen Sie aus einer Vielzahl von Farben oder entscheiden Sie sich für die <strong>Full Color Option (+15%)</strong>.</p>
            <h3>UV-Druck</h3>
            <p>Mit UV-Druck drucken wir Ihr Design haarscharf direkt auf die Acryl-Rückplatte.</p>
            <h3>Verwendung</h3>
            <ul>
              <li><strong>Innen</strong> – für alle Innenräume geeignet</li>
              <li><strong>Außen</strong> – IP65 wasserdicht und UV-beständig</li>
            </ul>
            <h3>Fernbedienung</h3>
            <p>Jedes Neon-Schild wird mit einer Fernbedienung geliefert: dimmen, ein-/ausschalten und verschiedene Effekte wählen.</p>
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
      </div>
    </>
  )
}
