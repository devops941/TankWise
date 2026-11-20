import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-x-hidden font-sans">
      {/* Background Animated Floating Blobs (Section 4.4 & 4.7) */}
      <div className="blob blob-cyan" />
      <div className="blob blob-violet" />

      {/* Glass Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area (offset by sidebar width on desktop) */}
      <div className="lg:pl-64 flex flex-col min-h-screen relative z-10">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 w-full animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
