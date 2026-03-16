import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import LivePriceTicker from './components/LivePriceTicker'
import Dashboard from './pages/Dashboard'
import Markets from './pages/Markets'
import Portfolio from './pages/Portfolio'
import Predictions from './pages/Predictions'
import Accuracy from './pages/Accuracy'
import News from './pages/News'
import AutoTrader from './pages/AutoTrader'
import Login from './pages/Login'
import Register from './pages/Register'
import { wsService } from './services/websocket'
import { useAuthStore } from './store'

// Full-screen trading layout (Dashboard)
function TradingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      <Navbar />
      <LivePriceTicker />
      <div style={{ marginTop: '64px', height: 'calc(100vh - 96px)' }} className="overflow-hidden">
        {children}
      </div>
    </div>
  )
}

// Padded page layout (Markets, Portfolio, etc.)
function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Navbar />
      <LivePriceTicker />
      <main className="max-w-7xl mx-auto px-4 pt-6 pb-12" style={{ marginTop: '96px' }}>
        {children}
      </main>
    </div>
  )
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0d1117]">{children}</div>
}

export default function App() {
  useEffect(() => {
    wsService.connect()
    return () => wsService.disconnect()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
        <Route path="/register" element={<AuthLayout><Register /></AuthLayout>} />

        {/* Full-screen trading hub */}
        <Route path="/" element={<TradingLayout><Dashboard /></TradingLayout>} />

        {/* Padded pages */}
        <Route path="/autotrader" element={<PageLayout><AutoTrader /></PageLayout>} />
        <Route path="/markets" element={<PageLayout><Markets /></PageLayout>} />
        <Route path="/portfolio" element={<PageLayout><Portfolio /></PageLayout>} />
        <Route path="/predictions" element={<PageLayout><Predictions /></PageLayout>} />
        <Route path="/accuracy" element={<PageLayout><Accuracy /></PageLayout>} />
        <Route path="/news" element={<PageLayout><News /></PageLayout>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
