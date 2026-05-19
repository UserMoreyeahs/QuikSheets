import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Providers } from './providers'
import './globals.css'

/**
 * Bundled font (Geist Sans). Lives in src/app/fonts/ and is loaded
 * locally — no Google Fonts network round-trip on build or first paint.
 * This makes the build deterministic in offline / air-gapped environments.
 */
const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
})

const removeExtensionHydrationAttrs = `
  document.body?.removeAttribute('data-new-gr-c-s-check-loaded');
  document.body?.removeAttribute('data-gr-ext-installed');
`

export const metadata: Metadata = {
  title: 'Quiksheets',
  description: 'AI-native browser spreadsheet for analysts, founders, and SMB teams.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} bg-background text-foreground`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: removeExtensionHydrationAttrs }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
