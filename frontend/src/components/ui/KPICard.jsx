import GlassCard from './GlassCard'
import clsx from 'clsx'

export default function KPICard({ title, value, unit, delta, deltaLabel, color = '#22d3ee', icon: Icon, loading }) {
  const isPositiveDelta = delta > 0
  return (
    <GlassCard className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-white/50 text-xs uppercase tracking-wider">{title}</span>
        {Icon && <Icon size={16} className="text-white/30" />}
      </div>
      {loading ? (
        <div className="h-8 bg-white/10 rounded animate-pulse" />
      ) : (
        <div className="flex items-end gap-2">
          <span className="font-heading text-2xl font-bold" style={{ color }}>{value ?? '—'}</span>
          {unit && <span className="text-white/40 text-sm mb-0.5">{unit}</span>}
        </div>
      )}
      {deltaLabel && delta != null && (
        <p className={clsx('text-xs', isPositiveDelta ? 'text-[#f87171]' : 'text-[#34d399]')}>
          {isPositiveDelta ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} {deltaLabel}
        </p>
      )}
    </GlassCard>
  )
}
