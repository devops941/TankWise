import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tw_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tw_token')
      localStorage.removeItem('tw_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  me: () => api.get('/auth/me'),
}

export const tanksApi = {
  list: () => api.get('/tanks'),
  create: (data) => api.post('/tanks', data),
  get: (id) => api.get(`/tanks/${id}`),
  update: (id, data) => api.put(`/tanks/${id}`, data),
  delete: (id) => api.delete(`/tanks/${id}`),
}

export const readingsApi = {
  list: (tankId, limit = 500) => api.get(`/readings/${tankId}?limit=${limit}`),
  create: (data) => api.post('/readings', data),
  delete: (id) => api.delete(`/readings/${id}`),
  uploadPreview: (tankId, file) => {
    const fd = new FormData()
    fd.append('tank_id', tankId)
    fd.append('file', file)
    return api.post('/readings/upload/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  commit: (batchId) => api.post(`/readings/upload/commit/${batchId}`),
  rollback: (batchId) => api.post(`/readings/upload/rollback/${batchId}`),
  listBatches: (tankId) => api.get(`/readings/batches/${tankId}`),
  templateUrl: '/api/readings/template/sample-csv',
  samples: [
    { id: 'domestic', name: 'Sample 1: Standard Domestic (30 Days)', url: '/api/readings/samples/domestic', filename: 'sample_1_standard_domestic_30days.csv' },
    { id: 'leak', name: 'Sample 2: Night Leak Anomaly', url: '/api/readings/samples/leak', filename: 'sample_2_night_leak_anomaly.csv' },
    { id: 'commercial', name: 'Sample 3: Commercial High Draw', url: '/api/readings/samples/commercial', filename: 'sample_3_commercial_high_draw_30days.csv' },
  ],
}

export const calcApi = {
  get: (tankId, params = {}) => api.get(`/calc/${tankId}`, { params }),
}

export const analyticsApi = {
  get: (tankId) => api.get(`/analytics/${tankId}`),
}

export const anomaliesApi = {
  get: (tankId) => api.get(`/anomalies/${tankId}`),
  updateStatus: (tankId, { id, timestamp, type, status }) =>
    api.patch(`/anomalies/status/${tankId}`, { id, timestamp, type, status }),
}

export const reportsApi = {
  exportUrl: (tankId, format = 'pdf', days = 30) =>
    `/api/reports/export/${tankId}?format=${format}&days=${days}`,
  listHistory: () => api.get('/reports/history'),
  deleteReport: (id) => api.delete(`/reports/${id}`),
}

export const seedApi = {
  seedDemoTank: () => api.post('/seed/demo-tank'),
}

export const refillsApi = {
  listVendors: () => api.get('/refills/vendors'),
  createVendor: (data) => api.post('/refills/vendors', data),
  deleteVendor: (id) => api.delete(`/refills/vendors/${id}`),
  listOrders: (tankId) => api.get('/refills/orders', { params: tankId ? { tank_id: tankId } : {} }),
  createOrder: (data) => api.post('/refills/orders', data),
  updateOrderStatus: (id, status, notes) => api.patch(`/refills/orders/${id}/status`, { status, notes }),
  verifyOrder: (id) => api.post(`/refills/orders/${id}/verify`),
  getExpenses: (tankId) => api.get(`/refills/expenses/${tankId}`),
}

export const weatherApi = {
  getAnalysis: (tankId, roofSqft) => api.get(`/weather/analysis/${tankId}`, { params: roofSqft ? { roof_sqft: roofSqft } : {} }),
  getForecast: (lat, lon) => api.get('/weather/forecast', { params: { lat, lon } }),
  simulateRain: (tankId, rainfallMm = 25.0) => api.post(`/weather/simulate-rain/${tankId}`, null, { params: { rainfall_mm: rainfallMm } }),
}

export default api
