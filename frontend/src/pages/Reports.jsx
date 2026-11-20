import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'
import { useTank } from '../contexts/TankContext'
import { reportsApi } from '../services/api'
import GlassCard from '../components/ui/GlassCard'
import Button from '../components/ui/Button'

export default function Reports() {
  const { tanks, selectedTankId, selectedTank, dateRange } = useTank()
  const qc = useQueryClient()

  const [tankId, setTankId] = useState(selectedTankId || '')
  const [format, setFormat] = useState('pdf')
  const [days, setDays] = useState(30)
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeAnomalies, setIncludeAnomalies] = useState(true)
  const [generating, setGenerating] = useState(false)

  const activeTank = tanks.find((t) => t.id === (tankId || selectedTankId)) || selectedTank

  // Fetch report history
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['report_history'],
    queryFn: () => reportsApi.listHistory().then((r) => r.data),
  })

  // Delete report mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => reportsApi.deleteReport(id),
    onSuccess: () => {
      qc.invalidateQueries(['report_history'])
    },
  })

  const handleDownload = async (targetFormat = format) => {
    const targetTankId = tankId || selectedTankId
    if (!targetTankId) {
      alert('Please select a tank first.')
      return
    }

    setGenerating(true)
    try {
      const url = reportsApi.exportUrl(targetTankId, targetFormat, days)
      const token = localStorage.getItem('tw_token')
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) throw new Error('Report generation failed')

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${activeTank?.name || 'tank'}_report_${days}d.${targetFormat}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)

      // Refresh history list
      qc.invalidateQueries(['report_history'])
    } catch (err) {
      alert('Error generating report: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  const formatSize = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-white">Reports & Data Export</h1>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Module M7
            </span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">
            Generate executive PDF briefs, multi-tab Excel workbooks, or raw CSV audit logs
          </p>
        </div>
      </div>

      {/* Report Generator Panel */}
      <GlassCard>
        <h2 className="font-heading font-bold text-lg text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#22d3ee]" /> Generate New Report
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Target Tank & Range */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">Target Tank</label>
              <select
                value={tankId || selectedTankId}
                onChange={(e) => setTankId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.08] border border-white/15 text-white text-sm focus:outline-none focus:border-[#22d3ee]"
              >
                {tanks.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                    {t.name} ({Math.round(t.capacity_litres || 0)} L)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/70 mb-1.5">Time Horizon</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '7 Days', val: 7 },
                  { label: '30 Days', val: 30 },
                  { label: '90 Days', val: 90 },
                ].map((d) => (
                  <button
                    key={d.val}
                    type="button"
                    onClick={() => setDays(d.val)}
                    className={`py-2 text-xs font-semibold rounded-xl border transition ${
                      days === d.val
                        ? 'bg-[#22d3ee]/20 text-[#22d3ee] border-[#22d3ee]'
                        : 'bg-white/[0.05] text-white/60 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Document Format */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/70 mb-1.5">Select Export Format</label>

            <button
              type="button"
              onClick={() => setFormat('pdf')}
              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                format === 'pdf'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-[#22d3ee] text-white'
                  : 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">
                  PDF
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Executive PDF Report</p>
                  <p className="text-[11px] text-white/50">ReportLab Platypus • Formatted tables</p>
                </div>
              </div>
              {format === 'pdf' && <CheckCircle2 className="w-4 h-4 text-[#22d3ee]" />}
            </button>

            <button
              type="button"
              onClick={() => setFormat('xlsx')}
              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                format === 'xlsx'
                  ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-400 text-white'
                  : 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  XLSX
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Excel Workbook</p>
                  <p className="text-[11px] text-white/50">openpyxl • 5 sheets with formulas</p>
                </div>
              </div>
              {format === 'xlsx' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => setFormat('csv')}
              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                format === 'csv'
                  ? 'bg-gradient-to-r from-yellow-500/20 to-cyan-500/20 border-yellow-400 text-white'
                  : 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center font-bold text-xs">
                  CSV
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Raw Delimited CSV</p>
                  <p className="text-[11px] text-white/50">Excel UTF-8 BOM • Injection safe</p>
                </div>
              </div>
              {format === 'csv' && <CheckCircle2 className="w-4 h-4 text-yellow-400" />}
            </button>
          </div>

          {/* Column 3: Sections & Action */}
          <div className="space-y-4 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-semibold text-white/70 mb-2">Sections Included</label>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-white/80">
                  <input
                    type="checkbox"
                    checked={includeCharts}
                    onChange={(e) => setIncludeCharts(e.target.checked)}
                    className="accent-[#22d3ee] rounded"
                  />
                  <span>Statistical KPIs & Summary Cards</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-white/80">
                  <input
                    type="checkbox"
                    checked={includeAnomalies}
                    onChange={(e) => setIncludeAnomalies(e.target.checked)}
                    className="accent-[#22d3ee] rounded"
                  />
                  <span>Detected Anomaly Audit Log</span>
                </label>
                <label className="flex items-center gap-2 text-white/80">
                  <input type="checkbox" checked disabled className="accent-[#22d3ee] rounded" />
                  <span>Refill Cycles & Interval Analysis</span>
                </label>
                <label className="flex items-center gap-2 text-white/80">
                  <input type="checkbox" checked disabled className="accent-[#22d3ee] rounded" />
                  <span>Raw Sensor Time-Series Log</span>
                </label>
              </div>
            </div>

            <Button
              onClick={() => handleDownload(format)}
              disabled={generating}
              className="w-full py-3"
            >
              <Download className="w-4 h-4 mr-2" />
              {generating ? 'Compiling Document...' : `Download ${format.toUpperCase()} Report`}
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Report History Table */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-base text-white">Export History & Downloads</h3>
            <p className="text-xs text-white/50">Previously compiled documents ready for immediate download</p>
          </div>
          <span className="text-xs font-semibold text-white/50 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            {history.length} generated
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase font-semibold">
                <th className="py-2.5 px-3">File Name</th>
                <th className="py-2.5 px-3">Format</th>
                <th className="py-2.5 px-3">Tank Name</th>
                <th className="py-2.5 px-3">Time Range</th>
                <th className="py-2.5 px-3">File Size</th>
                <th className="py-2.5 px-3">Generated At</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {historyLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-white/50">
                    Loading history...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-white/40">
                    No reports generated yet. Click &apos;Download Report&apos; above to compile your first export.
                  </td>
                </tr>
              ) : (
                history.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-3 font-semibold text-white font-mono">{r.filename}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          r.type === 'pdf'
                            ? 'bg-red-500/20 text-red-400'
                            : r.type === 'xlsx'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {r.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-white/80">{r.tank_name}</td>
                    <td className="py-3 px-3 text-white/60">{r.days} days</td>
                    <td className="py-3 px-3 text-white/60 font-mono">{formatSize(r.size_bytes)}</td>
                    <td className="py-3 px-3 text-white/50">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(r.type)}
                          className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition"
                          title="Download again"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(r.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
