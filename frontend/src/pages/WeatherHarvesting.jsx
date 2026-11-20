import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CloudRain,
  Sun,
  CloudSun,
  CloudLightning,
  Cloud,
  Droplets,
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react'
import { useTank } from '../contexts/TankContext'
import { weatherApi, calcApi } from '../services/api'
import GlassCard from '../components/ui/GlassCard'
import KPICard from '../components/ui/KPICard'

const weatherIcons = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  'cloud-drizzle': CloudRain,
  'cloud-lightning': CloudLightning,
  'cloud-fog': Cloud,
}

export default function WeatherHarvesting() {
  const { selectedTankId, selectedTank } = useTank()
  const qc = useQueryClient()

  const [roofArea, setRoofArea] = useState(800)
  const [rainfallSimMm, setRainfallSimMm] = useState(30)
  const [toastMessage, setToastMessage] = useState('')

  const { data: analysis, isLoading, isError } = useQuery({
    queryKey: ['weatherAnalysis', selectedTankId, roofArea],
    queryFn: async () => {
      if (!selectedTankId) return null
      const res = await weatherApi.getAnalysis(selectedTankId, roofArea)
      return res.data
    },
    enabled: !!selectedTankId,
  })

  const { data: calc } = useQuery({
    queryKey: ['calc', selectedTankId],
    queryFn: async () => {
      if (!selectedTankId) return null
      const res = await calcApi.get(selectedTankId)
      return res.data
    },
    enabled: !!selectedTankId,
  })

  const simulateRainMutation = useMutation({
    mutationFn: (mm) => weatherApi.simulateRain(selectedTankId, mm),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['calc'] })
      qc.invalidateQueries({ queryKey: ['readings'] })
      qc.invalidateQueries({ queryKey: ['weatherAnalysis'] })
      showToast(res.data.message || 'Rainwater harvest simulation complete!')
    },
  })

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 5000)
  }

  const advisory = analysis?.advisory

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-400/40 text-emerald-300 px-5 py-3 rounded-xl shadow-2xl shadow-emerald-500/20 flex items-center gap-3 backdrop-blur-md animate-bounce">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white flex items-center gap-2.5">
            <CloudRain className="w-7 h-7 text-cyan-400" />
            Weather-Driven Demand & Rainwater Optimizer
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time weather forecasts, roof catchment yield prediction & smart refill advisories
          </p>
        </div>

        {selectedTank && (
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Target Tank: <strong className="text-white">{selectedTank.name}</strong> ({selectedTank.capacity_litres}L)</span>
          </div>
        )}
      </div>

      {/* Smart Advisory Banner */}
      {advisory && (
        <GlassCard
          className={`p-5 border transition ${
            advisory.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/40'
              : advisory.type === 'danger'
              ? 'bg-rose-950/30 border-rose-500/40'
              : advisory.type === 'warning'
              ? 'bg-amber-950/30 border-amber-500/40'
              : 'bg-cyan-950/30 border-cyan-500/40'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  advisory.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : advisory.type === 'danger'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-cyan-500/20 text-cyan-400'
                }`}
              >
                {advisory.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : advisory.type === 'danger' ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <CloudRain className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {advisory.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
                  {advisory.message}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <div className="text-right">
                <span className="block text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  48h Inflow Potential
                </span>
                <span className="text-lg font-extrabold text-cyan-300">
                  +{advisory.next_48h_harvest_litres} L
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="7-Day Total Rain"
          value={analysis?.total_7day_rainfall_mm != null ? `${analysis.total_7day_rainfall_mm} mm` : '--'}
          subtitle="Forecasted precipitation"
          icon={CloudRain}
          color="cyan"
        />
        <KPICard
          title="Predicted Rainwater Yield"
          value={analysis?.total_7day_harvest_litres != null ? `${analysis.total_7day_harvest_litres.toLocaleString()} L` : '--'}
          subtitle={`On ${roofArea} sq.ft catchment`}
          icon={Droplets}
          color="blue"
        />
        <KPICard
          title="Tank Refill Potential"
          value={analysis?.tank_capacity_fill_pct != null ? `${analysis.tank_capacity_fill_pct}%` : '--'}
          subtitle="Of total tank capacity"
          icon={TrendingUp}
          color="emerald"
        />
        <KPICard
          title="Water Expense Saved"
          value={analysis?.estimated_money_saved_inr != null ? `₹${analysis.estimated_money_saved_inr}` : '--'}
          subtitle="vs Commercial Tanker rates"
          icon={DollarSign}
          color="violet"
        />
      </div>

      {/* Interactive Roof Catchment Calculator & Live Rain Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Roof Catchment Slider */}
        <GlassCard className="p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                Catchment Area & Yield Calculator
              </h2>
              <p className="text-xs text-slate-400">
                Formula: Catchment Area (sq.m) × Rainfall (mm) × Runoff Efficiency (0.85)
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-cyan-400">{roofArea}</span>
              <span className="text-xs text-slate-400 ml-1">sq.ft</span>
            </div>
          </div>

          <div className="space-y-3 py-2">
            <input
              type="range"
              min="200"
              max="3000"
              step="50"
              value={roofArea}
              onChange={(e) => setRoofArea(parseInt(e.target.value))}
              className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span>Small Terrace (200 sq.ft)</span>
              <span>Individual Villa (800 - 1,200 sq.ft)</span>
              <span>Apartment Complex (3,000 sq.ft)</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
            <div>
              <span className="text-slate-400 block">Metric Area:</span>
              <span className="font-semibold text-white font-mono">{Math.round(roofArea * 0.0929)} m²</span>
            </div>
            <div>
              <span className="text-slate-400 block">Yield per 10mm Rain:</span>
              <span className="font-semibold text-cyan-300 font-mono">
                {Math.round(roofArea * 0.0929 * 10 * 0.85)} Litres
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Groundwater Recharge Coeff:</span>
              <span className="font-semibold text-emerald-400">0.85 (Standard)</span>
            </div>
          </div>
        </GlassCard>

        {/* Live Rain Simulation Card */}
        <GlassCard className="p-6 space-y-4 flex flex-col justify-between bg-gradient-to-br from-slate-900/80 to-cyan-950/30 border-cyan-500/20">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">Live Viva Demo Simulator</h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Test the full pipeline: Simulate an incoming downpour. This immediately calculates the catchment volume and injects an ultrasonic sensor telemetry reading into your tank!
            </p>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-slate-400">
                Simulated Downpour: <strong className="text-white">{rainfallSimMm} mm</strong>
              </label>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={rainfallSimMm}
                onChange={(e) => setRainfallSimMm(parseInt(e.target.value))}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] text-cyan-300 block">
                Estimated Inflow: ~{Math.round(roofArea * 0.0929 * rainfallSimMm * 0.85)} Litres
              </span>
            </div>
          </div>

          <button
            onClick={() => simulateRainMutation.mutate(rainfallSimMm)}
            disabled={simulateRainMutation.isPending || !selectedTankId}
            className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CloudRain className="w-4 h-4 text-slate-950" />
            {simulateRainMutation.isPending ? 'Simulating Rainfall...' : 'Trigger Rain Harvest Simulation'}
          </button>
        </GlassCard>
      </div>

      {/* 7-Day Forecast Grid */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CloudSun className="w-5 h-5 text-cyan-400" />
              7-Day Meteorological Outlook & Water Impact
            </h2>
            <p className="text-xs text-slate-400">
              Correlating daily temperature and precipitation with predicted household water demand
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Fetching weather telemetry...</div>
        ) : !analysis?.daily_forecast?.length ? (
          <div className="py-12 text-center text-slate-400 text-sm">Weather data unavailable</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {analysis.daily_forecast.map((day, idx) => {
              const IconComponent = weatherIcons[day.weather_icon] || CloudSun
              const isRain = day.rainfall_mm > 0
              return (
                <div
                  key={day.date}
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-3 transition ${
                    isRain
                      ? 'bg-cyan-950/20 border-cyan-500/30'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400 block">
                      {idx === 0 ? 'Today' : new Date(day.date).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-2 py-1">
                      <IconComponent
                        className={`w-7 h-7 ${
                          isRain ? 'text-cyan-400' : 'text-amber-400'
                        }`}
                      />
                      <span className="text-xs font-bold text-white leading-tight">
                        {day.weather_label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Temp:</span>
                      <span className="font-bold text-white">
                        {Math.round(day.temp_max_c)}° / <span className="text-slate-400">{Math.round(day.temp_min_c)}°</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-300">
                      <span>Rain:</span>
                      <span className={`font-bold ${isRain ? 'text-cyan-300 font-mono' : 'text-slate-400'}`}>
                        {day.rainfall_mm} mm
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-300">
                      <span>Rainfall Prob:</span>
                      <span className="text-slate-400 font-mono">{day.rain_probability_pct}%</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 space-y-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Harvest:</span>
                      <span className="font-bold text-emerald-400">+{day.predicted_harvest_litres} L</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Demand Factor:</span>
                      <span
                        className={`font-semibold ${
                          day.demand_multiplier > 1.0 ? 'text-rose-400' : day.demand_multiplier < 1.0 ? 'text-cyan-400' : 'text-slate-300'
                        }`}
                      >
                        {day.demand_multiplier > 1.0 ? `+${Math.round((day.demand_multiplier - 1) * 100)}%` : day.demand_multiplier < 1.0 ? `${Math.round((day.demand_multiplier - 1) * 100)}%` : 'Normal'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
