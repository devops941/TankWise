import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'

export default function RefillHistogram({ refillEvents }) {
  if (!refillEvents?.length) return <div className="h-40 flex items-center justify-center text-white/30 text-sm">No refill data</div>
  const intervals = refillEvents.filter(e => e.interval_since_prev_hours != null).map(e => e.interval_since_prev_hours)
  if (!intervals.length) return <div className="h-40 flex items-center justify-center text-white/30 text-sm">Need 2+ refills for interval data</div>
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const max = Math.max(...intervals)
  const bins = 10
  const binSize = max / bins
  const histogram = Array.from({ length: bins }, (_, i) => ({
    range: `${Math.round(i * binSize)}–${Math.round((i + 1) * binSize)}h`,
    count: intervals.filter(v => v >= i * binSize && v < (i + 1) * binSize).length,
  }))

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={histogram} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="range" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} allowDecimals={false} />
          <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }} />
          <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
