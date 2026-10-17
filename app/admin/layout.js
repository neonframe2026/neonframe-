// Admin als App fürs Handy ("Zum Home-Bildschirm")
export const metadata = {
  title: 'NeonFrame Zentrale',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Zentrale', statusBarStyle: 'black' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
}

export const viewport = {
  themeColor: '#050a17',
}

export default function AdminLayout({ children }) {
  return children
}
