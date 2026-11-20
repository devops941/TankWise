import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../services/api'
import { Eye, EyeOff, Droplets, CheckCircle2, ShieldCheck, X, KeyRound, Mail, AlertCircle } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')

  // Forgot password modal states
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1: Email -> 2: OTP + New Password
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data) => {
    setServerError('')
    try {
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Invalid email or password')
    }
  }

  const fillAdminCredentials = () => {
    setValue('email', 'admin@gmail.com', { shouldValidate: true })
    setValue('password', 'Admin@123', { shouldValidate: true })
    setServerError('')
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess('')
    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setForgotError('Please enter a valid email address.')
      return
    }
    setForgotLoading(true)
    try {
      const res = await authApi.forgotPassword(forgotEmail.trim())
      setForgotSuccess(res.data?.message || 'Verification code sent to your email!')
      setForgotStep(2)
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Failed to send reset code. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess('')
    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setForgotError('Please enter the 6-digit verification code from your email.')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setForgotError('New password must be at least 6 characters.')
      return
    }
    setForgotLoading(true)
    try {
      const res = await authApi.resetPassword({
        email: forgotEmail.trim(),
        otp: forgotOtp.trim(),
        new_password: newPassword,
      })
      setForgotSuccess(res.data?.message || 'Password successfully reset!')
      // Auto-fill new credentials into login form
      setValue('email', forgotEmail.trim(), { shouldValidate: true })
      setValue('password', newPassword, { shouldValidate: true })
      setTimeout(() => {
        setShowForgotModal(false)
        setForgotStep(1)
        setForgotOtp('')
        setNewPassword('')
      }, 1500)
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Password reset failed. Invalid code or expired.')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-[#6ee7b7] via-[#38bdf8] to-[#818cf8] relative overflow-hidden font-sans">
      {/* Decorative background shapes */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-300/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl shadow-slate-900/15 overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 border border-white/60">
        
        {/* Left Column: Login Form (7 cols on desktop) */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
          <div>
            {/* Brand Logo Header */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-xl bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1]">
                <Droplets className="w-5 h-5" />
              </div>
              <span className="font-heading font-extrabold text-xl text-gray-900 tracking-tight">
                TankWise
              </span>
            </div>

            {/* Title & Subtitle */}
            <div className="mb-6">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
                Log in.
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm mt-1.5 leading-relaxed">
                Log in with your email and password to access your water monitoring dashboard.
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email Address Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Enter your email address
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  className={`w-full px-3.5 py-2.5 sm:py-3 rounded-xl border text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all bg-white ${
                    errors.email ? 'border-red-400 bg-red-50/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Enter your password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="at least 6 characters"
                    className={`w-full px-3.5 py-2.5 sm:py-3 pr-10 rounded-xl border text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all bg-white ${
                      errors.password ? 'border-red-400 bg-red-50/20' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1 font-medium">{errors.password.message}</p>
                )}

                {/* Forgot Password Link */}
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError('')
                      setForgotSuccess('')
                      setForgotStep(1)
                      setShowForgotModal(true)
                    }}
                    className="text-xs text-[#6366f1] hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Server Error Message */}
              {serverError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  {serverError}
                </div>
              )}

              {/* Primary Log In Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 sm:py-3.5 px-4 rounded-xl font-semibold text-white bg-[#6366f1] hover:bg-[#4f46e5] active:scale-[0.99] transition shadow-md shadow-indigo-500/25 text-sm disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Log in'
                )}
              </button>
            </form>
          </div>

          {/* Bottom Register Prompt */}
          <p className="text-center text-xs text-gray-500 mt-6">
            {"Don't have an account? "}
            <Link to="/register" className="text-[#6366f1] font-semibold hover:underline">
              Register
            </Link>
          </p>
        </div>

        {/* Right Column: Graphic & Welcome Back (5 cols on desktop) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#f8f7ff] via-[#f3f0ff] to-[#ede9fe] p-8 sm:p-10 flex flex-col justify-between items-center text-center relative overflow-hidden border-t lg:border-t-0 lg:border-l border-purple-100">
          {/* Ambient soft glow elements */}
          <div className="absolute top-1/4 -right-12 w-48 h-48 bg-purple-300/30 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-10 -left-12 w-48 h-48 bg-indigo-300/30 rounded-full blur-2xl pointer-events-none" />

          {/* Header text */}
          <div className="relative z-10 pt-2">
            <span className="text-xs font-semibold text-gray-500 tracking-wider">
              Nice to see you again
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#6366f1] tracking-tight mt-1">
              Welcome back
            </h2>
          </div>

          {/* Modern Water Intelligence & Dashboard Illustration */}
          <div className="relative z-10 my-6 w-full max-w-xs flex flex-col items-center">
            {/* SVG Vector Scene */}
            <div className="relative w-64 h-56 flex items-center justify-center">
              {/* Background circular aura */}
              <div className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-[#6366f1]/15 to-[#38bdf8]/20 animate-pulse" />

              {/* Decorative floating dots/bubbles */}
              <div className="absolute top-4 left-6 w-3 h-3 rounded-full bg-[#6366f1]/30 animate-bounce" />
              <div className="absolute top-12 right-6 w-2.5 h-2.5 rounded-full bg-[#38bdf8]/40" />
              <div className="absolute bottom-8 left-10 w-2 h-2 rounded-full bg-purple-400/40" />

              {/* SVG Graphic: Smart Water Tank & Level Monitor */}
              <svg className="w-56 h-48 drop-shadow-md" viewBox="0 0 240 200" fill="none">
                <ellipse cx="120" cy="180" rx="90" ry="12" fill="#c7d2fe" fillOpacity="0.4" />
                <rect x="75" y="45" width="90" height="120" rx="45" fill="#ffffff" stroke="#818cf8" strokeWidth="3" />
                <path
                  d="M78 110 C90 105, 105 115, 120 110 C135 105, 150 115, 162 110 L162 120 C162 144, 143 163, 120 163 C97 163, 78 144, 78 120 Z"
                  fill="url(#waterGrad)"
                />
                <line x1="88" y1="75" x2="100" y2="75" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
                <line x1="88" y1="95" x2="105" y2="95" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
                <line x1="88" y1="115" x2="100" y2="115" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
                <line x1="88" y1="135" x2="105" y2="135" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
                <circle cx="120" cy="80" r="14" fill="#6366f1" />
                <path
                  d="M120 72 C118 75, 114 80, 114 82 C114 85.3, 116.7 88, 120 88 C123.3 88, 126 85.3, 126 82 C126 80, 122 75, 120 72 Z"
                  fill="#ffffff"
                />
                <path d="M120 45 L120 30" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
                <circle cx="120" cy="27" r="4" fill="#38bdf8" />
                <path d="M112 25 C116 20, 124 20, 128 25" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />

                <g transform="translate(140, 65)">
                  <rect width="78" height="34" rx="8" fill="#ffffff" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.08))" />
                  <circle cx="14" cy="17" r="6" fill="#34d399" />
                  <text x="26" y="15" fill="#1e293b" fontSize="9" fontWeight="bold">92% Full</text>
                  <text x="26" y="25" fill="#64748b" fontSize="7">Optimal Flow</text>
                </g>

                <g transform="translate(18, 110)">
                  <rect width="82" height="34" rx="8" fill="#ffffff" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.08))" />
                  <circle cx="14" cy="17" r="6" fill="#6366f1" />
                  <text x="26" y="15" fill="#1e293b" fontSize="9" fontWeight="bold">Next Refill</text>
                  <text x="26" y="25" fill="#64748b" fontSize="7">In 3.4 days</text>
                </g>

                <defs>
                  <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-purple-200/60 shadow-sm text-xs text-purple-900 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Real-time Tank Monitoring Active
            </div>
          </div>

          <div className="relative z-10 text-xs text-gray-400 pb-1">
            Water Tank Usage Intelligence & Refill Cycle Analysis
          </div>
        </div>
      </div>

      {/* Forgot Password / Reset Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Reset Password</h3>
                <p className="text-xs text-gray-500">
                  {forgotStep === 1 ? 'Step 1: Get 6-digit verification code' : 'Step 2: Enter code & new password'}
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-gray-600 leading-relaxed">
                  Enter your registered email address. We will immediately dispatch a 6-digit verification code to your inbox.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 rounded-xl bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Sending Code...' : 'Send Verification Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    6-Digit Verification Code (Sent to Email)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-base font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-xs text-[#6366f1] hover:underline font-medium"
                  >
                    ← Back to Email
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Resetting Password...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
