// Bestellstatus-Seite: erscheint auf dem Angebots-Link, sobald der Kunde bestellt hat
// Stand kommt automatisch: Shopify (Bestellt), TNC-Abgleich (In Produktion, Versendet), DHL (Zugestellt)
import { trackingLink } from '../../../lib/shipping-emails'

const CSS = "*{box-sizing:border-box}body{margin:0;background:#eef3f9;font-family:-apple-system,\"SF Pro Display\",\"Segoe UI\",Inter,Helvetica,Arial,sans-serif;color:#0f1726;-webkit-font-smoothing:antialiased}\n.band{background:#09080a;padding:18px 0 14px;border-bottom:2px solid #3aa8ff;text-align:center;box-shadow:0 1px 0 rgba(58,168,255,.4),0 6px 24px rgba(58,168,255,.18)}\n.logo{display:inline-block;width:104px;height:70px;background:url(/email/header.png) -188px -12px/480px 96px no-repeat}\n.main{max-width:640px;margin:0 auto;padding:0 18px 30px}\n.hero{text-align:center;padding:34px 8px 26px}\n.eyebrow{display:inline-flex;white-space:nowrap;align-items:center;gap:8px;font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:#6b7a93;font-weight:600}\n.eyebrow i{width:6px;height:6px;border-radius:50%;background:#3aa8ff;box-shadow:0 0 0 4px rgba(58,168,255,.18)}\n.hero h1{white-space:nowrap;font-size:30px;line-height:1.15;letter-spacing:-.02em;margin:12px 0 8px;font-weight:700}\n.hero h1 em{font-style:normal;background:linear-gradient(90deg,#1f8fff,#5cc8ff);-webkit-background-clip:text;background-clip:text;color:transparent}\n.hero p{margin:0 auto;max-width:420px;color:#5d6b82;font-size:15px;line-height:1.55}\n.card{background:#fff;border-radius:18px;padding:22px 24px;margin-bottom:14px;box-shadow:0 1px 2px rgba(15,23,38,.04),0 8px 28px rgba(15,23,38,.06);border:1px solid #e6ecf4}\n.card h2{font-size:16px;margin:0 0 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;letter-spacing:-.01em}\n.eta{font-size:12.5px;font-weight:500;color:#6b7a93}.eta b{color:#0f1726}\n.steps{display:grid;grid-template-columns:repeat(4,1fr);position:relative}\n.steps::before{content:\"\";position:absolute;left:12.5%;right:12.5%;top:22px;height:2px;background:#e3e9f2}\n.steps .fill{position:absolute;left:12.5%;top:22px;height:2px;background:linear-gradient(90deg,#1f8fff,#5cc8ff)}\n.s{display:grid;justify-items:center;gap:9px;position:relative;font-size:12.5px;color:#9aa6b8;text-align:center}\n.s i{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#fff;border:1.5px solid #dbe3ee;font-style:normal;color:#a7b2c3}\n.s i svg{width:19px;height:19px}.s.on{color:#0f1726;font-weight:600}.s.on i{background:linear-gradient(135deg,#1f8fff,#5cc8ff);border-color:transparent;color:#fff;box-shadow:0 6px 16px rgba(31,143,255,.3)}\n.s.cur i{box-shadow:0 0 0 6px rgba(58,168,255,.16),0 6px 16px rgba(31,143,255,.3)}\n.u{display:flex;gap:12px;align-items:flex-start;background:#f6f9fc;border-radius:12px;padding:13px 14px;margin-top:8px}\n.u .ic{width:30px;height:30px;border-radius:50%;background:#e6f4ff;color:#1f8fff;display:grid;place-items:center;flex:none}.u .ic svg{width:15px;height:15px}\n.u div{flex:1;min-width:0}.u b{font-size:14px;display:block}.u small{color:#6b7a93;font-size:12.5px;line-height:1.5}.u time{font-size:12px;color:#9aa6b8;white-space:nowrap}\n.u a{display:inline-block;margin-top:4px;color:#1f8fff;font-weight:600;font-size:12.5px;text-decoration:none;word-break:break-all}\n.prod{display:flex;gap:16px;align-items:center}.img{width:92px;height:92px;border-radius:14px;background:linear-gradient(135deg,#1b2440,#0d1324);color:#7fa6d4;display:grid;place-items:center;font-size:11.5px;flex:none}\n.prod b{font-size:15px;display:block;margin-bottom:4px}.prod .d{color:#4b5a73;font-size:13.5px;line-height:1.6}\n.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.grid2 .card{margin:0}.grid2 h3{font-size:11px;letter-spacing:.14em;color:#8794a8;margin:0 0 8px}.grid2 p{margin:0;font-size:13.5px;line-height:1.6}\n.rev{background:#09080a;color:#fff;text-align:center;border:0;position:relative;overflow:hidden}\n.rev::before{content:\"\";position:absolute;inset:-40% -20% auto;height:140px;background:radial-gradient(closest-side,rgba(58,168,255,.35),transparent)}\n.rev h2{justify-content:center;color:#fff;font-size:19px;position:relative}.rev p{margin:0 0 16px;color:#aab7ca;font-size:14px;position:relative}\n.btns{display:flex;gap:12px;justify-content:center;position:relative}.btn{border-radius:10px;padding:12px 20px;font-weight:600;font-size:15px;text-decoration:none;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}\n.bw{background:#fff;color:#0f1726}.bo{border:1px solid #2b3445;color:#e8eefc}.stars{color:#f5b400;letter-spacing:1px;margin-left:4px}@media(max-width:560px){.btn{padding:11px 13px;font-size:14px;gap:6px}.stars{font-size:12px;letter-spacing:0}.rev p{font-size:13px}}\n.help{text-align:center;color:#6b7a93;font-size:13px;padding:10px 0 0}.help b{color:#0f1726}\n@media(max-width:560px){.hero{padding:26px 4px 20px}.hero h1{font-size:min(25px,5.6vw)}.eyebrow{font-size:min(11px,2.75vw);letter-spacing:.1em;gap:7px}.card{padding:18px 16px;border-radius:16px}.grid2{grid-template-columns:1fr}\n .s{font-size:11px}.s i{width:38px;height:38px}.steps::before,.steps .fill{top:19px}.u{flex-wrap:wrap}.u time{order:3;width:100%;padding-left:42px;margin-top:-2px}.logo{width:87px;height:58px;background-position:-157px -10px;background-size:400px 80px}.prod{gap:12px}.img{width:76px;height:76px}}\n.img{overflow:hidden}.img img{width:100%;height:100%;object-fit:cover;display:block}.u a:hover,.btn:hover{opacity:.85}a.btn{cursor:pointer}"
const IC = {"ok": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12l5 5L20 7\"/></svg>", "gear": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/></svg>", "truck": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M1 3h15v13H1z\"/><path d=\"M16 8h4l3 3v5h-7z\"/><circle cx=\"5.5\" cy=\"18.5\" r=\"2.5\"/><circle cx=\"18.5\" cy=\"18.5\" r=\"2.5\"/></svg>", "home": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 11l9-8 9 8\"/><path d=\"M5 10v10h14V10\"/></svg>", "google": "<svg viewBox=\"0 0 48 48\" width=\"20\" height=\"20\"><path fill=\"#FFC107\" d=\"M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z\"/><path fill=\"#FF3D00\" d=\"M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z\"/><path fill=\"#4CAF50\" d=\"M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z\"/><path fill=\"#1976D2\" d=\"M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z\"/></svg>", "tp": "<svg viewBox=\"0 0 24 24\" width=\"19\" height=\"19\"><path fill=\"#00b67a\" d=\"M12 1.8l2.9 7.2 7.7.5-5.9 5 1.9 7.5L12 17.9 5.4 22l1.9-7.5-5.9-5 7.7-.5z\"/></svg>"}
const GOOGLE_URL = 'https://www.google.com/maps/place/NeonFrame/@51.0637765,5.1763465,6z/data=!4m8!3m7!1s0xfbcdfa1354ee51f:0xfaeafc0d481ec8dc!8m2!3d51.175807!4d10.4541194!9m1!1b1!16s%2Fg%2F11njsjhlpk'
const TRUSTPILOT_URL = 'https://de.trustpilot.com/evaluate/neonframe.de'

