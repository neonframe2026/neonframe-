import { NextResponse } from 'next/server'

export async function POST(request) {
  const { message, offerNum, customerName } = await request.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Keine Nachricht' }, { status: 400 })
  }

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) {
    return NextResponse.json({ error: 'E-Mail nicht konfiguriert' }, { status: 500 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'NeonFrame Angebote <angebote@neonframe.de>',
      to: ['info@neonframe.de'],
      subject: `Neue Anfrage zu Angebot #${offerNum || 'unbekannt'}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <div style="background:#1c1c1c;padding:20px 24px;border-radius:8px 8px 0 0">
            <h2 style="color:#f0f0f0;margin:0;font-size:18px">Neue Kundenanfrage</h2>
            <p style="color:#4dbb8a;margin:4px 0 0;font-size:14px">Angebot #${offerNum || '–'}</p>
          </div>
          <div style="background:#f9f9f9;padding:20px 24px;border:1px solid #e5e5e5;border-top:none">
            ${customerName ? `<p style="margin:0 0 12px;font-size:14px;color:#666"><strong>Kunde:</strong> ${customerName}</p>` : ''}
            <p style="margin:0 0 8px;font-size:14px;color:#666"><strong>Nachricht:</strong></p>
            <div style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:14px;font-size:14px;color:#333;line-height:1.6;white-space:pre-wrap">${message}</div>
          </div>
          <div style="background:#f0f0f0;padding:12px 24px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">
            <p style="margin:0;font-size:12px;color:#999">Diese Nachricht wurde über die NeonFrame Angebotsseite gesendet.</p>
          </div>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    return NextResponse.json({ error: 'Versand fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
