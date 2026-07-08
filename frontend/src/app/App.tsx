import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import AdminDashboard from './components/AdminDashboard'
import DonorDashboard from './components/DonorDashboard'
import ReceiverDashboard from './components/ReceiverDashboard'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import DonorRegistrationPage from './pages/DonorRegistrationPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import ReceiverRegistrationPage from './pages/ReceiverRegistrationPage'
import SignupPage from './pages/SignupPage'
import { clearAuthTokens, storeAuthTokens, type AuthUser } from './api'

type Page = 'home' | 'login' | 'signup' | 'donor-register' | 'receiver-register' | 'donor-dashboard' | 'receiver-dashboard' | 'admin-dashboard'

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('foodbridge-theme')
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('foodbridge-user')
      return saved ? JSON.parse(saved) as AuthUser : null
    } catch {
      localStorage.removeItem('foodbridge-user')
      return null
    }
  })
  const [page, setPage] = useState<Page>(() => {
    try {
      const saved = localStorage.getItem('foodbridge-user')
      if (!saved) return 'home'
      const user = JSON.parse(saved) as AuthUser
      if (user.type === 'admin') return 'admin-dashboard'
      return user.type === 'donor' ? 'donor-dashboard' : 'receiver-dashboard'
    } catch {
      return 'home'
    }
  })

  const navigate = (nextPage: Page) => {
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const completeLogin = (user: AuthUser, tokens?: { accessToken?: string; refreshToken?: string }) => {
    setCurrentUser(user)
    localStorage.setItem('foodbridge-user', JSON.stringify(user))
    if (tokens) storeAuthTokens(tokens)
    if (user.type === 'admin') {
      navigate('admin-dashboard')
    } else {
      navigate(user.type === 'donor' ? 'donor-dashboard' : 'receiver-dashboard')
    }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('foodbridge-user')
    clearAuthTokens()
    navigate('home')
  }

  useEffect(() => {
    localStorage.setItem('foodbridge-theme', dark ? 'dark' : 'light')
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    const invalidDashboard =
      (page === 'donor-dashboard' && currentUser?.type !== 'donor') ||
      (page === 'receiver-dashboard' && currentUser?.type !== 'receiver') ||
      (page === 'admin-dashboard' && currentUser?.type !== 'admin')

    if (invalidDashboard) {
      setPage('login')
    }
  }, [currentUser, page])

  const dashboardThemeButton = (
    <button
      type="button"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      onClick={() => setDark((value) => !value)}
      className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#111827] shadow-lg shadow-slate-900/5 backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#16A34A]/40 hover:text-[#16A34A] hover:shadow-xl dark:border-white/[.08] dark:bg-[#111827] dark:text-[#F9FAFB] dark:hover:border-[#22C55E]/40 dark:hover:text-[#22C55E]"
    >
      {dark ? <Moon size={19} /> : <Sun size={19} />}
    </button>
  )

  if (page === 'donor-dashboard') {
    if (!currentUser || currentUser.type !== 'donor') {
      return null
    }
    return <div className={dark ? 'dark' : ''}><DonorDashboard user={currentUser} onLogout={logout} themeToggle={dashboardThemeButton} /></div>
  }

  if (page === 'receiver-dashboard') {
    if (!currentUser || currentUser.type !== 'receiver') {
      return null
    }
    return <div className={dark ? 'dark' : ''}><ReceiverDashboard user={currentUser} onLogout={logout} themeToggle={dashboardThemeButton} /></div>
  }

  if (page === 'admin-dashboard') {
    if (!currentUser || currentUser.type !== 'admin') {
      return null
    }
    return <div className={dark ? 'dark' : ''}><AdminDashboard user={currentUser} onLogout={logout} /></div>
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="foodbridge-shell min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F0FDF4_50%,#ECFDF5_100%)] text-[#111827] transition-colors duration-300 dark:bg-[linear-gradient(180deg,#020617_0%,#0B1220_52%,#111827_100%)] dark:text-[#F9FAFB]">
        <SiteHeader
          dark={dark}
          onHome={() => navigate('home')}
          onLogin={() => navigate('login')}
          onSignup={() => navigate('signup')}
          onToggleTheme={() => setDark((value) => !value)}
        />

        <main id="home">
          {page === 'home' && <LandingPage onDonate={() => navigate('donor-register')} onReceive={() => navigate('receiver-register')} />}
          {page === 'login' && (
            <LoginPage
              onBack={() => navigate('home')}
              onLogin={completeLogin}
            />
          )}
          {page === 'signup' && (
            <SignupPage
              onBack={() => navigate('home')}
              onDonor={() => navigate('donor-register')}
              onReceiver={() => navigate('receiver-register')}
            />
          )}
          {page === 'donor-register' && (
            <DonorRegistrationPage
              onBack={() => navigate('signup')}
              onSubmit={completeLogin}
            />
          )}
          {page === 'receiver-register' && (
            <ReceiverRegistrationPage
              onBack={() => navigate('signup')}
              onSubmit={completeLogin}
            />
          )}
        </main>

        <SiteFooter />
      </div>
    </div>
  )
}
