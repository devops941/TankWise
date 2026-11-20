import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Filter,
  ShieldAlert,
  Moon,
  Zap,
  Radio,
  ArrowUpCircle,
} from 'lucide-react'
import { useTank } from '../contexts/TankContext'
import { anomaliesApi } from '../services/api'
import GlassCard from '../components/ui/GlassCard'
import KPICard from '../components/ui/KPICard'
import AnomalyScatter from '../components/charts/AnomalyScatter'

const typeIcons = {
  night_leak: Moon,
  leak_suspect: Moon,
  rapid_draw: Zap,
  abnormal_draw: Zap,
  sensor_spike: Radio,
  sensor_fault: Radio,
  flatline: Radio,
  statistical_outlier: ShieldAlert,
  outlier: ShieldAlert,
  overflow: ArrowUpCircle,
}

const severityBadges = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
}

const statusBadges = {
  open: 'bg-red-500/15 text-red-400 border-red-500/30',
  acknowledged: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}

export default function Anomalies() {
  const { selectedTankId, selectedTank } = useTank()
  const qc = useQueryClient()
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const { data: anomalyData, isLoading } = useQuery({
    queryKey: ['anomalies', selectedTankId],
    queryFn: () => anomaliesApi.get(selectedTankId).then((r) => r.data),
    enabled: !!selectedTankId,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, timestamp, type, status }) =>
      anomaliesApi.updateStatus(selectedTankId, { id, timestamp, type, status }),
    onSuccess: () => {
      qc.invalidateQueries(['anomalies', selectedTankId])
      qc.invalidateQueries(['calc', selectedTankId])
    },
  })

  const anomalies = anomalyData?.anomalies || []

  const filtered = anomalies.filter((a) => {
    if (filterType !== 'all') {
      if (filterType === 'night_leak') {
        if (a.type !== 'night_leak' && a.type !== 'leak_suspect') return false
      } else if (filterType === 'rapid_draw') {
        if (a.type !== 'rapid_draw' && a.type !== 'abnormal_draw') return false
      } else if (filterType === 'sensor_spike') {
        if (a.type !== 'sensor_spike' && a.type !== 'sensor_fault' && a.type !== 'flatline') return false
      } else if (filterType === 'outlier') {
        if (a.type !== 'statistical_outlier' && a.type !== 'outlier') return false
      } else if (filterType === 'overflow') {
        if (a.type !== 'overflow') return false
      } else if (a.type !== filterType) {
        return false
      }
    }
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    return true
  })

  const countOpen = anomalies.filter((a) => a.status === 'open').length
  const countAck = anomalies.filter((a) => a.status === 'acknowledged').length
  const countResolved = anomalies.filter((a) => a.status === 'resolved').length

  const handleStatusChange = (anomaly, newStatus) => {
    updateStatusMutation.mutate({
      id: anomaly.id,
      timestamp: anomaly.timestamp,
      type: anomaly.type,
      status: newStatus,
    })
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-white">Anomaly Detection & Alerts</h1>
            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Module M5
            </span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">
            Z-score statistics, Isolation Forest ML, and night-leak detection for {selectedTank?.name || 'Tank'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Flagged"
          value={anomalies.length}
          unit="events"
          loading={isLoading}
          icon={AlertOctagon}
          color="#22d3ee"
        />
        <KPICard
          title="Open Actions"
          value={countOpen}
          unit="unresolved"
          loading={isLoading}
          icon={AlertTriangle}
          color={countOpen > 0 ? '#f87171' : '#34d399'}
        />
        <KPICard
          title="Acknowledged"
          value={countAck}
          unit="investigating"
          loading={isLoading}
          icon={Clock}
          color="#fbbf24"
        />
        <KPICard
          title="Resolved"
          value={countResolved}
          unit="closed"
          loading={isLoading}
          icon={CheckCircle2}
          color="#34d399"
        />
      </div>

      {/* Anomaly Scatter Plot */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-base text-white">Telemetry Anomaly Map</h3>
            <p className="text-xs text-white/50">Timestamp vs. Severity classification across detection algorithms</p>
          </div>
          <span className="text-xs font-semibold text-white/50 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            {filtered.length} visible
          </span>
        </div>
        <AnomalyScatter anomalies={filtered} />
      </GlassCard>

      {/* Filter Tabs & Anomaly List */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
          {/* Type Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Types' },
              { id: 'outlier', label: '🔍 Outliers & Spikes' },
              { id: 'night_leak', label: '🌙 Night Leaks' },
              { id: 'rapid_draw', label: '⚡ Rapid Draw' },
              { id: 'sensor_spike', label: '📡 Sensor Faults' },
              { id: 'overflow', label: '🌊 Overflow' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id)}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium transition ${
                  filterType === t.id
                    ? 'bg-[#22d3ee] text-slate-900 font-bold shadow-sm'
                    : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.12]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1 bg-white/[0.05] p-1 rounded-xl border border-white/10 self-start sm:self-auto">
            {['all', 'open', 'acknowledged', 'resolved'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-[11px] px-2.5 py-1 rounded-lg capitalize transition ${
                  filterStatus === s
                    ? 'bg-purple-500/30 text-purple-200 font-bold border border-purple-400/40'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Anomaly Cards List */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-xs">
              No anomalies found matching current filters.
            </div>
          ) : (
            filtered.map((a, idx) => {
              const Icon = typeIcons[a.type] || ShieldAlert
              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center text-[#22d3ee] flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-white">{a.message}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${severityBadges[a.severity]}`}>
                          {a.severity}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${statusBadges[a.status]}`}>
                          {a.status}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 font-mono">
                        {new Date(a.timestamp).toLocaleString()} • Type: {a.type} • Method: {a.method}
                      </p>
                    </div>
                  </div>

                  {/* Status Toggle Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0">
                    {a.status !== 'open' && (
                      <button
                        onClick={() => handleStatusChange(a, 'open')}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-300 hover:bg-red-500/10 border border-red-500/20"
                      >
                        Re-open
                      </button>
                    )}
                    {a.status !== 'acknowledged' && (
                      <button
                        onClick={() => handleStatusChange(a, 'acknowledged')}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-yellow-300 hover:bg-yellow-500/10 border border-yellow-500/20"
                      >
                        Acknowledge
                      </button>
                    )}
                    {a.status !== 'resolved' && (
                      <button
                        onClick={() => handleStatusChange(a, 'resolved')}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </GlassCard>
    </div>
  )
}
