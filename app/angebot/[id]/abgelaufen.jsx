// Seite für abgelaufene, deaktivierte oder gelöschte Angebote (statt 404)
export default function Abgelaufen({ nr }) {
  const css = `
  *{box-sizing:border-box;margin:0;padding:0}
  @font-face{font-family:NFAnton;src:url('/email/anton-400.woff') format('woff');font-display:swap}
  @font-face{font-family:NFMont;font-weight:400;src:url('/email/montserrat-400.woff') format('woff');font-display:swap}
  @font-face{font-family:NFMont;font-weight:800;src:url('/email/montserrat-800.woff') format('woff');font-display:swap}
  body{background:#f4f6f9;font-family:NFMont,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0b1321;-webkit-font-smoothing:antialiased}
  .ab-hdr{background:#0a0a0a;height:96px;display:flex;align-items:center;padding:0 52px}
  .ab-hdr img{height:78px;display:block}
  .ab-wrap{max-width:660px;margin:0 auto;padding:46px 20px 60px;text-align:center}
  .ab-paper{position:relative;max-width:520px;height:270px;margin:0 auto;background:#fff;border-radius:6px;box-shadow:0 1px 0 #e2e8f0,0 18px 40px rgba(15,23,42,.10),0 2px 6px rgba(15,23,42,.06);transform:rotate(-1.2deg);overflow:hidden}
  .ab-lines{position:absolute;top:34px;left:40px;right:40px;display:flex;flex-direction:column;gap:14px}
  .ab-lines i{display:block;height:8px;border-radius:4px;background:#f1f5f9}
  .ab-stamp{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%) rotate(-10deg);border:6px solid #dc2626;outline:2px solid #dc2626;outline-offset:5px;color:#dc2626;border-radius:10px;padding:6px 24px;font-family:NFAnton,Impact,sans-serif;font-size:56px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;opacity:.9}
  .ab-nr{font-weight:800;font-size:12px;letter-spacing:.28em;color:#0a6bff;margin-top:34px;text-transform:uppercase}
  h1{font-size:32px;font-weight:800;line-height:1.2;margin:10px 0 12px}
  p{font-size:16px;line-height:26px;color:#475569}
  .ab-btns{margin-top:26px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
  .ab-btn{display:inline-block;padding:16px 26px;border-radius:12px;font-weight:800;font-size:16px;text-decoration:none}
  .ab-b1{background:linear-gradient(90deg,#3ce3ff,#0a9bff);color:#fff;box-shadow:0 10px 26px rgba(10,155,255,.3)}
  .ab-b2{background:#fff;color:#0b1321;border:1px solid #d9e1ea}
  .ab-tr{margin-top:28px;display:flex;justify-content:center;gap:22px;font-size:13px;color:#64748b;font-weight:800;flex-wrap:wrap}
  @media(max-width:600px){.ab-hdr{height:64px;padding:0 16px}.ab-hdr img{height:46px}.ab-wrap{padding:32px 18px 40px}.ab-paper{height:220px}.ab-stamp{font-size:36px;border-width:4px;padding:4px 14px}h1{font-size:26px}.ab-btn{display:block;width:100%}}
  `
  return (
    <>
      <style>{css}</style>
      <header className="ab-hdr"><a href="https://neonframe.de"><img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" /></a></header>
      <main className="ab-wrap">
        <div className="ab-paper">
          <div className="ab-lines"><i style={{ width: '38%', height: 10, background: '#eef2f6' }} /><i style={{ width: '88%' }} /><i style={{ width: '80%' }} /><i style={{ width: '84%' }} /><i style={{ width: '62%' }} /><i style={{ width: '74%' }} /></div>
          <div className="ab-stamp">Abgelaufen</div>
        </div>
        {nr && <div className="ab-nr">Angebot #{nr}</div>}
        <h1 style={nr ? null : { marginTop: 34 }}>Dein Angebot ist leider abgelaufen</h1>
        <p>Dieses Angebot ist nicht mehr gültig. Kein Problem: Wir erstellen dir gerne ein neues Angebot für dein Neon-Schild, kostenlos und unverbindlich.</p>
        <div className="ab-btns">
          <a className="ab-btn ab-b1" href="https://neonframe.de/products/konfigurator">Neues Angebot anfragen</a>
          <a className="ab-btn ab-b2" href="mailto:info@neonframe.de">✉ info@neonframe.de</a>
        </div>
        <div className="ab-tr"><span>✓ Kostenlose 3D-Vorschau</span><span>✓ Angebot in 6 Std.</span><span>✓ Kostenloser Versand</span></div>
      </main>
    </>
  )
}
