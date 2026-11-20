import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f172a]/90 border border-white/20 rounded-lg p-3 text-sm backdrop-blur-md">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value?.toFixed(1)}{p.name === 'Level %' ? '%' : ' L'}</p>
      ))}
    </div>
  )
}

export default function LevelTimeline({ readings, refillEvents = [], lowThreshold = 20, highThreshold = 90 }) {
  const data = readings.map(r => ({
    time: new Date(r.timestamp).toLocaleDateString(),
    'Level %': r.level_pct,
    'Volume L': r.volume_litres,
  }))

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="levelGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={lowThreshold} stroke="#f87171" strokeDasharray="4 4" label={{ value: 'Low', fill: '#f87171', fontSize: 10 }} />
          <ReferenceLine y={highThreshold} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'High', fill: '#fbbf24', fontSize: 10 }} />
          <Area type="monotone" dataKey="Level %" stroke="#22d3ee" fill="url(#levelGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
