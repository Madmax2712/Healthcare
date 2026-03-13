import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import MarketTicker from './components/MarketTicker'
import Dashboard from './pages/Dashboard'
import Markets from './pages/Markets'
import Portfolio from './pages/Portfolio'
import Predictions from './pages/Predictions'
import Accuracy from './pages/Accuracy'
import News from './pages/News'
import Login from './pages/Login'
import Register from './pages/Register'
import { wsService } from './services/websocket'
import { useAuthStore } from './store'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dark-bg">
      <Navbar />
      <MarketTicker />
      <main className="max-w-7xl mx-auto px-4 pt-6 pb-12" style={{ marginTop: '100px' }}>
        {children}
      </main>
    </div>
  )
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dark-bg">
      {children}
    </div>
  )
}

export default function App() {
  useEffect(() => {
    // Connect WebSocket for live prices
    wsService.connect()
    return () => wsService.disconnect()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
        <Route path="/register" element={<AuthLayout><Register /></AuthLayout>} />

        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/markets" element={<Layout><Markets /></Layout>} />
        <Route path="/portfolio" element={<Layout><Portfolio /></Layout>} />
        <Route path="/predictions" element={<Layout><Predictions /></Layout>} />
        <Route path="/accuracy" element={<Layout><Accuracy /></Layout>} />
        <Route path="/news" element={<Layout><News /></Layout>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
