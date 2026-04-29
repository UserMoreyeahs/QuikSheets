import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={`${inter.className} bg-background text-foreground`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: removeExtensionHydrationAttrs }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
