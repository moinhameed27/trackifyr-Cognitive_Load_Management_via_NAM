/**
 * @fileoverview Header component - displays page title, subtitle, current time,
 * and user profile dropdown.
 * @author Muhammad Moin U Din (BCSF22M023)
 * @author Muhammad Junaid Malik (BCSF22M031)
 * @author Muhammad Subhan Ul Haq (BCSF22M043)
 */

'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import UserProfileDropdown from './UserProfileDropdown'

const TIME_UPDATE_INTERVAL = 1000

export default function Header({ title, subtitle }) {
  const { user } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, TIME_UPDATE_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
      <div className="px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{title}</h1>
              {subtitle && (
                <p className="text-sm text-gray-500 leading-tight">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-500 leading-tight">Current Time</p>
              <p className="text-base font-semibold text-gray-900 leading-tight">
                {currentTime.toLocaleTimeString()}
              </p>
            </div>
            <UserProfileDropdown />
          </div>
        </div>
      </div>
    </header>
  )
}