const Ic = ({ k }) => <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: IC[k] }} />
const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.']
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const berlin = d => new Date(new Date(d).toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
const dShort = d => { const x = berlin(d); return `${x.getDate()}. ${MON[x.getMonth()]}` }
const dLong = d => { const x = berlin(d); return `${x.getDate()}. ${MON[x.getMonth()]} ${x.getFullYear()}` }
const dTime = d => { const x = berlin(d); return `${dLong(d)}, ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}` }
const addWork = (d, n) => { const x = new Date(d); while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) n-- } return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

const STATES = {
  confirmed: [0, 'Bestellt', <>Bestellung <em>eingegangen</em></>, 'Vielen Dank! Wir bereiten jetzt die Produktion deines Neonschildes vor.'],
  in_production: [1, 'In Produktion', <>Dein Neonschild wird <em>gefertigt</em></>, 'Es wird jetzt individuell für dich gefertigt und vor dem Versand getestet.'],
  shipped: [2, 'Versendet', <>Dein Neonschild ist <em>unterwegs</em></>, 'Sicher verpackt auf dem Weg zu dir. Verfolge dein Paket mit einem Klick.'],
  delivered: [3, 'Zugestellt', <>Dein Neonschild ist <em>angekommen</em></>, 'Wir hoffen, es leuchtet genau so, wie du es dir vorgestellt hast.'],
}

