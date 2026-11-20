import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis } from 'recharts'

const SEVERITY_COLORS = { critical: '#f87171', high: '#fb923c', medium: '#fbbf24', low: '#a3e635' }
const SEVERITY_SIZE = { critical: 300, high: 200, medium: 120, low: 60 }

export default function AnomalyScatter({ anomalies }) {
  if (!anomalies?.length) return <div className="h-48 flex items-center justify-center text-white/30 text-sm">No anomalies detected</div>

  const grouped = anomalies.reduce((acc, a) => {
    const color = SEVERITY_COLORS[a.severity] || '#fff'
    if (!acc[a.severity]) acc[a.severity] = []
    acc[a.severity].push({
      time: new Date(a.timestamp).getTime(),
      rate: a.observed ?? 0,
      message: a.message,
      size: SEVERITY_SIZE[a.severity] || 60,
    })
    return acc
  }, {})

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="time" type="number" domain={['auto', 'auto']} tickFormatter={v => new Date(v).toLocaleDateString()} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
          <YAxis dataKey="rate" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
          <ZAxis dataKey="size" range={[40, 300]} />
          <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }} cursor={{ strokeDasharray: '3 3' }} />
          {Object.entries(grouped).map(([severity, data]) => (
            <Scatter key={severity} name={severity} data={data} fill={SEVERITY_COLORS[severity]} opacity={0.8} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
