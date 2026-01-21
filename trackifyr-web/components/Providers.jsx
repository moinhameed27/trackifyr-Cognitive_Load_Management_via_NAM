/**
 * @fileoverview Providers component - wraps application with context providers.
 * @author Muhammad Moin U Din (BCSF22M023)
 * @author Muhammad Junaid Malik (BCSF22M031)
 * @author Muhammad Subhan Ul Haq (BCSF22M043)
 */

'use client'

import { AuthProvider } from '@/context/AuthContext'

export default function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}



