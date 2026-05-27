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

        <tr><td style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:20px 36px 0 36px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="80" valign="middle">
                <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" width="72" height="72" style="display:block;border-radius:10px">
              </td>
              <td valign="middle" style="padding-left:16px">
                <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff">NeonFrame</p>
                <p style="margin:0;font-size:12px;color:#60c8f0">Ihr pers&ouml;nliches Neonschild</p>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:20px">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#16a34a;padding:16px 20px;border-radius:10px 10px 0 0">
                      <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#bbf7d0;letter-spacing:.1em;text-transform:uppercase">Erinnerung</p>
                      <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff">Ihr Angebot wartet noch auf Sie!</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="background:#ffffff;padding:32px 36px 28px">
          <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111">Hallo ${firstName},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.7">wir hoffen es geht Ihnen gut. Bez&uuml;glich Ihres Angebots wollten wir uns nochmal bei Ihnen melden, da wir bisher leider noch keine R&uuml;ckmeldung von Ihnen erhalten haben. Vielleicht ist folgendes Angebot f&uuml;r Sie interessant:</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0">
            <tr>
              <td width="4" bgcolor="#16a34a" style="border-radius:4px 0 0 4px">&nbsp;</td>
              <td bgcolor="#f8f8f8" style="padding:16px 20px;border-radius:0 8px 8px 0">
                <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#166534">&#127873; Exklusives Angebot f&uuml;r Sie</p>
                <p style="margin:0;font-size:14px;color:#444;line-height:1.7">Da wir aktuell Referenzen f&uuml;r unsere Website und Social Media sammeln, haben wir ein besonderes Angebot f&uuml;r Sie. Schicken Sie uns nach Erhalt Ihres Neonschildes <strong>Vorher/Nachher Fotos/Video</strong> oder ein kurzes Video des fertigen Projekts &ndash; und wir geben Ihnen <strong>weitere 10&nbsp;% Rabatt on top</strong>!</p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7">Falls Sie an dem Angebot interessiert sind, oder noch weitere Fragen haben, k&ouml;nnen Sie sich jederzeit gerne bei uns melden!</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td align="center">
              <a href="${offerLink || '#'}" style="display:inline-block;background:#16a34a;color:#fff;text-align:center;padding:16px 36px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none">
                Jetzt Angebot ansehen
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 4px;font-size:15px;color:#555;line-height:1.7">Viele Gr&uuml;&szlig;e</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#111">Dein NeonFrame-Team</p>
        </td></tr>

        <tr><td style="background:#f8fafc;border-top:1px solid #f0f0f0;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center">
          <p style="margin:0;font-size:12px;color:#aaa">
            <a href="https://neonframe.de" style="color:#60c8f0;text-decoration:none">neonframe.de</a> &middot; <a href="mailto:info@neonframe.de" style="color:#60c8f0;text-decoration:none">info@neonframe.de</a>
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
