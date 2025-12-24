'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()

  // Main navigation items
  const mainNavigation = [
    { 
      name: 'Dashboard', 
      href: '/dashboard', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      name: 'Reports', 
      href: '/reports', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
  ]

  // Future navigation sections can be added here
  // const analyticsNavigation = [
  //   { name: 'Analytics', href: '/analytics', icon: ... },
  //   { name: 'Insights', href: '/insights', icon: ... },
  // ]

  const isActive = (path) => pathname === path

  return (
    <aside className="hidden lg:flex lg:flex-shrink-0 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30">
      <div className="flex flex-col w-64 h-full">
        {/* Sidebar Container */}
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
          {/* Logo/Brand Section */}
          <div className="flex items-center h-16 px-6 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-gray-900 leading-tight">trackifyr</h1>
                <p className="text-xs text-gray-500 leading-tight">Cognitive Load Estimation via Natural Activity Monitoring</p>
              </div>
            </div>
          </div>

          {/* Navigation Section */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto min-h-0">
            {/* Main Navigation Group */}
            <div className="space-y-1">
              {mainNavigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg
                    transition-all duration-200
                    ${
                      isActive(item.href)
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <span className={`mr-3 ${
                    isActive(item.href) ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
                  } transition-colors duration-200`}>
                    {item.icon}
                  </span>
                  {item.name}
                  {isActive(item.href) && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600"></span>
                  )}
                </Link>
              ))}
            </div>

            {/* Divider for future sections */}
            {/* <div className="pt-4 mt-4 border-t border-gray-100">
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Analytics
              </p>
              <div className="space-y-1">
                {analyticsNavigation.map((item) => (
                  <Link ... />
                ))}
              </div>
            </div> */}
          </nav>

          {/* Bottom Section - Reserved for future use */}
          {/* <div className="flex-shrink-0 p-4 border-t border-gray-100">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-900 mb-1">Upgrade Plan</p>
              <p className="text-xs text-gray-500 mb-2">Get access to advanced features</p>
              <button className="w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors">
                Upgrade
              </button>
            </div>
          </div> */}
        </div>
      </div>
    </aside>
  )
}