export default function Bestellstatus({ offer: o }) {
  const [n, label, title, sub] = STATES[o.status] || STATES.confirmed
  const num = o.offer_num || o.custom_id || String(o.id).slice(0, 8)
  const ordered = o.ordered_at || (o.order_email_sent_at ? new Date(new Date(o.order_email_sent_at) - 15 * 6e4).toISOString() : null)
  const steps = [['Bestellt', 'ok'], ['In Produktion', 'gear'], ['Versendet', 'truck'], ['Zugestellt', 'home']]

  let eta = null
  if (n < 2 && ordered) {
    const [a, b] = o.express ? [addWork(ordered, 7), addWork(ordered, 10)] : [addDays(ordered, 14), addDays(ordered, 21)]
    eta = <span className="eta">Voraussichtl. Lieferung: <b>{dShort(a)} bis {dShort(b)}</b></span>
  } else if (n === 2 && o.shipped_at) {
    const a = addWork(o.shipped_at, 2)
    eta = <span className="eta">Voraussichtl. bei dir: <b>{WD[a.getDay()]}, {dShort(a)}</b></span>
  }

  const ups = []
  if (n >= 3) ups.push(['home', 'Zugestellt', 'Dein Paket ist angekommen', o.delivered_at && dLong(o.delivered_at)])
  if (n >= 2) ups.push(['truck', 'Versendet', <>Dein Paket ist unterwegs{o.tracking_number && <><br /><a href={trackingLink(o)} target="_blank" rel="noopener noreferrer">Sendung verfolgen · {o.tracking_company || 'DHL'} {o.tracking_number} ↗</a></>}</>, o.shipped_at && dLong(o.shipped_at)])
  if (n >= 1) ups.push(['gear', 'Produktion gestartet', 'Dein Neonschild wird jetzt für dich gefertigt', o.production_at && dLong(o.production_at)])
  ups.push(['ok', 'Zahlung erhalten', 'Danke für deine Bestellung!', ordered && (o.ordered_at ? dTime(ordered) : dLong(ordered))])

  const colors = String(o.colors || '').split(',').map(c => c.trim()).filter(Boolean).join(', ')
  const details = [[o.width && o.height ? `${o.width} × ${o.height} cm` : '', colors].filter(Boolean).join(' · '),
    [o.usage, o.backplate && `Rückwand ${String(o.backplate).toLowerCase()}`].filter(Boolean).join(' · ')].filter(Boolean)
  const city = [o.ship_zip, o.ship_city].filter(Boolean).join(' ')

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="band"><span className="logo" role="img" aria-label="NeonFrame" /></div>
      <div className="main">
        <div className="hero">
          <span className="eyebrow"><i />Bestellung #{num} · {label}</span>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>

        <div className="card"><div className="steps">
          <div className="fill" style={{ width: `${n * 25}%` }} />
          {steps.map(([t, k], i) => (
            <div key={t} className={`s${i <= n ? ' on' : ''}${i === n && n < 3 ? ' cur' : ''}`}><i><Ic k={i < n || n === 3 ? 'ok' : k} /></i>{t}</div>
          ))}
        </div></div>

        {n === 3 && (
          <div className="card rev">
            <h2>Wie war deine Erfahrung?</h2>
            <p>Wir freuen uns über dein Feedback! Hinterlasse eine Bewertung:</p>
            <div className="btns">
              <a className="btn bw" href={GOOGLE_URL} target="_blank" rel="noopener noreferrer"><Ic k="google" />Google <span className="stars">★★★★★</span></a>
              <a className="btn bw" href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer"><Ic k="tp" />Trustpilot</a>
            </div>
          </div>
        )}

        <div className="card">
          <h2>Status {eta}</h2>
          {ups.map(([k, t, d, when]) => (
            <div className="u" key={t}><span className="ic"><Ic k={k} /></span><div><b>{t}</b><small>{d}</small></div>{when && <time>{when}</time>}</div>
          ))}
        </div>

        <div className="card">
          <h2>Dein Neonschild</h2>
          <div className="prod">
            <div className="img">{(o.checkout_image || o.preview_image) ? <img src={o.checkout_image || o.preview_image} alt="Dein Neonschild" /> : null}</div>
            <div><b>LED-Neonschild nach Maß</b><div className="d">{details.map((l, i) => <span key={i}>{i > 0 && <br />}{l}</span>)}</div></div>
          </div>
        </div>

        <div className="grid2">
          <div className="card"><h3>LIEFERADRESSE</h3><p>{o.ship_name ? <><b>{o.ship_name}</b><br /></> : null}{o.ship_street ? <>{o.ship_street}<br /></> : null}{city || 'Wie bei der Bestellung angegeben'}</p></div>
          <div className="card"><h3>BESTELLUNG</h3><p>#{num}<br />{ordered ? dLong(ordered) : ''}<br />Bezahlt</p></div>
        </div>

        <p className="help">Fragen zu deiner Bestellung? <a href="mailto:info@neonframe.de" style={{ color: '#0f1726', fontWeight: 700, textDecoration: 'none' }}>info@neonframe.de</a></p>
      </div>
    </>
  )
}
