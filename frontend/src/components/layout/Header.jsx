import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Menu,
  ChevronDown,
  Download,
  Plus,
  LogOut,
  User,
  Droplets,
  Calendar,
  Check,
  Shield,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTank } from '../../contexts/TankContext'
import { reportsApi } from '../../services/api'

export default function Header({ onMenuClick }) {
  const { user, logout } = useAuth()
  const { tanks, selectedTankId, selectedTank, dateRange, selectTank, changeDateRange } = useTank()
  const navigate = useNavigate()

  const [tankMenuOpen, setTankMenuOpen] = useState(false)
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const tankRef = useRef(null)
  const rangeRef = useRef(null)
  const exportRef = useRef(null)
  const userRef = useRef(null)

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (tankRef.current && !tankRef.current.contains(e.target)) setTankMenuOpen(false)
      if (rangeRef.current && !rangeRef.current.contains(e.target)) setRangeMenuOpen(false)
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportMenuOpen(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (format) => {
    if (!selectedTankId) {
      alert('Please select or add a tank first.')
      return
    }
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365
    setDownloading(true)
    setExportMenuOpen(false)
    try {
      const url = reportsApi.exportUrl(selectedTankId, format, days)
      const token = localStorage.getItem('tw_token')
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) throw new Error('Export generation failed')

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${selectedTank?.name || 'tank'}_export.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setDownloading(false)
    }
  }

  const dateLabels = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    'all': 'All time',
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/60 backdrop-blur-[24px] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile hamburger & Active Tank selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Tank Selector Dropdown */}
        <div className="relative" ref={tankRef}>
          <button
            onClick={() => setTankMenuOpen(!tankMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 text-sm font-medium text-white transition-all shadow-sm"
          >
            <Droplets className="w-4 h-4 text-[#22d3ee]" />
            <span className="font-semibold text-white/90">
              {selectedTank ? `Tank: ${selectedTank.name}` : 'Select Tank'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-white/50" />
          </button>

          {tankMenuOpen && (
            <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-slate-900/95 backdrop-blur-[24px] border border-white/15 shadow-2xl p-1.5 z-50 animate-fade-in">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                Switch Tank
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {tanks.length === 0 ? (
                  <div className="p-3 text-xs text-white/50 text-center">No tanks yet</div>
                ) : (
                  tanks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        selectTank(t.id)
                        setTankMenuOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                        t.id === selectedTankId
                          ? 'bg-[#22d3ee]/20 text-[#22d3ee] font-semibold'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span>{t.name}</span>
                        <span className="text-[10px] text-white/40">
                          {t.capacity_litres ? `${Math.round(t.capacity_litres)} L` : ''} • {t.shape}
                        </span>
                      </div>
                      {t.id === selectedTankId && <Check className="w-3.5 h-3.5 text-[#22d3ee]" />}
                    </button>
                  ))
                )}
              </div>
              <div className="mt-1 pt-1 border-t border-white/10">
                <Link
                  to="/tanks"
                  onClick={() => setTankMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#22d3ee] hover:bg-white/10 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Manage / Add Tanks
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Date Range Selector, Export button, User Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date Range Selector */}
        <div className="relative hidden sm:block" ref={rangeRef}>
          <button
            onClick={() => setRangeMenuOpen(!rangeMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 text-xs font-medium text-white/80 transition-all"
          >
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span>Range: {dateLabels[dateRange] || 'Last 30 days'}</span>
            <ChevronDown className="w-3 h-3 text-white/50" />
          </button>

          {rangeMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-slate-900/95 backdrop-blur-[24px] border border-white/15 shadow-2xl p-1.5 z-50">
              {['7d', '30d', '90d', 'all'].map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    changeDateRange(r)
                    setRangeMenuOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                    dateRange === r
                      ? 'bg-purple-500/20 text-purple-300 font-semibold'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span>{dateLabels[r]}</span>
                  {dateRange === r && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Export Button */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#22d3ee]/20 to-[#a78bfa]/20 hover:from-[#22d3ee]/30 hover:to-[#a78bfa]/30 border border-[#22d3ee]/40 text-xs font-semibold text-[#22d3ee] transition shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-3 h-3 text-[#22d3ee]/70" />
          </button>

          {exportMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-slate-900/95 backdrop-blur-[24px] border border-white/15 shadow-2xl p-1.5 z-50">
              <div className="px-3 py-1 text-[10px] font-semibold text-white/40 uppercase">
                Download Report
              </div>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-white/80 hover:bg-white/10 flex items-center justify-between"
              >
                <span>📄 PDF Summary</span>
                <span className="text-[10px] text-cyan-400 font-bold">PDF</span>
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-white/80 hover:bg-white/10 flex items-center justify-between"
              >
                <span>📊 Excel Workbook</span>
                <span className="text-[10px] text-emerald-400 font-bold">XLSX</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-white/80 hover:bg-white/10 flex items-center justify-between"
              >
                <span>📑 Raw CSV</span>
                <span className="text-[10px] text-yellow-400 font-bold">CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#22d3ee] to-[#6366f1] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="hidden md:inline text-xs font-semibold text-white/90 pr-1">
              {user?.full_name?.split(' ')[0] || 'User'}
            </span>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900/95 backdrop-blur-[24px] border border-white/15 shadow-2xl p-2 z-50">
              <div className="px-3 py-2 border-b border-white/10">
                <p className="text-xs font-bold text-white truncate">{user?.full_name}</p>
                <p className="text-[11px] text-white/50 truncate">{user?.email}</p>
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-[#22d3ee] bg-[#22d3ee]/10 px-2 py-0.5 rounded-full">
                  <Shield className="w-2.5 h-2.5" />
                  {user?.role?.toUpperCase() || 'USER'}
                </span>
              </div>
              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-white/80 hover:bg-white/10"
                >
                  <User className="w-3.5 h-3.5 text-white/60" />
                  Profile & Preferences
                </Link>
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    logout()
                    navigate('/login')
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
