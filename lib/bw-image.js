import { createElement as h } from 'react'

// Persönliches Bild für die Black-Week-Mails (1200 px breit, wird mit next/og gerendert)
// kind: 'switch' (Angebot umgestellt) | 'mail1' (24 Std.) | 'mail2' (Letzte Chance mit Countdown)
export const BW_W = 1200
const BG = '#08080b'
const CYAN = '#22d3ee'
const BLUE = '#0a6bff'
const eur = (n) => (Math.round(n * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export function bwImageHeight(kind, hasImg) {
  const base = kind === 'mail2' ? 1700 : 1990
  return hasImg ? base : base - 560
}

// Countdown als eigenes Bild (wird bei jedem Öffnen der Mail neu erzeugt)
export const CD_H = 434
export function buildCountdown({ cd, endText }) {
  const s = (style, ...c) => h('div', { style: { display: 'flex', ...style } }, ...c.filter(Boolean))
  const t = (style, text) => h('div', { style: { display: 'flex', ...style } }, text)
  const W = { color: '#ffffff', fontWeight: 800 }
  const words = (parts) => parts.flatMap(([text, st]) => text.split(' ').filter(Boolean).map(w => t({ marginRight: 9, ...(st || {}) }, w)))
  return s({ width: BW_W, height: CD_H, flexDirection: 'column', alignItems: 'center', background: BG, fontFamily: 'M', paddingTop: 64 },
    s({ alignItems: 'flex-start' },
      ...[[cd.d, 'TAGE'], [cd.h, 'STUNDEN'], [cd.m, 'MINUTEN']].flatMap(([v, l], i) => [
        i > 0 ? t({ fontFamily: 'A', fontSize: 80, color: CYAN, padding: '22px 14px 0' }, ':') : null,
        s({ flexDirection: 'column', alignItems: 'center' },
          t({ width: 196, height: 176, alignItems: 'center', justifyContent: 'center', fontSize: 112, fontWeight: 800, color: '#ffffff', borderRadius: 32, background: '#101b2d', border: '3px solid rgba(34,211,238,0.5)', boxShadow: '0 0 48px rgba(34,211,238,0.22)' }, v),
          t({ fontSize: 22, fontWeight: 800, letterSpacing: 5, color: CYAN, marginTop: 18 }, l)),
      ])),
    s({ flexWrap: 'wrap', justifyContent: 'center', fontSize: 28, color: '#a7b2c0', marginTop: 34 }, ...words([['Am'], [endText, W], ['ist Schluss']])))
}

export function buildBwImage({ kind, firstName, imageUrl, sizeText, variant, colorText, list, now, endText, cd }) {
  const s = (style, ...c) => h('div', { style: { display: 'flex', ...style } }, ...c.filter(Boolean))
  const t = (style, text) => h('div', { style: { display: 'flex', ...style } }, text)
  const save = list - now
  const H = bwImageHeight(kind, !!imageUrl)

  // Fließtext mit fetten Teilen, Wort für Wort (sauberer Umbruch)
  const rich = (parts, style = {}) => s({ flexWrap: 'wrap', justifyContent: 'center', ...style },
    ...parts.flatMap(([text, st]) => text.split(' ').filter(Boolean).map(w => t({ marginRight: 9, ...(st || {}) }, w))))
  const W = { color: '#ffffff', fontWeight: 800 }

  const intro = kind === 'switch'
    ? [['Gute Nachricht: Dein Angebot gibt es jetzt mit'], ['40% Black Friday Rabatt.', W], ['Den Rabatt haben wir schon direkt in deinem Angebot eingetragen. Er gilt bis zum'], [endText + '.', W]]
    : kind === 'mail1'
      ? [['dein Angebot ist noch für dich reserviert, jetzt mit'], ['40% Black Friday Rabatt.', W], ['So günstig bekommst du dein Schild das ganze Jahr nicht mehr.']]
      : [['dein Black Friday Preis ist noch reserviert, aber nicht mehr lange. Danach gilt wieder der normale Preis.']]


  const ticket = kind !== 'mail2' && s({ position: 'relative', flexDirection: 'column', alignItems: 'center', margin: '0 68px', background: '#f2fbff', borderRadius: 40, padding: '54px 40px 50px', boxShadow: '0 40px 120px rgba(34,211,238,0.18)' },
    t({ fontSize: 24, fontWeight: 800, letterSpacing: 8, color: BLUE }, 'DU SPARST'),
    t({ fontFamily: 'A', fontSize: 176, lineHeight: 1.05, color: BLUE, marginTop: 8 }, eur(save)),
    t({ width: '92%', borderTop: '4px dashed #c7d6e2', margin: '30px 0 26px' }, ''),
    s({ alignItems: 'baseline' },
      t({ fontSize: 34, fontWeight: 600, color: '#8a99a8', textDecoration: 'line-through', marginRight: 28 }, eur(list)),
      t({ fontFamily: 'A', fontSize: 70, color: '#05070a' }, eur(now))),
    t({ fontSize: 24, color: '#5b6b7a', marginTop: 8 }, 'inkl. 19% MwSt. · kostenloser Versand'),
    t({ position: 'absolute', top: -30, right: 40, background: '#000000', color: '#ffffff', fontFamily: 'A', fontSize: 42, padding: '10px 24px', borderRadius: 16, border: `4px solid ${CYAN}`, transform: 'rotate(8deg)' }, '-40%'),
    t({ position: 'absolute', left: -28, top: 270, width: 56, height: 56, borderRadius: 28, background: BG }, ''),
    t({ position: 'absolute', right: -28, top: 270, width: 56, height: 56, borderRadius: 28, background: BG }, ''))

  const priceBox = kind === 'mail2' && s({ flexDirection: 'column', margin: '0 68px' },
    s({ flexDirection: 'column', alignItems: 'center', borderRadius: 36, padding: '40px 20px', background: 'linear-gradient(160deg,#0f2a44,#0b1626)', border: `3px solid ${CYAN}`, boxShadow: '0 0 60px rgba(34,211,238,0.25)' },
      t({ fontSize: 22, fontWeight: 800, letterSpacing: 5, color: CYAN }, 'BIS ' + endText.split(' ')[0]),
      t({ fontFamily: 'A', fontSize: 96, color: '#ffffff', marginTop: 12 }, eur(now)),
      t({ fontSize: 26, color: '#94a3b8', marginTop: 4 }, 'mit 40% Rabatt')),
    s({ justifyContent: 'center', marginTop: 24, background: '#ffffff', borderRadius: 24, padding: '24px 20px' },
      rich([['Gesamt sparst du', { color: '#05070a', fontWeight: 800 }], [eur(save), { color: BLUE, fontWeight: 800 }], ['gegenüber dem Listenpreis', { color: '#05070a', fontWeight: 800 }]], { fontSize: 30 })))

  const specs = [['GRÖSSE', sizeText], ['AUSFÜHRUNG', variant], ['FARBEN', colorText]].filter(([, v]) => v)
  const card = s({ flexDirection: 'column', margin: '56px 68px 0', border: '3px solid #1e2a3a', borderRadius: 36, background: '#0d1522', overflow: 'hidden' },
    imageUrl ? h('img', { src: imageUrl, width: 1058, height: 560, style: { width: 1058, height: 560, objectFit: 'cover' } }) : null,
    specs.length ? s({ borderTop: imageUrl ? '3px solid #1e2a3a' : 'none' },
      ...specs.map(([l, v], i) => s({ flex: 1, flexDirection: 'column', alignItems: 'center', padding: '28px 14px', borderLeft: i ? '3px solid #1e2a3a' : 'none' },
        t({ fontSize: 21, fontWeight: 800, letterSpacing: 4, color: CYAN }, l),
        t({ fontSize: 30, fontWeight: 600, color: '#ffffff', marginTop: 8, textAlign: 'center' }, v)))) : null)

  const btnText = kind === 'mail2' ? 'JETZT NOCH MIT 40% BESTELLEN' : 'ANGEBOT MIT 40% SICHERN'

  return s({ width: BW_W, height: H, flexDirection: 'column', background: BG, fontFamily: 'M', color: '#c4cdd8', paddingTop: kind === 'mail2' ? 0 : 30 },
    s({ flexDirection: 'column', alignItems: 'center', padding: kind === 'mail2' ? '34px 90px 50px' : '0 90px 56px' },
      t({ fontSize: 34, color: '#ffffff', fontWeight: 800, marginBottom: 14 }, `Hallo ${firstName},`),
      rich(intro, { fontSize: 32, lineHeight: 1.55 })),
    ticket, priceBox, card,
    s({ justifyContent: 'center', marginTop: 56 },
      t({ background: 'linear-gradient(90deg,#3ce3ff,#0a9bff)', color: '#ffffff', fontSize: 34, fontWeight: 800, letterSpacing: 2, padding: '40px 0', width: 860, justifyContent: 'center', borderRadius: 28, boxShadow: '0 20px 60px rgba(10,155,255,0.35)' }, btnText)),
    t({ justifyContent: 'center', fontSize: 24, color: '#7c8a99', marginTop: 24 }, `Aktion gilt bis ${endText}`),
    s({ justifyContent: 'center', marginTop: 26, fontSize: 24, fontWeight: 600, color: '#94a3b8' },
      ...['Kostenloser Versand', 'Änderungen gratis', 'CE- und TÜV-geprüft'].map(x => s({ margin: '0 20px', alignItems: 'center' }, t({ width: 12, height: 12, borderRadius: 6, background: CYAN, marginRight: 10 }, ''), t({}, x)))),
  )
}
