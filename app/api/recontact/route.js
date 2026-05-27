import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req) {
  try {
    const { offerId, customerEmail, customerName, offerLink } = await req.json()

    if (!customerEmail) {
      return Response.json({ error: 'Keine E-Mail-Adresse' }, { status: 400 })
    }

    const firstName = customerName?.split(' ')[0] || 'dort'

    await resend.emails.send({
      from: 'NeonFrame <info@neonframe.de>',
      to: customerEmail,
      subject: `Ihr Angebot wartet noch auf Sie – NeonFrame 💡`,
      html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:8px 36px;text-align:center">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" height="110" style="display:block;margin:0 auto">
        </td></tr>
        <tr><td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:1px;font-size:0">&nbsp;</td></tr>
        <tr><td style="background:#ffffff;padding:36px 36px 28px">
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#111">Hallo ${firstName},</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#333;line-height:1.7">wir hoffen es geht Ihnen gut.</p>
          <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.7">Bez&uuml;glich Ihres Angebots wollten wir uns nochmal bei Ihnen melden, da wir bisher leider noch keine R&uuml;ckmeldung von Ihnen erhalten haben. Vielleicht ist folgendes Angebot f&uuml;r Sie interessant:</p>
          <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7">Da wir aktuell Referenzen f&uuml;r unsere Website und Social Media sammeln, haben wir ein besonderes Angebot f&uuml;r Sie. Schicken Sie uns nach Erhalt Ihres Neonschildes <strong>Vorher/Nachher Fotos/Video</strong> oder ein kurzes Video des fertigen Projekts &ndash; und wir geben Ihnen <strong>weitere 10&nbsp;% Rabatt on top</strong>!</p>
          <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7">Falls Sie an dem Angebot interessiert sind, oder noch weitere Fragen haben, k&ouml;nnen Sie sich jederzeit gerne bei uns melden!</p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:28px">
            <tr>
              <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                  <tr>
                    <td align="center" bgcolor="#16a34a" style="background:#16a34a;border-radius:12px;padding:16px 36px">
                      <a href="${offerLink || '#'}" target="_blank" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;display:block">
                        Jetzt Angebot ansehen
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:28px 0 4px;font-size:15px;color:#555;line-height:1.7">Viele Gr&uuml;&szlig;e</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#111">Dein NeonFrame-Team</p>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center">
          <p style="margin:0;font-size:12px;color:#aaa">
            <a href="https://neonframe.de" style="color:#60c8f0;text-decoration:none">neonframe.de</a> · <a href="mailto:info@neonframe.de" style="color:#60c8f0;text-decoration:none">info@neonframe.de</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://angebote.neonframe.de'
    await fetch(`${baseUrl}/api/offers?id=${offerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'recontacted' }),
    })

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
