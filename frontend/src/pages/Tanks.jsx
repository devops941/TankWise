import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Edit3, Droplets, AlertTriangle, Upload } from 'lucide-react'
import { tanksApi } from '../services/api'
import { useTank } from '../contexts/TankContext'
import GlassCard from '../components/ui/GlassCard'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { motion, AnimatePresence } from 'framer-motion'

const positiveNumber = (label) =>
  z.preprocess((v) => {
    if (v === '' || v === null || v === undefined) return undefined
    const n = Number(v)
    return Number.isNaN(n) ? undefined : n
  }, z.number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` }).positive(`${label} must be greater than 0`))

const optionalPositiveNumber = (label) =>
  z.preprocess((v) => {
    if (v === '' || v === null || v === undefined) return undefined
    const n = Number(v)
    return Number.isNaN(n) ? undefined : n
  }, z.number({ invalid_type_error: `${label} must be a number` }).positive(`${label} must be greater than 0`).optional())

const percentageNumber = (label, defaultVal) =>
  z.preprocess((v) => {
    if (v === '' || v === null || v === undefined) return defaultVal
    const n = Number(v)
    return Number.isNaN(n) ? defaultVal : n
  }, z.number().min(0, `${label} must be at least 0`).max(100, `${label} cannot exceed 100`))

const intNumber = (label, defaultVal) =>
  z.preprocess((v) => {
    if (v === '' || v === null || v === undefined) return defaultVal
    const n = Number(v)
    return Number.isNaN(n) ? defaultVal : Math.round(n)
  }, z.number().int().min(1, `${label} must be at least 1`))

const tankSchema = z.object({
  name: z.string().trim().min(1, 'Tank name is required'),
  location: z.string().optional().default(''),
  shape: z.enum(['cylindrical', 'rectangular']).default('cylindrical'),
  height_cm: positiveNumber('Height'),
  diameter_cm: optionalPositiveNumber('Diameter'),
  length_cm: optionalPositiveNumber('Length'),
  width_cm: optionalPositiveNumber('Width'),
  low_threshold_pct: percentageNumber('Low %', 20),
  high_threshold_pct: percentageNumber('High %', 90),
  household_size: intNumber('Household', 1),
}).superRefine((data, ctx) => {
  if (data.shape === 'cylindrical') {
    if (!data.diameter_cm || data.diameter_cm <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Diameter is required for cylindrical tanks',
        path: ['diameter_cm'],
      })
    }
  } else if (data.shape === 'rectangular') {
    if (!data.length_cm || data.length_cm <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Length is required for rectangular tanks',
        path: ['length_cm'],
      })
    }
    if (!data.width_cm || data.width_cm <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Width is required for rectangular tanks',
        path: ['width_cm'],
      })
    }
  }
})

function computeCapacity(shape, dims) {
  const h = Number(dims.height_cm) || 0
  if (h <= 0) return 0
  if (shape === 'cylindrical') {
    const d = Number(dims.diameter_cm) || 0
    if (d <= 0) return 0
    const r = d / 2
    return Math.round(Math.PI * r * r * h / 1000 * 10) / 10
  }
  const l = Number(dims.length_cm) || 0
  const w = Number(dims.width_cm) || 0
  if (l <= 0 || w <= 0) return 0
  return Math.round(l * w * h / 1000 * 10) / 10
}

function LevelGauge({ pct, low, high }) {
  const color = pct <= low ? '#f87171' : pct >= high ? '#fbbf24' : '#34d399'
  return (
    <div className="relative w-8 h-16 rounded-full border border-white/20 overflow-hidden bg-white/5">
      <div
        className="absolute bottom-0 w-full rounded-b-full transition-all duration-500"
        style={{ height: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

function TankCard({ tank, onEdit, onDelete }) {
  const { selectTank } = useTank()
  const level = 60
  const statusColor = level <= tank.low_threshold_pct ? 'text-[#f87171]' : '#34d399'
  return (
    <GlassCard hover className="flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div>
          <Link 
            to={`/tanks/${tank.id}/readings`} 
            onClick={() => selectTank(tank.id)}
            className="font-heading font-bold text-lg hover:text-[#22d3ee] transition-colors"
          >
            {tank.name}
          </Link>
          {tank.location && <p className="text-white/50 text-sm">{tank.location}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(tank)} className="text-white/40 hover:text-[#22d3ee] transition-colors">
            <Edit3 size={16} />
          </button>
          <button onClick={() => onDelete(tank)} className="text-white/40 hover:text-[#f87171] transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="flex gap-4 items-center">
        <LevelGauge pct={level} low={tank.low_threshold_pct} high={tank.high_threshold_pct} />
        <div className="flex flex-col gap-1">
          <p className="text-white/60 text-xs uppercase tracking-wide">Capacity</p>
          <p className="font-semibold text-[#22d3ee]">{tank.capacity_litres.toFixed(0)} L</p>
          <p className="text-white/40 text-xs capitalize">{tank.shape} · {tank.sensor_mode}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/70">
          Low: {tank.low_threshold_pct}%
        </span>
        <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/70">
          High: {tank.high_threshold_pct}%
        </span>
        <span className="text-xs bg-white/10 rounded-full px-3 py-1 text-white/70">
          {tank.household_size} person{tank.household_size > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex gap-2 mt-1">
        <Link 
          to={`/tanks/${tank.id}/readings`} 
          onClick={() => selectTank(tank.id)}
          className="text-xs bg-[#22d3ee]/15 hover:bg-[#22d3ee]/25 text-[#22d3ee] border border-[#22d3ee]/30 rounded-full px-3 py-1 font-medium transition-colors flex items-center gap-1.5"
        >
          <Upload size={12} /> Upload CSV / Readings
        </Link>
        <Link 
          to={`/tanks/${tank.id}/dashboard`} 
          onClick={() => selectTank(tank.id)}
          className="text-xs bg-white/10 hover:bg-white/20 rounded-full px-3 py-1 text-white/80 font-medium transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </GlassCard>
  )
}

function TankForm({ onClose, existing }) {
  const qc = useQueryClient()
  const { selectTank } = useTank()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(tankSchema),
    defaultValues: existing ? {
      name: existing.name || '',
      location: existing.location || '',
      shape: existing.shape || 'cylindrical',
      height_cm: existing.dimensions?.height_cm ?? '',
      diameter_cm: existing.dimensions?.diameter_cm ?? '',
      length_cm: existing.dimensions?.length_cm ?? '',
      width_cm: existing.dimensions?.width_cm ?? '',
      low_threshold_pct: existing.low_threshold_pct ?? 20,
      high_threshold_pct: existing.high_threshold_pct ?? 90,
      household_size: existing.household_size ?? 1,
    } : {
      name: '',
      location: '',
      shape: 'cylindrical',
      height_cm: '',
      diameter_cm: '',
      length_cm: '',
      width_cm: '',
      low_threshold_pct: 20,
      high_threshold_pct: 90,
      household_size: 1,
    },
  })

  const shape = watch('shape')
  const dims = {
    height_cm: watch('height_cm'),
    diameter_cm: watch('diameter_cm'),
    length_cm: watch('length_cm'),
    width_cm: watch('width_cm'),
  }
  const previewCapacity = computeCapacity(shape, dims)

  const mutation = useMutation({
    mutationFn: (data) => {
      const dimensions = data.shape === 'cylindrical'
        ? { height_cm: Number(data.height_cm), diameter_cm: Number(data.diameter_cm) }
        : { height_cm: Number(data.height_cm), length_cm: Number(data.length_cm), width_cm: Number(data.width_cm) }
      const payload = {
        name: data.name,
        location: data.location || '',
        shape: data.shape,
        dimensions,
        low_threshold_pct: Number(data.low_threshold_pct),
        high_threshold_pct: Number(data.high_threshold_pct),
        household_size: Number(data.household_size),
      }
      return existing ? tanksApi.update(existing.id, payload) : tanksApi.create(payload)
    },
    onSuccess: (res) => { 
      qc.invalidateQueries(['tanks'])
      if (res?.data?.id) {
        selectTank(res.data.id)
      }
      onClose() 
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <GlassCard className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="font-heading text-xl font-bold mb-6">{existing ? 'Edit Tank' : 'Add Tank'}</h2>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Tank Name" {...register('name')} error={errors.name?.message} />
            <Input label="Location" {...register('location')} error={errors.location?.message} />
          </div>
          <div>
            <label className="text-sm text-white/70 font-medium">Shape</label>
            <div className="flex gap-3 mt-2">
              {['cylindrical', 'rectangular'].map(s => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value={s} {...register('shape')} className="accent-[#22d3ee]" />
                  <span className="text-sm capitalize">{s}</span>
                </label>
              ))}
            </div>
          </div>
          <Input label="Height (cm)" type="number" step="any" {...register('height_cm')} error={errors.height_cm?.message} />
          {shape === 'cylindrical' && (
            <Input label="Diameter (cm)" type="number" step="any" {...register('diameter_cm')} error={errors.diameter_cm?.message} />
          )}
          {shape === 'rectangular' && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="Length (cm)" type="number" step="any" {...register('length_cm')} error={errors.length_cm?.message} />
              <Input label="Width (cm)" type="number" step="any" {...register('width_cm')} error={errors.width_cm?.message} />
            </div>
          )}
          {previewCapacity > 0 && (
            <div className="bg-[#22d3ee]/10 border border-[#22d3ee]/30 rounded-lg p-3">
              <p className="text-[#22d3ee] text-sm font-semibold">Capacity Preview: {previewCapacity} litres</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <Input label="Low %" type="number" step="any" {...register('low_threshold_pct')} error={errors.low_threshold_pct?.message} />
            <Input label="High %" type="number" step="any" {...register('high_threshold_pct')} error={errors.high_threshold_pct?.message} />
            <Input label="Household" type="number" step="1" {...register('household_size')} error={errors.household_size?.message} />
          </div>
          {mutation.isError && (
            <p className="text-[#f87171] text-sm">{mutation.error?.response?.data?.detail || 'Error saving tank'}</p>
          )}
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              {existing ? 'Save Changes' : 'Create Tank'}
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}

export default function Tanks() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editTank, setEditTank] = useState(null)

  const { data: tanks = [], isLoading } = useQuery({
    queryKey: ['tanks'],
    queryFn: () => tanksApi.list().then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => tanksApi.delete(id),
    onSuccess: () => qc.invalidateQueries(['tanks']),
  })

  const handleDelete = (tank) => {
    if (window.confirm(`Delete "${tank.name}" and all its data?`)) {
      deleteMutation.mutate(tank.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">My Tanks</h1>
          <p className="text-white/50 text-sm">{tanks.length} tank{tanks.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add Tank
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-white/50 py-12">Loading tanks...</div>
      ) : tanks.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center mb-4 text-[#22d3ee]">
            <Droplets size={32} />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No tanks registered</h3>
          <p className="text-white/60 text-sm max-w-sm mb-6">No tanks yet. Add your first tank to start monitoring water usage and refills.</p>
          <Button onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Tank
          </Button>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {tanks.map(tank => (
              <TankCard key={tank.id} tank={tank}
                onEdit={(t) => { setEditTank(t); setShowForm(true) }}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {showForm && (
        <TankForm
          existing={editTank}
          onClose={() => { setShowForm(false); setEditTank(null) }}
        />
      )}
    </div>
  )
}
