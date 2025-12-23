import './globals.css'
import Providers from '@/components/Providers'

export const metadata = {
  title: 'AI-Based Cognitive Load Estimation',
  description: 'Final Year Project - Cognitive Load Monitoring System',
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



