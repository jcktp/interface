import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import ChatWidget from './ai/ChatWidget'
import { useStore } from '../store'
import { useDataSync } from '../hooks/useDataSync'
import clsx from 'clsx'

export default function Layout() {
  const { darkMode, sidebarCollapsed } = useStore()
  const location = useLocation()
  useDataSync() // Background sync for planning and recruiter data

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <div className="h-screen bg-slate-50 dark:bg-gray-950 flex flex-row overflow-hidden">
      {/* Minimal Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className={clsx(
        "flex-1 flex flex-col min-w-0 h-full transition-all duration-300",
        sidebarCollapsed ? "ml-20" : "ml-64"
      )}>
        <Header />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto overflow-x-hidden">
          <div key={location.pathname} className="w-full page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      
      <ChatWidget />
    </div>
  )
}
