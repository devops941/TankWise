import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Droplets, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  full_name: z.string().min(2, 'Name too short'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

export default function Register() {
  const { register: authRegister } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data) => {
    setServerError('')
    try {
      await authRegister(data.email, data.full_name, data.password)
      navigate('/dashboard')
    } catch (err) {
      setServerError(err.response?.data?.detail || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-[#6ee7b7] via-[#38bdf8] to-[#818cf8] relative overflow-hidden font-sans">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-300/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl shadow-slate-900/15 p-6 sm:p-10 relative z-10 border border-white/60">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#6366f1]/10 flex items-center justify-center text-[#6366f1]">
            <Droplets className="w-5 h-5" />
          </div>
          <span className="font-heading font-extrabold text-xl text-gray-900 tracking-tight">
            TankWise
          </span>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Create Account</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Join TankWise to monitor water tank levels, cycle predictions & usage insights.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
            <input
              placeholder="Gokul"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all bg-white ${
                errors.full_name ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
              }`}
              {...register('full_name')}
            />
            {errors.full_name && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all bg-white ${
                errors.email ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
              }`}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="at least 6 characters"
                className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all bg-white ${
                  errors.password ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
                }`}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              placeholder="repeat password"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366f1] focus:border-transparent transition-all bg-white ${
                errors.confirm_password ? 'border-red-400 bg-red-50/20' : 'border-gray-200'
              }`}
              {...register('confirm_password')}
            />
            {errors.confirm_password && (
              <p className="text-xs text-red-500 mt-1 font-medium">{errors.confirm_password.message}</p>
            )}
          </div>

          {serverError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-[#6366f1] hover:bg-[#4f46e5] active:scale-[0.99] transition shadow-md shadow-indigo-500/25 text-sm disabled:opacity-70 mt-2"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#6366f1] font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
