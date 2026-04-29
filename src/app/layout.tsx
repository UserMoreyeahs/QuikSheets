import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const removeExtensionHydrationAttrs = `
  document.body?.removeAttribute('data-new-gr-c-s-check-loaded');
  document.body?.removeAttribute('data-gr-ext-installed');
`

export const metadata: Metadata = {
  title: 'SheetForge',
  description: 'A powerful spreadsheet application',
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
