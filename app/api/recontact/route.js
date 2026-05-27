import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req) {
  try {
    const { offerId, customerEmail, customerName, offerLink, price, width, height, colors } = await req.json()

    if (!customerEmail) {
      return Response.json({ error: 'Keine E-Mail-Adresse' }, { status: 400 })
    }

    const firstName = customerName?.split(' ')[0] || 'dort'

    await resend.emails.send({
      from: 'NeonFrame <info@neonframe.de>',
      to: customerEmail,
      subject: `Ihr Angebot wartet noch auf Sie – NeonFrame 💡`,
      html: `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:4px 20px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

        <tr><td style="background:#0a0a0a;border-radius:14px 14px 0 0;padding:4px 28px;text-align:center">
          <img src="https://cdn.shopify.com/s/files/1/0922/0911/9605/files/neonframe-logo-black-background_800x800.png?v=1778426735" alt="NeonFrame" width="120" height="120" style="display:block;margin:0 auto;border-radius:12px">
        </td></tr>

        <tr><td style="background:linear-gradient(90deg,#0ea5e9,#60c8f0);height:3px;font-size:0">&nbsp;</td></tr>

        <tr><td style="background:#fff;padding:24px 32px 24px;border-bottom:1px solid #f0f0f0">

          <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111">Hallo ${firstName}!</p>

          <p style="margin:0 0 16px;font-size:16px;color:#444;line-height:1.7">
            wir hoffen es geht Ihnen gut.
          </p>

          <p style="margin:0 0 16px;font-size:16px;color:#444;line-height:1.7">
            Bezüglich Ihres Angebots wollten wir uns nochmal bei Ihnen melden, da wir bisher leider noch keine Rückmeldung von Ihnen erhalten haben. Vielleicht ist folgendes Angebot für Sie interessant:
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0">
            <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 22px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="36" valign="top" style="font-size:26px">🎁</td>
                  <td style="padding-left:14px">
                    <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#166534">Exklusives Angebot für Sie</p>
                    <p style="margin:0;font-size:15px;color:#166534;line-height:1.7">
                      Da wir aktuell Referenzen für unsere Website und Social Media sammeln, haben wir ein besonderes Angebot für Sie. Schicken Sie uns nach Erhalt Ihres Neonschildes <strong>Vorher/Nachher Fotos/Video</strong> oder ein kurzes Video des fertigen Projekts – und wir geben Ihnen <strong>weitere 10 % Rabatt on top</strong>!
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;font-size:16px;color:#444;line-height:1.7">
            Falls Sie an dem Angebot interessiert sind, oder noch weitere Fragen haben, können Sie sich jederzeit gerne bei uns melden!
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0">
            <tr><td align="center">
              <a href="${offerLink}" style="display:inline-block;background:#16a34a;color:#fff;text-align:center;padding:16px 40px;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;">
                Jetzt Angebot ansehen
              </a>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;font-size:16px;color:#444;line-height:1.6">
            Viele Grüße<br><strong>Dein NeonFrame-Team</strong>
          </p>

        </td></tr>

        <tr><td style="background:#f8fafc;border-radius:0 0 14px 14px;padding:14px;text-align:center">
          <p style="margin:0;font-size:12px;color:#888">
            <a href="https://neonframe.de" style="color:#2563eb;text-decoration:none;">neonframe.de</a>
            &nbsp;·&nbsp;
            <a href="mailto:info@neonframe.de" style="color:#2563eb;text-decoration:none;">info@neonframe.de</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>
      `,
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
