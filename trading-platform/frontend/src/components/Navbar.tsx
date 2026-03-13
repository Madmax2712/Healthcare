import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  TrendingUp, LayoutDashboard, Globe, Briefcase,
  Newspaper, BarChart2, LogOut, User, Menu, X, Zap
} from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '../store'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/markets', label: 'Markets', icon: Globe },
  { path: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { path: '/predictions', label: 'AI Signals', icon: Zap },
  { path: '/news', label: 'News', icon: Newspaper },
]

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-card/80 backdrop-blur-xl border-b border-dark-border">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-brand-green rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <TrendingUp size={16} className="text-black" />
          </div>
          <span className="font-bold text-lg hidden sm:block">
            Finance<span className="text-brand-green">AI</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                location.pathname === path
                  ? 'bg-brand-green/15 text-brand-green'
                  : 'text-gray-400 hover:text-white hover:bg-dark-hover'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
                <div className="w-7 h-7 bg-brand-green/20 rounded-full flex items-center justify-center">
                  <User size={14} className="text-brand-green" />
                </div>
                <span className="font-medium text-white">{user.username}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-xl hover:bg-dark-hover"
              >
                <LogOut size={15} />
                <span className="hidden sm:block">Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-sm text-gray-400 hover:text-white px-3 py-2">Login</Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-4">Sign Up</Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-dark-card border-t border-dark-border px-4 py-3 space-y-1 animate-slide-up">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                location.pathname === path
                  ? 'bg-brand-green/15 text-brand-green'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
