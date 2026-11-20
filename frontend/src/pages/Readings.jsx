import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Upload,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  Droplets,
  Calendar,
  Download,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { readingsApi, tanksApi } from '../services/api'
import { useTank } from '../contexts/TankContext'
import GlassCard from '../components/ui/GlassCard'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const readingSchema = z.object({
  timestamp: z.string().min(1, 'Timestamp is required'),
  level_pct: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ required_error: 'Level percentage is required' }).min(0, 'Min 0%').max(100, 'Max 100%')
  ),
  note: z.string().optional(),
})

function StatusIcon({ status }) {
  if (status === 'valid') return <CheckCircle size={14} className="text-[#34d399]" />
  if (status === 'flagged') return <AlertCircle size={14} className="text-[#fbbf24]" />
  return <XCircle size={14} className="text-[#f87171]" />
}

export function UploadModal({ tankId, onClose }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [commitResult, setCommitResult] = useState(null)

  const previewMutation = useMutation({
    mutationFn: (f) => readingsApi.uploadPreview(tankId, f).then((r) => r.data),
    onSuccess: (data) => setPreview(data),
  })

  const commitMutation = useMutation({
    mutationFn: () => readingsApi.commit(preview.batch_id).then((r) => r.data),
    onSuccess: (data) => {
      setCommitResult(data)
      qc.invalidateQueries({ queryKey: ['readings'] })
      qc.invalidateQueries({ queryKey: ['batches'] })
      qc.invalidateQueries({ queryKey: ['calc'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      qc.invalidateQueries({ queryKey: ['anomalies'] })
    },
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <GlassCard className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-xl font-bold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#22d3ee]" /> Upload Dataset (CSV / XLSX)
          </h2>
          <Button variant="ghost" onClick={onClose} className="text-white/50 hover:text-white text-xs px-2 py-1">
            ✕
          </Button>
        </div>

        {/* 3 Benchmark Scenario Datasets Download Section */}
        <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-transparent border border-cyan-500/25">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> 3 Scenario Datasets Ready to Download &amp; Upload:
            </span>
            <span className="text-[10px] text-white/50">Click to save file &amp; upload</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {readingsApi.samples.map((s) => (
              <a
                key={s.id}
                href={s.url}
                download={s.filename}
                className="p-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-left transition flex flex-col justify-between group shadow-sm"
              >
                <span className="text-[11px] font-semibold text-white group-hover:text-cyan-300 line-clamp-2">
                  {s.name}
                </span>
                <span className="text-[10px] text-cyan-400 mt-1.5 font-medium flex items-center gap-1">
                  <Download className="w-3 h-3" /> Download .csv
                </span>
              </a>
            ))}
          </div>
        </div>

        {commitResult ? (
          /* Success Screen with direct link to Dashboard Analytics */
          <div className="space-y-5 py-4 animate-fade-in text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle size={32} />
            </div>

            <div>
              <h3 className="text-xl font-bold font-heading text-white">
                Dataset Ingested &amp; Analyzed Successfully!
              </h3>
              <p className="text-xs text-white/60 mt-1">
                Domain calculation engine and anomaly detection models have processed your observations.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-white/50 block">Committed Rows</span>
                <span className="text-lg font-bold text-white">{commitResult.committed}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-white/50 block">Refills Detected</span>
                <span className="text-lg font-bold text-cyan-400">{commitResult.refills_detected}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-white/50 block">Anomalies Found</span>
                <span className="text-lg font-bold text-amber-400">{commitResult.anomalies_detected}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] text-white/50 block">Avg Daily Use</span>
                <span className="text-lg font-bold text-emerald-400">
                  {commitResult.avg_daily_litres ? `${commitResult.avg_daily_litres} L` : '—'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                onClick={() => {
                  onClose()
                  navigate('/dashboard')
                }}
                className="py-2.5 px-5 font-bold"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Open Analytics Dashboard
              </Button>
              <Button variant="ghost" onClick={onClose} className="py-2.5">
                Close &amp; View Table
              </Button>
            </div>
          </div>
        ) : !preview ? (
          /* File Selector Screen */
          <div className="flex flex-col gap-4">
            <div className="border-2 border-dashed border-white/20 hover:border-cyan-400/50 rounded-2xl p-8 text-center transition-all bg-white/[0.02]">
              <Upload className="text-[#22d3ee] mx-auto mb-3" size={36} />
              <p className="text-white font-semibold text-sm mb-1">
                Drag and drop CSV or Excel spreadsheet here
              </p>
              <p className="text-white/40 text-xs mb-4">
                Supported columns: timestamp, level_pct (or level_cm with unit cm), note
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="cursor-pointer bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl text-xs font-semibold text-white transition shadow-sm inline-block"
              >
                Browse Local File
              </label>
              {file && <p className="text-[#22d3ee] text-xs font-mono mt-3">Selected: {file.name}</p>}
            </div>

            {previewMutation.isError && (
              <p className="text-[#f87171] text-xs font-medium">
                {previewMutation.error?.response?.data?.detail || 'Upload failed'}
              </p>
            )}

            <div className="flex gap-3 justify-end mt-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => file && previewMutation.mutate(file)}
                loading={previewMutation.isPending}
                disabled={!file}
              >
                Validate &amp; Preview
              </Button>
            </div>
          </div>
        ) : (
          /* Preview & Commit Screen */
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                ['Total Rows', preview.rows_total, 'text-white'],
                ['Valid', preview.rows_valid, 'text-[#34d399]'],
                ['Flagged', preview.rows_flagged, 'text-[#fbbf24]'],
                ['Rejected', preview.rows_rejected, 'text-[#f87171]'],
              ].map(([l, v, c]) => (
                <div key={l} className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className={`text-2xl font-bold ${c}`}>{v}</p>
                  <p className="text-white/50 text-[11px] mt-0.5">{l}</p>
                </div>
              ))}
            </div>

            <div className="max-h-64 overflow-y-auto rounded-xl bg-white/5 p-3 border border-white/10">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 text-[10px] uppercase border-b border-white/10 pb-2">
                    <th className="text-left pb-2">Row</th>
                    <th className="text-left pb-2">Timestamp</th>
                    <th className="text-left pb-2">Level %</th>
                    <th className="text-left pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {preview.preview_rows.map((r) => (
                    <tr key={r.row} className="hover:bg-white/[0.02]">
                      <td className="py-2 text-white/50 font-mono">{r.row}</td>
                      <td className="py-2 text-white/70 truncate max-w-[140px] font-mono">
                        {r.timestamp || '—'}
                      </td>
                      <td className="py-2 font-semibold text-white">
                        {r.level_pct != null ? `${r.level_pct}%` : r.level_raw || '—'}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={r.status} />
                          <span className="capitalize text-white/70">{r.status}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {commitMutation.isError && (
              <p className="text-[#f87171] text-xs font-medium">
                {commitMutation.error?.response?.data?.detail || 'Commit failed'}
              </p>
            )}

            <div className="flex gap-3 justify-end mt-2">
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Back
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => commitMutation.mutate()} loading={commitMutation.isPending}>
                Commit &amp; Compute Analytics ({preview.rows_valid} Rows)
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

function ManualEntryForm({ tankId, onClose }) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(readingSchema),
    defaultValues: {
      timestamp: new Date().toISOString().slice(0, 16),
      level_pct: '',
      note: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (d) =>
      readingsApi.create({
        tank_id: tankId,
        timestamp: new Date(d.timestamp).toISOString(),
        level_pct: d.level_pct,
        note: d.note,
        source: 'manual',
      }),
    onSuccess: () => {
      qc.invalidateQueries(['readings', tankId])
      qc.invalidateQueries(['calc'])
      qc.invalidateQueries(['analytics'])
      qc.invalidateQueries(['anomalies'])
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <GlassCard className="w-full max-w-md">
        <h2 className="font-heading text-xl font-bold mb-5 text-white">Record Manual Reading</h2>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
          <Input
            label="Observation Timestamp"
            type="datetime-local"
            {...register('timestamp')}
            error={errors.timestamp?.message}
          />
          <Input
            label="Water Level (%)"
            type="number"
            step="0.1"
            placeholder="e.g. 74.5"
            {...register('level_pct')}
            error={errors.level_pct?.message}
          />
          <Input
            label="Operational Note (optional)"
            placeholder="e.g. After garden watering"
            {...register('note')}
          />
          {mutation.isError && (
            <p className="text-[#f87171] text-xs font-medium">
              {mutation.error?.response?.data?.detail || 'Failed to record reading'}
            </p>
          )}
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              Save Reading
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}

export default function Readings() {
  const { tankId: paramTankId } = useParams()
  const { selectedTankId, selectedTank, tanks } = useTank()
  const activeTankId = paramTankId || selectedTankId || (tanks.length > 0 ? tanks[0].id : null)

  const [showManual, setShowManual] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const qc = useQueryClient()

  const { data: tank } = useQuery({
    queryKey: ['tank', activeTankId],
    queryFn: () => tanksApi.get(activeTankId).then((r) => r.data),
    enabled: !!activeTankId,
  })

  const { data: readings = [], isLoading } = useQuery({
    queryKey: ['readings', activeTankId],
    queryFn: () => readingsApi.list(activeTankId, 1000).then((r) => r.data),
    enabled: !!activeTankId,
  })

  const { data: batches = [] } = useQuery({
    queryKey: ['batches', activeTankId],
    queryFn: () => readingsApi.listBatches(activeTankId).then((r) => r.data),
    enabled: !!activeTankId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => readingsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['readings', activeTankId])
      qc.invalidateQueries(['calc'])
      qc.invalidateQueries(['analytics'])
      qc.invalidateQueries(['anomalies'])
    },
  })

  if (!activeTankId && tanks.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center py-12 px-4">
        <GlassCard className="w-full max-w-md flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center mb-4 text-[#22d3ee]">
            <Droplets className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Tanks Available</h2>
          <p className="text-white/60 text-sm mb-6 max-w-xs">Please register or select a tank first to view readings.</p>
          <Link to="/tanks" className="inline-flex justify-center">
            <Button>Go to Tanks</Button>
          </Link>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-white">
              {tank?.name || selectedTank?.name || 'Tank'} — Telemetry Readings
            </h1>
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Module M2 &amp; M3
            </span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">
            {readings.length} time-series readings stored in MongoDB Atlas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowUpload(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Upload CSV/Excel
          </Button>
          <Button onClick={() => setShowManual(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Reading
          </Button>
        </div>
      </div>

      {/* 3 Benchmark Scenario Datasets Card */}
      <GlassCard className="border-[#22d3ee]/20 bg-gradient-to-r from-cyan-950/20 via-slate-900/40 to-purple-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-[#22d3ee]" /> Ready-to-Use Scenario Datasets
            </h3>
            <p className="text-xs text-white/50">
              Download any of these 3 realistic CSV files and upload them to immediately test refills, drawdowns, and anomaly detection.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setShowUpload(true)} className="text-xs self-start md:self-auto">
            <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload File Now
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {readingsApi.samples.map((s) => (
            <div
              key={s.id}
              className="p-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex flex-col justify-between transition-all group"
            >
              <div>
                <span className="font-semibold text-xs text-white group-hover:text-cyan-300 block mb-1">
                  {s.name}
                </span>
                <span className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">
                  {s.id === 'domestic' && '30 days of 4-hourly domestic readings, morning/evening peaks, and 8 refills.'}
                  {s.id === 'leak' && 'Features sustained 18-25 L/h night leaks between 22:00-05:00 and rapid burst draws.'}
                  {s.id === 'commercial' && 'High-consumption cafeteria/hostel facility with continuous draw and daily refills.'}
                </span>
              </div>
              <a
                href={s.url}
                download={s.filename}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#22d3ee] hover:underline"
              >
                <Download className="w-3.5 h-3.5" /> Download .csv
              </a>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Upload Batches History */}
      {batches.length > 0 && (
        <GlassCard>
          <h3 className="font-semibold text-xs text-white/50 uppercase tracking-wider mb-3">
            Ingestion Batch History
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {batches.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-white truncate max-w-[160px]">{b.filename}</p>
                  <p className="text-[10px] text-white/40">{b.rows_valid} rows committed</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    b.status === 'committed'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : b.status === 'rolled_back'
                      ? 'bg-red-500/15 text-red-400'
                      : 'bg-yellow-500/15 text-yellow-400'
                  }`}
                >
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Readings Data Table */}
      {isLoading ? (
        <div className="text-center text-white/50 py-12 text-sm">Loading readings...</div>
      ) : readings.length === 0 ? (
        <GlassCard className="text-center py-12">
          <Droplets className="w-12 h-12 text-[#22d3ee]/40 mx-auto mb-3" />
          <p className="text-white/60 text-sm mb-4">No readings recorded yet for this tank.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="secondary" onClick={() => setShowUpload(true)}>
              <Upload className="w-4 h-4 mr-1.5" /> Upload CSV
            </Button>
            <Button onClick={() => setShowManual(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Reading
            </Button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr className="text-white/40 font-semibold uppercase text-[10px]">
                  <th className="px-4 py-3">Timestamp (UTC)</th>
                  <th className="px-4 py-3">Level %</th>
                  <th className="px-4 py-3">Volume (L)</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {readings.slice(0, 100).map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-white/70 font-mono">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-white">
                      {r.level_pct != null ? `${r.level_pct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-[#22d3ee] font-mono">
                      {r.volume_litres != null ? `${Math.round(r.volume_litres)} L` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-white/50 capitalize">{r.source || 'manual'}</td>
                    <td className="px-4 py-2.5">
                      {r.flags?.map((f) => (
                        <span
                          key={f}
                          className="text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full mr-1"
                        >
                          {f}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2.5 text-white/40 italic">{r.note || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => deleteMutation.mutate(r.id)}
                        className="text-white/30 hover:text-red-400 p-1 transition"
                        title="Delete reading"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {readings.length > 100 && (
            <div className="p-3 text-center text-[11px] text-white/40 border-t border-white/5">
              Showing first 100 of {readings.length} readings
            </div>
          )}
        </GlassCard>
      )}

      {showManual && <ManualEntryForm tankId={activeTankId} onClose={() => setShowManual(false)} />}
      {showUpload && <UploadModal tankId={activeTankId} onClose={() => setShowUpload(false)} />}
    </div>
  )
}
