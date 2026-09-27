import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CloseQuarters Club',
  description: 'Your private travel portal by CloseQuarters Club',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CQ Club',
  },
}

export const viewport: Viewport = {
  // A literal colour, not a custom property. `var(--color-text)` is not a
  // value the browser can resolve here, so iOS had no theme colour at all and
  // painted page content through the status bar while scrolling. This is Mist,
  // the page's own ground.
  themeColor: '#FFFCF8',
  width: 'device-width',
  initialScale: 1,
  // No maximum-scale: pinch-zoom is how people read small type, and blocking
  // it fails WCAG 1.4.4. Nothing in the layout depends on the page being
  // unzoomable.
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <style dangerouslySetInnerHTML={{ __html: `
          @font-face {
            font-family: 'Tan Mon Cheri';
            src: url('/fonts/tan-mon-cheri.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'The Seasons';
            src: url('/fonts/TheSeasons-Bold.woff2') format('woff2');
            font-weight: bold;
            font-display: swap;
          }
          @font-face {
            font-family: 'CQ Optima';
            src: url('/fonts/Optima_Roman.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }
          .font-tan-mon-cheri { font-family: 'Tan Mon Cheri', Georgia, 'Times New Roman', serif !important; letter-spacing: 0.01em; }
          .font-seasons        { font-family: 'The Seasons', Georgia, 'Times New Roman', serif !important; }
          .font-optima         { font-family: 'CQ Optima', 'Optima', 'Trebuchet MS', 'Gill Sans', sans-serif !important; }
          .font-playfair       { font-family: 'The Seasons', Georgia, 'Times New Roman', serif !important; }
          body                 { font-family: 'CQ Optima', 'Optima', 'Trebuchet MS', 'Gill Sans', sans-serif; font-synthesis: none; }
        ` }} />
      </head>
      <body className="bg-surface-base text-ink-secondary antialiased min-h-screen font-optima">
        {children}
      </body>
    </html>
  )
}
