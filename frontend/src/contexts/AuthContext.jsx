import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('tw_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('tw_token')
    if (token) {
      authApi.me()
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('tw_token')
          localStorage.removeItem('tw_user')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await authApi.login({ email, password })
    const { access_token, ...userData } = res.data
    localStorage.setItem('tw_token', access_token)
    localStorage.setItem('tw_user', JSON.stringify(userData))
    localStorage.removeItem('tw_selected_tank_id')
    setUser(userData)
    return userData
  }

  const register = async (email, full_name, password) => {
    const res = await authApi.register({ email, full_name, password })
    const { access_token, ...userData } = res.data
    localStorage.setItem('tw_token', access_token)
    localStorage.setItem('tw_user', JSON.stringify(userData))
    localStorage.removeItem('tw_selected_tank_id')
    setUser(userData)
    return userData
  }

  const googleLogin = async (data) => {
    const res = await authApi.googleAuth(data)
    const { access_token, ...userData } = res.data
    localStorage.setItem('tw_token', access_token)
    localStorage.setItem('tw_user', JSON.stringify(userData))
    localStorage.removeItem('tw_selected_tank_id')
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('tw_token')
    localStorage.removeItem('tw_user')
    localStorage.removeItem('tw_selected_tank_id')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
