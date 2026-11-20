import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Truck,
  Droplets,
  Plus,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  ShieldCheck,
  AlertCircle,
  DollarSign,
  TrendingUp,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { useTank } from '../contexts/TankContext'
import { refillsApi, calcApi } from '../services/api'
import GlassCard from '../components/ui/GlassCard'
import KPICard from '../components/ui/KPICard'

const statusStyles = {
  REQUESTED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  IN_TRANSIT: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 animate-pulse',
  DELIVERED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  VERIFIED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CANCELLED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
}

export default function Refills() {
  const { selectedTankId, selectedTank } = useTank()
  const qc = useQueryClient()

  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [vendorModalOpen, setVendorModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [modalError, setModalError] = useState('')
  const [vendorErrors, setVendorErrors] = useState({})

  // Form states
  const [orderForm, setOrderForm] = useState({
    vendor_id: '',
    liters_ordered: 6000,
    cost: 850,
    notes: 'Urgent domestic refill requested',
  })

  const [vendorForm, setVendorForm] = useState({
    name: '',
    phone: '',
    email: 'gokulnath2k24@gmail.com',
    vendor_type: 'tanker',
    capacity_liters: 6000,
    price_per_trip: 800,
    avg_delivery_hours: 2.5,
  })

  // Queries
  const { data: vendors = [], isLoading: loadingVendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const res = await refillsApi.listVendors()
      return res.data || []
    },
  })

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['refillOrders', selectedTankId],
    queryFn: async () => {
      if (!selectedTankId) return []
      const res = await refillsApi.listOrders(selectedTankId)
      return res.data || []
    },
    enabled: !!selectedTankId,
  })

  const { data: expenses } = useQuery({
    queryKey: ['refillExpenses', selectedTankId],
    queryFn: async () => {
      if (!selectedTankId) return null
      const res = await refillsApi.getExpenses(selectedTankId)
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

  const kpis = calc?.kpis || calc || {}

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: (data) => refillsApi.createOrder({ ...data, tank_id: selectedTankId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refillOrders'] })
      qc.invalidateQueries({ queryKey: ['refillExpenses'] })
      setOrderModalOpen(false)
      setModalError('')
      showToast('🎉 Tanker Refill Order placed & email alert sent!')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to place order. Check server connection.'
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg)
      setModalError(text)
      showToast('❌ ' + text)
    },
  })

  const createVendorMutation = useMutation({
    mutationFn: (data) => refillsApi.createVendor(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
      setVendorModalOpen(false)
      setModalError('')
      setVendorErrors({})
      setVendorForm({
        name: '',
        phone: '',
        email: 'gokulnath2k24@gmail.com',
        vendor_type: 'tanker',
        capacity_liters: 6000,
        price_per_trip: 800,
        avg_delivery_hours: 2.5,
      })
      showToast('🎉 New Water Vendor registered successfully!')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to save vendor. Please check backend connection.'
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg)
      setModalError(text)
      showToast('❌ Error: ' + text)
    },
  })

  const validateVendorForm = () => {
    const errs = {}
    if (!vendorForm.name || vendorForm.name.trim().length < 2) {
      errs.name = 'Vendor name must be at least 2 characters.'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!vendorForm.email || !emailRegex.test(vendorForm.email.trim())) {
      errs.email = 'Please enter a valid email address (e.g. vendor@gmail.com).'
    }
    if (!vendorForm.phone || vendorForm.phone.trim().length < 7) {
      errs.phone = 'Please enter a valid phone number (at least 7 digits).'
    }
    if (!vendorForm.capacity_liters || vendorForm.capacity_liters < 100) {
      errs.capacity_liters = 'Capacity must be at least 100 Litres.'
    }
    if (vendorForm.price_per_trip == null || vendorForm.price_per_trip < 0) {
      errs.price_per_trip = 'Rate per trip cannot be negative.'
    }
    setVendorErrors(errs)
    return Object.keys(errs).length === 0
  }

  const verifyOrderMutation = useMutation({
    mutationFn: (orderId) => refillsApi.verifyOrder(orderId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['refillOrders'] })
      qc.invalidateQueries({ queryKey: ['refillExpenses'] })
      qc.invalidateQueries({ queryKey: ['calc'] })
      const verified = res.data.verified_by_sensor
      if (verified) {
        showToast('🎉 Sensor confirmed! Water level increase verified.')
      } else {
        showToast('Order marked delivered. Sensor level did not show a sharp jump yet.')
      }
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => refillsApi.updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refillOrders'] })
      qc.invalidateQueries({ queryKey: ['refillExpenses'] })
    },
  })

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 4500)
  }

  const handleVendorSelect = (vId) => {
    const v = vendors.find((x) => x.id === vId)
    if (v) {
      setOrderForm((prev) => ({
        ...prev,
        vendor_id: v.id,
        liters_ordered: v.capacity_liters || 6000,
        cost: v.price_per_trip || 800,
      }))
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-cyan-400/40 text-cyan-300 px-5 py-3 rounded-xl shadow-2xl shadow-cyan-500/20 flex items-center gap-3 backdrop-blur-md animate-bounce">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white flex items-center gap-2.5">
            <Truck className="w-7 h-7 text-cyan-400" />
            Smart Refill & Vendor Logistics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automated water tanker replenishment, sensor verification & water expenditure tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setModalError('')
              setVendorErrors({})
              setVendorModalOpen(true)
            }}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-slate-300" />
            Add Vendor
          </button>
          <button
            onClick={() => setOrderModalOpen(true)}
            disabled={!selectedTankId}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Droplets className="w-4 h-4 text-slate-950" />
            Book Water Refill
          </button>
        </div>
      </div>

      {/* Tank Status Quick Bar */}
      {selectedTank && (
        <GlassCard className="p-4 bg-gradient-to-r from-cyan-950/30 via-slate-900/40 to-slate-900/60 border-cyan-500/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Droplets className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Active Tank</div>
                <div className="text-lg font-bold text-white">{selectedTank.name} ({selectedTank.location || 'Main'})</div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-slate-400 block text-xs">Current Level</span>
                <span className="font-bold text-white text-base">
                  {kpis.current_level_pct != null ? `${Math.round(kpis.current_level_pct)}%` : '--'}
                </span>
              </div>
              <div className="border-l border-white/10 pl-6">
                <span className="text-slate-400 block text-xs">Current Volume</span>
                <span className="font-bold text-white text-base">
                  {kpis.current_volume_litres != null ? `${Math.round(kpis.current_volume_litres)} L` : '--'}
                </span>
              </div>
              <div className="border-l border-white/10 pl-6">
                <span className="text-slate-400 block text-xs">Days to Empty</span>
                <span className={`font-bold text-base ${(kpis.days_to_empty ?? 10) < 3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {kpis.days_to_empty != null ? `${kpis.days_to_empty.toFixed(1)} Days` : '--'}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Water Spent"
          value={expenses?.total_spent != null ? `₹${expenses.total_spent.toLocaleString()}` : '₹0'}
          subtitle={`${expenses?.total_orders_count || 0} Refill trips`}
          icon={DollarSign}
          color="cyan"
        />
        <KPICard
          title="Total Liters Procured"
          value={expenses?.total_liters_ordered != null ? `${expenses.total_liters_ordered.toLocaleString()} L` : '0 L'}
          subtitle="From registered vendors"
          icon={Droplets}
          color="blue"
        />
        <KPICard
          title="Avg. Cost / 1000L"
          value={expenses?.avg_cost_per_thousand_liters != null ? `₹${expenses.avg_cost_per_thousand_liters}` : '₹0'}
          subtitle="Tariff efficiency"
          icon={TrendingUp}
          color="violet"
        />
        <KPICard
          title="Sensor-Verified Orders"
          value={`${expenses?.verified_orders_count || 0} / ${expenses?.total_orders_count || 0}`}
          subtitle="Level jump confirmed"
          icon={ShieldCheck}
          color="emerald"
        />
      </div>

      {/* Active & Past Refill Orders */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              Refill Replenishment Orders
            </h2>
            <p className="text-xs text-slate-400">Live order status, tanker dispatch & IoT sensor confirmation</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {orders.length} Total Orders
          </span>
        </div>

        {loadingOrders ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading refill orders...</div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <Truck className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm">No refill orders logged yet for this tank.</p>
            <button
              onClick={() => setOrderModalOpen(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium"
            >
              Click here to place a simulated tanker order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Vendor & Tanker</th>
                  <th className="py-3 px-4">Liters / Cost</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4">Sensor Verification</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">{order.vendor_name}</div>
                      {order.vendor_phone && (
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-cyan-400" />
                          {order.vendor_phone}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-cyan-300">{order.liters_ordered.toLocaleString()} L</div>
                      <div className="text-xs text-slate-400">₹{order.cost}</div>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-300">
                      <div>{new Date(order.requested_at).toLocaleDateString()}</div>
                      <div className="text-slate-500 font-mono">
                        {new Date(order.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles[order.order_status] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                        {order.order_status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {order.verified_by_sensor ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Sensor Confirmed (+{order.volume_verified_liters || order.liters_ordered}L)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Awaiting Level Jump</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-2">
                      {!order.verified_by_sensor && order.order_status !== 'CANCELLED' && (
                        <button
                          onClick={() => verifyOrderMutation.mutate(order.id)}
                          disabled={verifyOrderMutation.isPending}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition inline-flex items-center gap-1"
                          title="Check sensor telemetry to verify water increase"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verify Sensor
                        </button>
                      )}

                      {order.order_status === 'REQUESTED' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'IN_TRANSIT' })}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition"
                        >
                          Dispatch
                        </button>
                      )}

                      {order.order_status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'DELIVERED' })}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Water Vendor Directory Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-cyan-400" />
              Authorized Water Tanker Vendors
            </h2>
            <p className="text-xs text-slate-400">Pre-approved water tankers with rate cards and contact links</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <GlassCard key={vendor.id} className="p-5 flex flex-col justify-between hover:border-cyan-500/30 transition">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-base">{vendor.name}</h3>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                      {vendor.vendor_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-cyan-400">₹{vendor.price_per_trip}</span>
                    <span className="block text-[10px] text-slate-400">per {vendor.capacity_liters}L</span>
                  </div>
                </div>

                <div className="text-xs space-y-1.5 text-slate-300">
                  {vendor.email && (
                    <div className="flex items-center gap-1.5 text-slate-400 truncate">
                      <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{vendor.email}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Avg Delivery:</span>
                    <span className="font-medium text-white">{vendor.avg_delivery_hours} Hours</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Rating:</span>
                    <span className="font-medium text-amber-300">★ {vendor.rating} / 5.0</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-white/10 flex items-center gap-2">
                {vendor.phone && (
                  <a
                    href={`tel:${vendor.phone}`}
                    className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Phone className="w-3.5 h-3.5 text-cyan-400" />
                    Call
                  </a>
                )}
                <button
                  onClick={() => {
                    handleVendorSelect(vendor.id)
                    setOrderModalOpen(true)
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1 transition"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  Book Now
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Modal: Book Water Tanker */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 space-y-5 bg-slate-900 border-white/20">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-cyan-400" />
                Book Tanker Refill
              </h3>
              <button
                onClick={() => setOrderModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                createOrderMutation.mutate(orderForm)
              }}
              className="space-y-4 text-sm"
            >
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300 flex items-center gap-2.5">
                <Mail className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>📧 Automated Dispatch: An official refill request email will be sent to the vendor inbox upon booking!</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Water Vendor
                </label>
                <select
                  value={orderForm.vendor_id}
                  onChange={(e) => handleVendorSelect(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.capacity_liters}L @ ₹{v.price_per_trip})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Liters to Order
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={orderForm.liters_ordered}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, liters_ordered: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Trip Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={orderForm.cost}
                    onChange={(e) =>
                      setOrderForm({ ...orderForm, cost: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Delivery Instructions / Note
                </label>
                <textarea
                  rows="2"
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="e.g. Call security upon arrival at Gate 2"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20"
                >
                  {createOrderMutation.isPending ? 'Placing Order...' : 'Confirm Tanker Order'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Modal: Add Vendor */}
      {vendorModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <GlassCard className="max-w-md w-full p-6 space-y-5 bg-slate-900 border-white/20">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                Register Water Supplier
              </h3>
              <button
                onClick={() => setVendorModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setModalError('')
                if (!validateVendorForm()) return
                createVendorMutation.mutate(vendorForm)
              }}
              className="space-y-4 text-sm"
              noValidate
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Vendor Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sri Krishna Aqua Tankers"
                  value={vendorForm.name}
                  onChange={(e) => {
                    setVendorForm({ ...vendorForm, name: e.target.value })
                    if (vendorErrors.name) setVendorErrors({ ...vendorErrors, name: '' })
                  }}
                  className={`w-full bg-slate-800 border ${
                    vendorErrors.name ? 'border-rose-500 focus:border-rose-400' : 'border-white/10 focus:border-cyan-400'
                  } rounded-xl px-3 py-2 text-white focus:outline-none`}
                />
                {vendorErrors.name && (
                  <p className="text-rose-400 text-xs mt-1">{vendorErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Vendor Email (for automated delivery dispatch emails) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  placeholder="vendor@aquasupply.com"
                  value={vendorForm.email}
                  onChange={(e) => {
                    setVendorForm({ ...vendorForm, email: e.target.value })
                    if (vendorErrors.email) setVendorErrors({ ...vendorErrors, email: '' })
                  }}
                  className={`w-full bg-slate-800 border ${
                    vendorErrors.email ? 'border-rose-500 focus:border-rose-400' : 'border-white/10 focus:border-cyan-400'
                  } rounded-xl px-3 py-2 text-white focus:outline-none`}
                />
                {vendorErrors.email && (
                  <p className="text-rose-400 text-xs mt-1">{vendorErrors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 7339114903"
                    value={vendorForm.phone}
                    onChange={(e) => {
                      setVendorForm({ ...vendorForm, phone: e.target.value })
                      if (vendorErrors.phone) setVendorErrors({ ...vendorErrors, phone: '' })
                    }}
                    className={`w-full bg-slate-800 border ${
                      vendorErrors.phone ? 'border-rose-500 focus:border-rose-400' : 'border-white/10 focus:border-cyan-400'
                    } rounded-xl px-3 py-2 text-white focus:outline-none`}
                  />
                  {vendorErrors.phone && (
                    <p className="text-rose-400 text-xs mt-1">{vendorErrors.phone}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Vendor Type
                  </label>
                  <select
                    value={vendorForm.vendor_type}
                    onChange={(e) => setVendorForm({ ...vendorForm, vendor_type: e.target.value })}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="tanker">Commercial Tanker</option>
                    <option value="municipal">Municipal / Board</option>
                    <option value="borewell">Borewell Operator</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Capacity (Liters) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="100"
                    value={vendorForm.capacity_liters}
                    onChange={(e) => {
                      setVendorForm({ ...vendorForm, capacity_liters: parseFloat(e.target.value) || 0 })
                      if (vendorErrors.capacity_liters) setVendorErrors({ ...vendorErrors, capacity_liters: '' })
                    }}
                    className={`w-full bg-slate-800 border ${
                      vendorErrors.capacity_liters ? 'border-rose-500 focus:border-rose-400' : 'border-white/10 focus:border-cyan-400'
                    } rounded-xl px-3 py-2 text-white focus:outline-none`}
                  />
                  {vendorErrors.capacity_liters && (
                    <p className="text-rose-400 text-xs mt-1">{vendorErrors.capacity_liters}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Rate per Trip (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={vendorForm.price_per_trip}
                    onChange={(e) => {
                      setVendorForm({ ...vendorForm, price_per_trip: parseFloat(e.target.value) || 0 })
                      if (vendorErrors.price_per_trip) setVendorErrors({ ...vendorErrors, price_per_trip: '' })
                    }}
                    className={`w-full bg-slate-800 border ${
                      vendorErrors.price_per_trip ? 'border-rose-500 focus:border-rose-400' : 'border-white/10 focus:border-cyan-400'
                    } rounded-xl px-3 py-2 text-white focus:outline-none`}
                  />
                  {vendorErrors.price_per_trip && (
                    <p className="text-rose-400 text-xs mt-1">{vendorErrors.price_per_trip}</p>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setVendorModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createVendorMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20"
                >
                  {createVendorMutation.isPending ? 'Saving...' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
