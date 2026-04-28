import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Alkera AI',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>
        <div id="app">{children}</div>
      </body>
    </html>
  )
}
