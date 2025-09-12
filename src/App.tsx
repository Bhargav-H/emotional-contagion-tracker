import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './components/AuthProvider'
import { Login } from './components/Login'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { CheckIn } from './components/CheckIn'
import { PersonalHistory } from './components/PersonalHistory'
import { TeamInsights } from './components/TeamInsights'
import { TeamManagement } from './components/TeamManagement'
import { Settings } from './components/Settings'
import { useAuth } from './hooks/useAuth'

function AppContent() {
  const { user, profile, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')

  if (loading) return <div>Loading...</div>
  if (!user) return <Login />

  // Tabs for everyone + conditional tabs
  const tabs = ['dashboard', 'checkin', 'history', 'settings']

  if (profile?.role === 'MANAGER' || profile?.role === 'ADMIN') {
    tabs.push('team') // for TeamInsights
  }

  if (profile?.role === 'ADMIN') {
    tabs.push('team-management') // for TeamManagement
  }

  function renderContent() {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onNavigate={setActiveTab} />
      case 'checkin': return <CheckIn />
      case 'history': return <PersonalHistory />
      case 'settings': return <Settings />
      case 'team': 
        if (profile?.role === 'MANAGER' || profile?.role === 'ADMIN') {
          return <TeamInsights />
        }
        return <div>Unauthorized</div>
      case 'team-management':
        if (profile?.role === 'ADMIN') {
          return <TeamManagement />
        }
        return <div>Unauthorized</div>
      default: return <Dashboard onNavigate={setActiveTab} />
    }
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  )
}
function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--toast-bg)',
            color: 'var(--toast-color)',
          },
        }}
      />
    </AuthProvider>
  )
}

export default App