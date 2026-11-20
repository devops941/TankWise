import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { TankProvider } from './contexts/TankContext'
import AppShell from './components/layout/AppShell'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Tanks from './pages/Tanks'
import Readings from './pages/Readings'
import Analysis from './pages/Analysis'
import Anomalies from './pages/Anomalies'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Refills from './pages/Refills'
import WeatherHarvesting from './pages/WeatherHarvesting'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-[#22d3ee] text-xs font-semibold tracking-wider uppercase">Loading TankWise...</p>
        </div>
      </div>
    )
  }
  return user ? <TankProvider><AppShell>{children}</AppShell></TankProvider> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Authenticated Application Routes (AppShell + TankContext) */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/tanks"
          element={
            <PrivateRoute>
              <Tanks />
            </PrivateRoute>
          }
        />
        <Route
          path="/tanks/:tankId/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/tanks/:tankId/readings"
          element={
            <PrivateRoute>
              <Readings />
            </PrivateRoute>
          }
        />
        <Route
          path="/readings"
          element={
            <PrivateRoute>
              <Readings />
            </PrivateRoute>
          }
        />
        <Route
          path="/refills"
          element={
            <PrivateRoute>
              <Refills />
            </PrivateRoute>
          }
        />
        <Route
          path="/weather"
          element={
            <PrivateRoute>
              <WeatherHarvesting />
            </PrivateRoute>
          }
        />
        <Route
          path="/analysis"
          element={
            <PrivateRoute>
              <Analysis />
            </PrivateRoute>
          }
        />
        <Route
          path="/anomalies"
          element={
            <PrivateRoute>
              <Anomalies />
            </PrivateRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <PrivateRoute>
              <Reports />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}
