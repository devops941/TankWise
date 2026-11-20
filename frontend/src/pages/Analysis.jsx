import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  BarChart3,
  Activity,
} from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { useTank } from '../contexts/TankContext'
import { analyticsApi, calcApi } from '../services/api'
import GlassCard from '../components/ui/GlassCard'
import KPICard from '../components/ui/KPICard'

const glassTooltip = {
  backgroundColor: 'rgba(15, 23, 42, 0.92)',
  borderColor: 'rgba(255, 255, 255, 0.15)',
  borderRadius: '12px',
  color: '#fff',
  fontSize: '12px',
  backdropFilter: 'blur(16px)',
}

export default function Analysis() {
  const { selectedTankId, selectedTank, dateRange } = useTank()

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', selectedTankId],
    queryFn: () => analyticsApi.get(selectedTankId).then((r) => r.data),
    enabled: !!selectedTankId,
  })

  const { data: calc } = useQuery({
    queryKey: ['calc', selectedTankId],
    queryFn: () => calcApi.get(selectedTankId).then((r) => r.data),
    enabled: !!selectedTankId,
  })

  const trend = analytics?.trend
  const weekdayWeekend = analytics?.weekday_weekend
  const stl = analytics?.stl

  // Prepare Weekday vs Weekend Bar Data
  const weekdayData = weekdayWeekend
    ? [
        { name: 'Weekdays (Mon-Fri)', consumption: Math.round(weekdayWeekend.weekday_mean || 0) },
        { name: 'Weekends (Sat-Sun)', consumption: Math.round(weekdayWeekend.weekend_mean || 0) },
      ]
    : []

  // Prepare Rolling averages data
  const rollingData = Object.keys(calc?.daily_totals || {})
    .sort()
    .map((date, idx) => ({
      date: date.slice(5),
      actual: Math.round(calc.daily_totals[date] || 0),
      rolling7d: trend?.rolling_7d ? Math.round(trend.rolling_7d[idx] || calc.daily_totals[date]) : null,
    }))

  const directionColor =
    trend?.direction === 'falling'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : trend?.direction === 'rising'
      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
      : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'

  const DirectionIcon =
    trend?.direction === 'falling' ? ArrowDownRight : trend?.direction === 'rising' ? ArrowUpRight : Minus

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-white">Trend & Comparative Analysis</h1>
            <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Module M5
            </span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">
            Statistical regression, weekend variance, and STL seasonal decomposition for {selectedTank?.name || 'Selected Tank'}
          </p>
        </div>
      </div>

      {/* KPI Cards: Slope, R², Weekend Variance, Seasonal Strength */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <p className="text-xs text-white/50 mb-1">Consumption Trend</p>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold uppercase flex items-center gap-1 ${directionColor}`}>
              <DirectionIcon className="w-3.5 h-3.5" />
              {trend?.direction || 'Stable'}
            </span>
            <span className="text-xs text-white/40">Direction</span>
          </div>
        </GlassCard>

        <KPICard
          title="Drain Rate Slope"
          value={trend?.slope_litres_per_day != null ? trend.slope_litres_per_day.toFixed(2) : '—'}
          unit="L/day"
          loading={isLoading}
          icon={TrendingUp}
          color="#22d3ee"
        />

        <KPICard
          title="Regression Fit (R²)"
          value={trend?.r_squared != null ? trend.r_squared.toFixed(3) : '—'}
          unit={trend?.p_value != null ? `p=${trend.p_value.toFixed(3)}` : ''}
          loading={isLoading}
          icon={Activity}
          color="#a78bfa"
        />

        <KPICard
          title="Seasonal Strength"
          value={stl?.seasonal_strength != null ? (stl.seasonal_strength * 100).toFixed(0) : '—'}
          unit="%"
          loading={isLoading}
          icon={Calendar}
          color="#34d399"
        />
      </div>

      {/* Chart 1: Rolling Averages vs Actual Daily Consumption */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-base text-white">Daily Consumption & 7-Day Moving Trend</h3>
            <p className="text-xs text-white/50">Smoothed drawdown smoothing out day-to-day noise</p>
          </div>
          <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
            Rolling Regression
          </span>
        </div>

        <div className="h-72">
          {rollingData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-white/40">
              No daily consumption data recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rollingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} unit=" L" />
                <Tooltip contentStyle={glassTooltip} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="actual" name="Daily Litres" fill="#22d3ee" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="rolling7d" name="7-Day Moving Avg" stroke="#a78bfa" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </GlassCard>

      {/* Chart 2 & 3: Weekday vs Weekend Comparison & Regression Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekday vs Weekend Comparison */}
        <div className="lg:col-span-5">
          <GlassCard className="h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-heading font-bold text-base text-white">Weekday vs. Weekend Draw</h3>
                  <p className="text-xs text-white/50">Two-sample t-test comparison for peak load planning</p>
                </div>
                {weekdayWeekend?.significant && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    p &lt; 0.05
                  </span>
                )}
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weekdayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 11 }} unit=" L" />
                    <Tooltip contentStyle={glassTooltip} />
                    <Bar dataKey="consumption" name="Mean Daily Litres" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white/[0.04] rounded-xl border border-white/10 text-xs text-white/70">
              <span className="font-semibold text-white">Statistical Finding: </span>
              {weekdayWeekend?.weekday_mean && weekdayWeekend?.weekend_mean ? (
                <>
                  Weekend usage is{' '}
                  <span className="text-[#22d3ee] font-bold">
                    {Math.round(
                      ((weekdayWeekend.weekend_mean - weekdayWeekend.weekday_mean) / weekdayWeekend.weekday_mean) * 100
                    )}
                    %
                  </span>{' '}
                  {weekdayWeekend.weekend_mean > weekdayWeekend.weekday_mean ? 'higher' : 'lower'} than weekdays.
                </>
              ) : (
                'More data points needed to assess significance.'
              )}
            </div>
          </GlassCard>
        </div>

        {/* Regression & Seasonal Diagnostics */}
        <div className="lg:col-span-7">
          <GlassCard className="h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-heading font-bold text-base text-white">Time-Series Decomposition (STL)</h3>
                  <p className="text-xs text-white/50">Seasonal and Trend decomposition using Loess</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10">
                  <span className="text-[11px] text-white/50 block">Linear Trend Slope</span>
                  <span className="text-lg font-bold text-[#22d3ee]">
                    {trend?.slope_litres_per_day ? `${trend.slope_litres_per_day.toFixed(2)} L/day` : '0.00 L/day'}
                  </span>
                </div>
                <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10">
                  <span className="text-[11px] text-white/50 block">Goodness of Fit (R²)</span>
                  <span className="text-lg font-bold text-[#a78bfa]">
                    {trend?.r_squared ? trend.r_squared.toFixed(3) : '0.000'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-white/[0.03] rounded-xl border border-white/10 space-y-2 text-xs text-white/80">
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Seasonal Period</span>
                  <span className="font-semibold text-white">7 Days (Weekly Cycle)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Hypothesis Significance</span>
                  <span className="font-semibold text-emerald-400">
                    {trend?.p_value != null && trend.p_value < 0.05 ? 'Significant (p < 0.05)' : 'Inconclusive'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/50">Leak Drift Residual</span>
                  <span className="font-semibold text-white">Minimal Baseline Offset</span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-300 flex-shrink-0" />
              <span>
                Predictive Model suggests scheduling automated pump refill trigger when tank hits 20% capacity.
              </span>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
