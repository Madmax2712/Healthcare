import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { authApi } from '../services/api'
import { useAuthStore } from '../store'

export default function Register() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await authApi.register(form.email, form.username, form.password)
      setAuth(data.user, data.access_token)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const perks = [
    '$100,000 paper trading balance',
    'AI signals for 40+ symbols',
    'US, India & Crypto markets',
    'Real-time news sentiment',
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-slide-up">
        {/* Logo */}
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-green rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-green/20">
            <TrendingUp size={28} className="text-black" />
          </div>
          <h1 className="text-3xl font-bold">Create account</h1>
          <p className="text-gray-500 mt-1">Start trading with AI today</p>
        </div>

        {/* Perks */}
        <div className="grid grid-cols-2 gap-2">
          {perks.map(p => (
            <div key={p} className="flex items-start gap-2 text-xs text-gray-400">
              <CheckCircle size={13} className="text-brand-green mt-0.5 flex-shrink-0" />
              {p}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm p-3 rounded-xl">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {[
            { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
            { key: 'username', label: 'Username', type: 'text', placeholder: 'Choose a username' },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key} className="space-y-2">
              <label className="text-sm text-gray-400">{label}</label>
              <input
                type={type}
                value={(form as any)[key]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={placeholder}
                className="input-field"
                required
              />
            </div>
          ))}

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Min 8 characters"
                className="input-field pr-10"
                minLength={6}
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Confirm Password</label>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => update('confirm', e.target.value)}
              placeholder="Repeat password"
              className="input-field"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating account...' : 'Create Free Account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-green hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
