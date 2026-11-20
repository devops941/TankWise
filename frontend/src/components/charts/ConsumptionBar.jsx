import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export default function ConsumptionBar({ dailyTotals }) {
  const data = Object.entries(dailyTotals || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, litres]) => ({
      date: date.slice(5),
      litres: Math.round(litres),
    }))

  if (!data.length) return <div className="h-48 flex items-center justify-center text-white/30 text-sm">No consumption data</div>

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} interval={6} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
          <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }} labelStyle={{ color: 'rgba(255,255,255,0.6)' }} />
          <Bar dataKey="litres" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
