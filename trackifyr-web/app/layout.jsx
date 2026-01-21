/**
 * @fileoverview Root layout component for Next.js application.
 * Provides global styles and context providers to all pages.
 * @author Muhammad Moin U Din (BCSF22M023)
 * @author Muhammad Junaid Malik (BCSF22M031)
 * @author Muhammad Subhan Ul Haq (BCSF22M043)
 */

import './globals.css'
import Providers from '@/components/Providers'

export const metadata = {
  title: 'trackifyr',
  description: 'trackifyr - Cognitive Load Estimation via Natural Activity Monitoring',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}



