import './globals.css'

export const metadata = {
  title: 'NeonFrame',
  description: 'Premium LED Neon Signs',
}

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
