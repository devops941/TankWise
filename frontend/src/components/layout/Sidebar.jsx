import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  LineChart,
  Truck,
  CloudRain,
  TrendingUp,
  AlertOctagon,
  FileSpreadsheet,
  Settings,
  Droplets,
  X,
} from 'lucide-react'

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Tanks', path: '/tanks', icon: Database },
  { name: 'Readings', path: '/readings', icon: LineChart },
  { name: 'Refill Hub', path: '/refills', icon: Truck },
  { name: 'Weather & Eco', path: '/weather', icon: CloudRain },
  { name: 'Analysis', path: '/analysis', icon: TrendingUp },
  { name: 'Anomalies', path: '/anomalies', icon: AlertOctagon },
  { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
  { name: 'Settings', path: '/settings', icon: Settings },
]

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Glass Sidebar Panel */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900/60 backdrop-blur-[24px] border-r border-white/10 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Logo Header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#22d3ee] to-[#a78bfa] p-[1.5px] shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-[#22d3ee]">
                  <Droplets className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className="font-heading font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-[#22d3ee] bg-clip-text text-transparent">
                  TankWise
                </span>
                <span className="block text-[10px] uppercase font-bold tracking-widest text-cyan-400/80 -mt-0.5">
                  Intelligence
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="lg:hidden text-white/50 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose && onClose()}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#22d3ee]/20 to-[#a78bfa]/15 text-[#22d3ee] border border-[#22d3ee]/35 shadow-sm shadow-cyan-500/10'
                        : 'text-white/70 hover:text-white hover:bg-white/[0.07] border border-transparent'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Bottom Section: Clean Footer Branding */}
        <div className="p-4 border-t border-white/10">
          <div className="text-[11px] text-white/60 text-center font-medium">
            TankWise <span className="text-cyan-400 font-semibold">v1.0</span>
          </div>
          <div className="text-[10px] text-white/35 text-center mt-1">
            Water Intelligence Platform
          </div>
        </div>
      </aside>
    </>
  )
}
