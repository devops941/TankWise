import { useState } from 'react'
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Database,
  Sliders,
  CheckCircle2,
  Server,
  Bell,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTank } from '../contexts/TankContext'
import GlassCard from '../components/ui/GlassCard'
import Button from '../components/ui/Button'

export default function Settings() {
  const { user } = useAuth()
  const { tanks, refreshTanks } = useTank()

  const [units, setUnits] = useState('litres')
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [sensitivity, setSensitivity] = useState('medium')
  const [saved, setSaved] = useState(false)

  const handleSave = (e) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-white">System Settings & Profile</h1>
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Preferences
            </span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">
            Manage unit conversions, anomaly sensitivity thresholds, and cloud infrastructure telemetry
          </p>
        </div>
      </div>

      {/* User Profile Card */}
      <GlassCard>
        <h2 className="font-heading font-bold text-base text-white mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-[#22d3ee]" /> Account Identity
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 bg-white/[0.04] rounded-xl border border-white/10">
            <span className="text-[11px] text-white/50 block">Full Name</span>
            <span className="text-sm font-semibold text-white">{user?.full_name || 'Admin'}</span>
          </div>

          <div className="p-3.5 bg-white/[0.04] rounded-xl border border-white/10">
            <span className="text-[11px] text-white/50 block">Email Address</span>
            <span className="text-sm font-semibold text-white font-mono">{user?.email || 'admin@gmail.com'}</span>
          </div>

          <div className="p-3.5 bg-white/[0.04] rounded-xl border border-white/10">
            <span className="text-[11px] text-white/50 block">Access Role</span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase mt-0.5">
              <Shield className="w-3 h-3" />
              {user?.role || 'Admin'}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Configuration Form */}
      <GlassCard>
        <h2 className="font-heading font-bold text-base text-white mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#a78bfa]" /> Telemetry & Computation Preferences
        </h2>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Default Volumetric Units
              </label>
              <select
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.08] border border-white/15 text-white text-sm focus:outline-none focus:border-[#22d3ee]"
              >
                <option value="litres" className="bg-slate-900 text-white">
                  Metric (Litres &amp; cm)
                </option>
                <option value="gallons" className="bg-slate-900 text-white">
                  Imperial (US Gallons &amp; inches)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">
                Display Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.08] border border-white/15 text-white text-sm focus:outline-none focus:border-[#22d3ee]"
              >
                <option value="Asia/Kolkata" className="bg-slate-900 text-white">
                  Asia/Kolkata (IST, UTC+5:30)
                </option>
                <option value="UTC" className="bg-slate-900 text-white">
                  UTC (Coordinated Universal Time)
                </option>
                <option value="America/New_York" className="bg-slate-900 text-white">
                  America/New_York (EST, UTC-5:00)
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">
              Anomaly Detector Sensitivity
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'low', label: 'Low (Z > 3.5)', desc: 'Only major surges & leaks' },
                { id: 'medium', label: 'Medium (Z > 3.0)', desc: 'Standard balance (recommended)' },
                { id: 'high', label: 'High (Z > 2.5)', desc: 'Strict, reports small variances' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSensitivity(s.id)}
                  className={`p-3 rounded-xl border text-left transition ${
                    sensitivity === s.id
                      ? 'bg-cyan-500/20 border-[#22d3ee] text-white'
                      : 'bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.08]'
                  }`}
                >
                  <p className="text-xs font-bold text-white">{s.label}</p>
                  <p className="text-[10px] text-white/50 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {saved ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Preferences saved successfully!
              </span>
            ) : (
              <span />
            )}
            <Button type="submit" className="px-6">
              Save Preferences
            </Button>
          </div>
        </form>
      </GlassCard>

      {/* Cloud Database & Infrastructure Status */}
      <GlassCard>
        <h2 className="font-heading font-bold text-base text-white mb-4 flex items-center gap-2">
          <Server className="w-4 h-4 text-[#34d399]" /> Cloud Infrastructure &amp; Database
        </h2>

        <div className="space-y-3 text-xs">
          <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-white/50 block">MongoDB Cluster</span>
              <span className="font-semibold text-white font-mono">Cluster0 (uurxkmz.mongodb.net)</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Connected
            </span>
          </div>

          <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-white/50 block">Target Database</span>
              <span className="font-semibold text-white font-mono">tankwise</span>
            </div>
            <span className="text-white/70 font-mono">Motor AsyncIO 3.7.1</span>
          </div>

          <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-white/50 block">Managed Tanks</span>
              <span className="font-semibold text-white">{tanks.length} active tanks</span>
            </div>
            <button
              onClick={() => refreshTanks()}
              className="text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <RefreshCw className="w-3 h-3" /> Sync Now
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
