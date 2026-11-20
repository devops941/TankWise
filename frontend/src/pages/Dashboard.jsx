import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Droplets,
  TrendingDown,
  Clock,
  AlertTriangle,
  RefreshCw,
  Plus,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Upload,
  Truck,
  CloudRain,
} from 'lucide-react'
import { calcApi, analyticsApi, anomaliesApi, readingsApi, tanksApi } from '../services/api'
import { useTank } from '../contexts/TankContext'
import { UploadModal } from './Readings'
import GlassCard from '../components/ui/GlassCard'
import KPICard from '../components/ui/KPICard'
import Button from '../components/ui/Button'
import LevelTimeline from '../components/charts/LevelTimeline'
import ConsumptionBar from '../components/charts/ConsumptionBar'
import RefillHistogram from '../components/charts/RefillHistogram'
import AnomalyScatter from '../components/charts/AnomalyScatter'

function SeverityChip({ severity }) {
  const colors = {
    critical: 'bg-[#f87171]/20 text-[#f87171] border border-red-500/30',
    high: 'bg-orange-400/20 text-orange-400 border border-orange-500/30',
    medium: 'bg-[#fbbf24]/20 text-[#fbbf24] border border-amber-500/30',
    low: 'bg-[#a3e635]/20 text-[#a3e635] border border-lime-500/30',
  }
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
        colors[severity] || 'bg-white/10 text-white/60'
      }`}
    >
      {severity}
    </span>
  )
}

export default function Dashboard() {
  const { tankId: paramTankId } = useParams()
  const { selectedTankId, selectedTank, dateRange, selectTank, tanks } = useTank()
  const [showUploadModal, setShowUploadModal] = useState(false)

  const activeTankId = paramTankId || selectedTankId || (tanks.length > 0 ? tanks[0].id : null)
  const presetDays = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365
  const fromDate = new Date(Date.now() - presetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: tank } = useQuery({
    queryKey: ['tank', activeTankId],
    queryFn: () => tanksApi.get(activeTankId).then((r) => r.data),
    enabled: !!activeTankId,
  })

  const {
    data: calc,
    isLoading: calcLoading,
    refetch: refetchCalc,
  } = useQuery({
    queryKey: ['calc', activeTankId, presetDays],
    queryFn: () => calcApi.get(activeTankId, { from_date: fromDate }).then((r) => r.data),
    enabled: !!activeTankId,
  })

  const { data: readings = [] } = useQuery({
    queryKey: ['readings', activeTankId, presetDays],
    queryFn: () => readingsApi.list(activeTankId, 1000).then((r) => r.data),
    enabled: !!activeTankId,
  })

  const { data: analytics } = useQuery({
    queryKey: ['analytics', activeTankId],
    queryFn: () => analyticsApi.get(activeTankId).then((r) => r.data),
    enabled: !!activeTankId,
  })

  const { data: anomalyData } = useQuery({
    queryKey: ['anomalies', activeTankId],
    queryFn: () => anomaliesApi.get(activeTankId).then((r) => r.data),
    enabled: !!activeTankId,
  })

  const kpis = calc?.kpis || {}
  const anomalies = anomalyData?.anomalies || []
  const openAnomalies = anomalies.filter((a) => a.status === 'open')

  // Empty state if no tanks exist
  if (!activeTankId && tanks.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center py-12 px-4">
        <GlassCard className="w-full max-w-md flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center mb-4 text-[#22d3ee]">
            <Droplets className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-heading text-white mb-2">No Water Tanks Registered</h2>
          <p className="text-white/60 text-sm mb-6 max-w-sm leading-relaxed">
            Please register your water tank to start monitoring water levels, tracking consumption, and viewing intelligence reports.
          </p>
          <Link to="/tanks" className="inline-flex justify-center">
            <Button>
              <Plus className="w-4 h-4 mr-1.5" /> Register Tank
            </Button>
          </Link>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.04] border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#22d3ee]/15 border border-[#22d3ee]/30 flex items-center justify-center text-[#22d3ee] shadow-sm">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-white">
                {tank?.name || 'Water Tank Dashboard'}
              </h1>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {tank?.shape || 'Cylindrical'}
              </span>
            </div>
            <p className="text-xs text-white/50">
              {tank?.location ? `${tank.location} • ` : ''}
              Capacity: {tank?.capacity_litres ? `${Math.round(tank.capacity_litres)} L` : '—'} • Sensor Mode: {tank?.sensor_mode || 'depth'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="ghost" onClick={() => refetchCalc()} className="text-xs py-2 px-3">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <Button variant="secondary" onClick={() => setShowUploadModal(true)} className="text-xs py-2 px-3">
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload CSV
          </Button>
        </div>
      </div>

      {/* 4 Primary KPI Cards (Figure 4.1) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Current Level"
          value={kpis.current_level_pct != null ? kpis.current_level_pct.toFixed(1) : '—'}
          unit="%"
          loading={calcLoading}
          icon={Droplets}
          color={kpis.current_level_pct <= (tank?.low_threshold_pct || 20) ? '#f87171' : '#22d3ee'}
        />
        <KPICard
          title="Avg Daily Use"
          value={kpis.avg_daily_litres != null ? kpis.avg_daily_litres.toFixed(0) : '—'}
          unit="L/day"
          loading={calcLoading}
          icon={TrendingDown}
          color="#34d399"
        />
        <KPICard
          title="Next Refill ETA"
          value={kpis.days_to_empty != null ? kpis.days_to_empty.toFixed(1) : '—'}
          unit="days"
          loading={calcLoading}
          icon={Clock}
          color={kpis.days_to_empty != null && kpis.days_to_empty < 2 ? '#f87171' : '#fbbf24'}
        />
        <KPICard
          title="Anomalies"
          value={openAnomalies.length}
          unit="open"
          loading={false}
          icon={AlertTriangle}
          color={openAnomalies.length > 0 ? '#f87171' : '#34d399'}
        />
      </div>

      {/* Secondary KPI Cards (Volume & Refill Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Current Volume"
          value={kpis.current_volume_litres != null ? Math.round(kpis.current_volume_litres) : '—'}
          unit="L"
          loading={calcLoading}
          color="#a78bfa"
        />
        <KPICard
          title="Refills Detected"
          value={kpis.refill_count ?? '—'}
          unit="cycles"
          loading={calcLoading}
          color="#22d3ee"
        />
        <KPICard
          title="Avg Refill Interval"
          value={kpis.avg_refill_interval_hours != null ? kpis.avg_refill_interval_hours.toFixed(0) : '—'}
          unit="hours"
          loading={calcLoading}
          color="#a78bfa"
        />
        <KPICard
          title="Hourly Consumption"
          value={kpis.avg_rate_lph != null ? kpis.avg_rate_lph.toFixed(1) : '—'}
          unit="L/hr"
          loading={calcLoading}
          color="#34d399"
        />
      </div>

      {/* Intelligence & Automation Modules Callout Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/refills">
          <GlassCard className="p-4 hover:border-cyan-400/40 transition group cursor-pointer bg-gradient-to-r from-cyan-950/20 via-slate-900/40 to-slate-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition flex items-center gap-1.5">
                    Smart Refill & Vendor Logistics
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30">
                      NEW
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Automated tanker booking, sensor verification & water expenses
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition" />
            </div>
          </GlassCard>
        </Link>

        <Link to="/weather">
          <GlassCard className="p-4 hover:border-cyan-400/40 transition group cursor-pointer bg-gradient-to-r from-blue-950/20 via-slate-900/40 to-slate-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition">
                  <CloudRain className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition flex items-center gap-1.5">
                    Weather & Rainwater Harvesting
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                      NEW
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    7-day rainfall forecast, catchment yield & tanker delay advisory
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition" />
            </div>
          </GlassCard>
        </Link>
      </div>

      {/* Level Timeline (2/3 width) + Consumption Bars (1/3 width) (Section 4.7) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <GlassCard className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-base text-white">Level Timeline with Refill Markers</h3>
                <p className="text-xs text-white/50">Water depth percentage and detected refill cycles</p>
              </div>
              <span className="text-[11px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 font-medium">
                {readings.length} data points
              </span>
            </div>
            <LevelTimeline
              readings={readings.slice().reverse().slice(0, 500)}
              refillEvents={calc?.refill_events || []}
              lowThreshold={tank?.low_threshold_pct || 20}
              highThreshold={tank?.high_threshold_pct || 90}
            />
          </GlassCard>
        </div>

        <div className="lg:col-span-4">
          <GlassCard className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-base text-white">Daily Drawdown (L)</h3>
                <p className="text-xs text-white/50">Aggregated net withdrawal per calendar day</p>
              </div>
            </div>
            <ConsumptionBar dailyTotals={calc?.daily_totals || {}} />
          </GlassCard>
        </div>
      </div>

      {/* Refill Intervals & Anomaly Scatter Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-base text-white">Refill Interval Distribution</h3>
              <p className="text-xs text-white/50">Histogram of hours between consecutive refills</p>
            </div>
          </div>
          <RefillHistogram refillEvents={calc?.refill_events || []} />
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-base text-white">Anomaly Scatter Map</h3>
              <p className="text-xs text-white/50">Z-score & Isolation Forest outliers by timestamp</p>
            </div>
            <Link to={`/anomalies?tankId=${activeTankId}`} className="text-xs text-[#22d3ee] hover:underline font-medium">
              View All →
            </Link>
          </div>
          <AnomalyScatter anomalies={anomalies} />
        </GlassCard>
      </div>

      {/* Recent Refills & Drill-down Table (Figure 4.1) */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-base text-white">Recent Refill Events</h3>
            <p className="text-xs text-white/50">Automated cycle analysis: volume added, duration & intervals</p>
          </div>
          <Link to={`/reports?tankId=${activeTankId}`} className="text-xs text-[#22d3ee] hover:underline font-semibold flex items-center gap-1">
            Export Report <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase font-semibold">
                <th className="py-2.5 px-3">Start Window</th>
                <th className="py-2.5 px-3">End Window</th>
                <th className="py-2.5 px-3">Vol Before</th>
                <th className="py-2.5 px-3">Vol After</th>
                <th className="py-2.5 px-3">Added</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Interval</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!calc?.refill_events || calc.refill_events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-white/40">
                    No refill events recorded in this period.
                  </td>
                </tr>
              ) : (
                calc.refill_events.slice(0, 8).map((ev, i) => (
                  <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-2.5 px-3 font-mono text-white/80">
                      {new Date(ev.start_ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-white/60">
                      {new Date(ev.end_ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 px-3 text-white/70">{Math.round(ev.volume_before_litres)} L</td>
                    <td className="py-2.5 px-3 text-white/70">{Math.round(ev.volume_after_litres)} L</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">+{Math.round(ev.volume_added_litres)} L</td>
                    <td className="py-2.5 px-3 text-white/60">{Math.round(ev.duration_minutes)} min</td>
                    <td className="py-2.5 px-3 text-cyan-300 font-medium">
                      {ev.interval_since_prev_hours ? `${ev.interval_since_prev_hours.toFixed(1)} h` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <ShieldCheck className="w-2.5 h-2.5" /> OK
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {showUploadModal && (
        <UploadModal tankId={activeTankId} onClose={() => setShowUploadModal(false)} />
      )}
    </div>
  )
}
