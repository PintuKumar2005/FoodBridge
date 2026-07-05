import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle, BarChart3, Bell, Bookmark, CalendarDays, Check, CheckCircle2, Clock3, Compass,
  LayoutDashboard, LogOut, MapPin, Menu, MessageSquare, Moon,
  Package, Search, Send, ShieldCheck, Sparkles,
  Truck, UserCircle, Users, Utensils, X, XCircle,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  createFoodRequest, getDonations, getFoodRequests, getProfile, updateFoodRequest,
  type AnalyticsResponse, type AppNotification, type AuthUser, type DashboardMessage, type FoodDonation, type FoodRequest, type ProfileResponse, type StoredDocument,
} from '../api'

interface ReceiverDashboardProps {
  user: AuthUser
  onLogout: () => void
  themeToggle?: ReactNode
}

type ReceiverSection =
  | 'overview'
  | 'available'
  | 'requests'
  | 'organizations'
  | 'messages'
  | 'notifications'
  | 'profile'

const receiverSections: ReceiverSection[] = ['overview', 'available', 'requests', 'organizations', 'messages', 'notifications', 'profile']

type RequestModalState = {
  donation: FoodDonation
  quantity: number
  pickupTime: string
  message: string
  notes: string
}

type ReceiverNotification = {
  id: string
  title: string
  detail: string
  createdAt: string
  unread: boolean
  tone: 'food' | 'success' | 'info'
}

const requestStatusStyles: Record<FoodRequest['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/20',
  rejected: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-400/10 dark:text-red-200 dark:ring-red-400/20',
  collected: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/15',
}

const chartColors = ['#16a34a', '#22c55e', '#38bdf8', '#f59e0b', '#8b5cf6']

function asArray<T>(payload: T[] | { [key: string]: T[] | unknown }, key: string): T[] {
  if (Array.isArray(payload)) return payload
  const value = payload[key]
  return Array.isArray(value) ? value as T[] : []
}

function unwrapProfile(payload: ProfileResponse | { profile?: ProfileResponse | null; user?: ProfileResponse } | null): ProfileResponse | null {
  if (!payload) return null
  if ('profile' in payload && payload.profile) return payload.profile
  if ('user' in payload && payload.user) return payload.user
  if ('profile' in payload || 'user' in payload) return null
  return payload as ProfileResponse
}

function formatDate(value?: string) {
  if (!value) return 'Not available'
  return new Date(value).toLocaleString()
}

function getRequestDate(request: FoodRequest) {
  return request.requestedAt || request.createdAt || ''
}

function getMonthKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Date(year, month - 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function searchableText(values: unknown[]) {
  return values
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase()
}

function dateTimeLocal(hoursAhead: number) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function getFoodImage(food: FoodDonation) {
  return food.image?.url || food.image?.data
}

function pickupLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Pickup time not set'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function receiverTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    ngo: 'NGO',
    old_age_home: 'Old Age Home',
    orphanage: 'Orphanage',
    school: 'School',
    hospital: 'Hospital',
    community_kitchen: 'Community Kitchen',
    shelter_home: 'Shelter Home',
    temple: 'Temple',
    mosque: 'Mosque',
    church: 'Church',
    individual: 'Individual',
    family: 'Family',
  }
  return labels[String(type || '').toLowerCase()] || type || 'Receiver'
}

function calculateImpactScore(requests: FoodRequest[], mealsReceived: number) {
  const completed = requests.filter((request) => request.status === 'collected').length
  const accepted = requests.filter((request) => ['approved', 'collected'].includes(request.status)).length
  return Math.min(100, Math.round(completed * 12 + accepted * 8 + mealsReceived / 25))
}

export default function ReceiverDashboard({ user, onLogout, themeToggle }: ReceiverDashboardProps) {
  const [availableFood, setAvailableFood] = useState<FoodDonation[]>([])
  const [myRequests, setMyRequests] = useState<FoodRequest[]>([])
  const [backendNotifications, setBackendNotifications] = useState<AppNotification[]>([])
  const [messages, setMessages] = useState<DashboardMessage[]>([])
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [activeSection, setActiveSection] = useState<ReceiverSection>('overview')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [foodType, setFoodType] = useState<'All' | FoodDonation['foodType']>('All')
  const [loading, setLoading] = useState(true)
  const [requestingFood, setRequestingFood] = useState('')
  const [collectingRequest, setCollectingRequest] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [notificationError, setNotificationError] = useState('')
  const [requestError, setRequestError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [analyticsError, setAnalyticsError] = useState('')
  const [selectedFood, setSelectedFood] = useState<FoodDonation | null>(null)
  const [requestModal, setRequestModal] = useState<RequestModalState | null>(null)

  const currentProfile = profile ?? user
  const displayName = currentProfile.organizationName || currentProfile.name
  const typeLabel = receiverTypeLabel(currentProfile.organizationType)
  const initials = displayName.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setNotificationError('')
    setRequestError('')
    setMessageError('')
    setAnalyticsError('')

    const [foodResult, requestResult, profileResult] = await Promise.allSettled([
      getDonations({ status: 'available' }),
      getFoodRequests({ receiverId: user.id }),
      getProfile({ userId: user.id }),
    ])

    if (foodResult.status === 'fulfilled') {
      setAvailableFood(foodResult.value.donations)
    } else {
      setMessage({ type: 'error', text: foodResult.reason instanceof Error ? foodResult.reason.message : 'Could not load available food.' })
    }

    if (requestResult.status === 'fulfilled') {
      setMyRequests(asArray<FoodRequest>(requestResult.value, 'requests'))
    } else {
      setMyRequests([])
      setRequestError(requestResult.reason instanceof Error ? requestResult.reason.message : 'Could not load food requests.')
    }

    setBackendNotifications([])
    setMessages([])
    setAnalytics(null)
    if (profileResult.status === 'fulfilled') {
      setProfile(unwrapProfile(profileResult.value))
    } else {
      setProfile(null)
    }

    setLoading(false)
  }, [user.id])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  useEffect(() => {
    if (!receiverSections.includes(activeSection)) {
      setActiveSection('overview')
    }
  }, [activeSection])

  const openRequestModal = (food: FoodDonation) => {
    const existingRequest = myRequests.find((request) => request.foodId === food.id && request.status === 'pending')
    if (existingRequest) {
      setMessage({ type: 'info', text: 'You already have a pending request for this food item.' })
      return
    }
    setRequestModal({
      donation: food,
      quantity: food.quantity,
      pickupTime: dateTimeLocal(1),
      message: `We would like to receive ${food.foodName}.`,
      notes: '',
    })
  }

  const submitFoodRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!requestModal) return

    setRequestingFood(requestModal.donation.id)
    setMessage(null)
    try {
      await createFoodRequest({
        foodId: requestModal.donation.id,
        receiverId: user.id,
        requiredQuantity: requestModal.quantity,
        pickupTime: new Date(requestModal.pickupTime).toISOString(),
        message: requestModal.message,
        notes: requestModal.notes,
      })
      setRequestModal(null)
      await loadDashboard()
      setActiveSection('requests')
      setMessage({ type: 'success', text: 'Food request sent to the donor.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not send food request.' })
    } finally {
      setRequestingFood('')
    }
  }

  const markAsCollected = async (requestId: string) => {
    if (!window.confirm('Mark this food as collected?')) return

    setCollectingRequest(requestId)
    setMessage(null)
    try {
      await updateFoodRequest(requestId, { action: 'collected', userId: user.id })
      await loadDashboard()
      setMessage({ type: 'success', text: 'Food marked as collected.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not update collection.' })
    } finally {
      setCollectingRequest('')
    }
  }

  const acceptedRequests = myRequests.filter((request) => request.status === 'approved')
  const completedRequests = myRequests.filter((request) => request.status === 'collected')
  const pendingRequests = myRequests.filter((request) => request.status === 'pending')
  const mealsReceived = completedRequests.reduce((sum, request) => {
    const donation = availableFood.find((food) => food.id === request.foodId)
    return sum + Number(donation?.quantity || 1)
  }, analytics?.mealsReceived ?? 0)
  const todayFood = availableFood.filter((food) => new Date(food.createdAt).toDateString() === new Date().toDateString()).length
  const impactScore = calculateImpactScore(myRequests, mealsReceived)

  const normalizedSearch = search.trim().toLowerCase()
  const filteredFood = useMemo(() => availableFood.filter((food) => {
    const matchesSearch = !normalizedSearch || searchableText([
      food.foodName,
      food.foodType,
      food.donorName,
      food.organizationName,
      food.location,
      food.description,
      food.quantity,
      food.unit,
      food.status,
      formatDate(food.pickupTime),
      formatDate(food.expiryTime),
    ]).includes(normalizedSearch)
    const matchesType = foodType === 'All' || food.foodType === foodType
    return matchesSearch && matchesType
  }), [availableFood, foodType, normalizedSearch])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (value.trim() && activeSection !== 'available') {
      setActiveSection('available')
    }
  }

  const notifications = useMemo<ReceiverNotification[]>(() => {
    const apiNotifications = backendNotifications.map((notification) => ({
      id: notification.id,
      title: notification.subject || notification.title || 'FoodBridge update',
      detail: notification.message || notification.detail || 'New activity on your receiver account.',
      createdAt: notification.createdAt || new Date().toISOString(),
      unread: notification.read === false,
      tone: String(notification.type || '').toLowerCase().includes('accepted') || String(notification.type || '').toLowerCase().includes('delivered') ? 'success' : 'info',
    } satisfies ReceiverNotification))

    const requestNotifications = myRequests.map((request) => ({
      id: `request-${request.id}`,
      title: request.status === 'pending' ? 'Food request pending' : `Food request ${request.status}`,
      detail: `${request.foodName} from ${request.donorOrg} is ${request.status}.`,
      createdAt: getRequestDate(request) || new Date().toISOString(),
      unread: request.status === 'pending',
      tone: request.status === 'approved' || request.status === 'collected' ? 'success' : request.status === 'pending' ? 'food' : 'info',
    } satisfies ReceiverNotification))

    return [...apiNotifications, ...requestNotifications]
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
      .slice(0, 12)
  }, [backendNotifications, myRequests])

  const unreadNotifications = notifications.filter((notification) => notification.unread).length
  const derivedAnalytics = useMemo(() => buildAnalytics(myRequests, availableFood, analytics), [analytics, availableFood, myRequests])

  const stats = [
    ['Available Food', availableFood.length, Utensils, 'bg-emerald-600'],
    ['Pending Requests', pendingRequests.length, Send, 'bg-amber-500'],
    ['Accepted Donations', acceptedRequests.length, CheckCircle2, 'bg-blue-600'],
    ['Completed Deliveries', completedRequests.length, Truck, 'bg-violet-600'],
    ['Meals Received', mealsReceived, Package, 'bg-teal-500'],
    ['Families Served', completedRequests.length, Users, 'bg-lime-600'],
    ["Today's Available", todayFood, Sparkles, 'bg-cyan-600'],
    ['Impact Score', impactScore, BarChart3, 'bg-slate-900 dark:bg-emerald-500'],
  ] as const

  const navItems = [
    ['overview', 'Dashboard', LayoutDashboard],
    ['available', 'Available Food', Utensils],
    ['requests', 'My Requests', Send],
    ['organizations', 'Organizations', Users],
    ['messages', 'Messages', MessageSquare],
    ['notifications', 'Notifications', Bell],
    ['profile', 'Profile', UserCircle],
  ] as const

  return (
    <div className="receiver-workspace min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F0FDF4_52%,#ECFDF5_100%)] text-[#111827] dark:bg-[linear-gradient(180deg,#020617_0%,#0B1220_52%,#111827_100%)] dark:text-[#F9FAFB]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[292px] shrink-0 flex-col border-r border-[#E5E7EB] p-4 dark:border-white/[.08] lg:flex">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <button onClick={() => setActiveSection('overview')} className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#0F766E] text-white shadow-lg shadow-emerald-500/20 dark:from-[#15803D] dark:to-[#0F766E] dark:shadow-emerald-950/40"><Utensils size={23} /></span>
              <span className="min-w-0 text-left"><span className="block text-xl font-black tracking-tight">FoodBridge</span><span className="block text-[10px] font-black uppercase tracking-[.22em] text-slate-400">Receiver console</span></span>
            </button>
          </div>

          <nav className="mt-7 space-y-1.5 overflow-y-auto pr-1">
            {navItems.map(([value, label, Icon]) => (
              <button key={value} onClick={() => setActiveSection(value)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition duration-200 ${activeSection === value ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 dark:bg-gradient-to-r dark:from-[#166534] dark:to-[#0F766E] dark:shadow-emerald-950/40' : 'text-slate-500 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-800 hover:ring-1 hover:ring-emerald-200 hover:shadow-lg hover:shadow-emerald-500/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:hover:ring-white/10 dark:hover:shadow-none'}`}>
                <Icon size={19} className="shrink-0" />
                <span className="truncate">{label}</span>
                {value === 'notifications' && unreadNotifications > 0 && <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-[10px] text-white">{unreadNotifications}</span>}
                {value === 'requests' && pendingRequests.length > 0 && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">{pendingRequests.length}</span>}
              </button>
            ))}
          </nav>
        </aside>

        <main className="w-0 min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white/[.65] px-4 py-4 shadow-[0_10px_40px_rgba(15,23,42,.08)] backdrop-blur-[20px] dark:border-white/[.08] dark:bg-[#111827]/60 dark:shadow-[0_20px_50px_rgba(0,0,0,.45)] lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <button
                  aria-label="Open menu"
                  aria-expanded={mobileMenuOpen}
                  onClick={() => {
                    setMobileMenuOpen((open) => !open)
                    setNotificationsOpen(false)
                    setProfileOpen(false)
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white lg:hidden"
                >
                  {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
                </button>
                <div>
                  <h1 className="text-2xl font-black tracking-[-.03em] md:text-3xl">Welcome back, {currentProfile.name || displayName}</h1>
                  <p className="mt-1 hidden text-sm font-semibold text-slate-500 dark:text-slate-300 md:block">A calm command center for available food, requests, and impact.</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-center gap-3 xl:justify-end">
                <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-500 shadow-sm transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100 dark:border-white/10 dark:bg-white/5 dark:focus-within:ring-emerald-400/10 xl:max-w-[440px]">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder="Search food, donor, address"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none dark:text-white"
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
                      <X size={15} />
                    </button>
                  )}
                </label>
                {themeToggle ?? <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white"><Moon size={18} /></button>}
                <div className="relative">
                  <button onClick={() => {
                    setNotificationsOpen((open) => !open)
                    setProfileOpen(false)
                  }} aria-label="Open notifications" className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-600 hover:shadow-lg hover:shadow-emerald-500/10 dark:bg-white/5 dark:hover:border-emerald-400/30 dark:hover:text-emerald-300 dark:hover:shadow-emerald-950/30 ${notificationsOpen ? 'border-emerald-300 text-emerald-600 shadow-lg shadow-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-300' : 'border-slate-200 text-slate-700 dark:border-white/10 dark:text-white'}`}>
                    <Bell size={18} className="transition duration-200 group-hover:rotate-6" />
                    {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">{unreadNotifications}</span>}
                  </button>
                  {notificationsOpen && <NotificationPanel notifications={notifications} unreadCount={unreadNotifications} error={notificationError} onClose={() => setNotificationsOpen(false)} onViewAll={() => { setActiveSection('notifications'); setNotificationsOpen(false) }} />}
                </div>
                <div className="relative">
                  <button onClick={() => {
                    setProfileOpen((open) => !open)
                    setNotificationsOpen(false)
                  }} aria-label="Open receiver profile" className="rounded-2xl outline-none ring-offset-2 ring-offset-[#f8fafc] transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-emerald-100 dark:ring-offset-[#020617] dark:focus-visible:ring-emerald-400/20">
                    <Avatar profile={currentProfile} initials={initials} size="sm" />
                  </button>
                  {profileOpen && (
                    <ProfileCard
                      profile={currentProfile}
                      initials={initials}
                      onClose={() => setProfileOpen(false)}
                      onLogout={onLogout}
                    />
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1520px] p-4 lg:p-6">
            {message && <StatusMessage message={message} onClose={() => setMessage(null)} />}
            {activeSection === 'overview' && (
              <div className="space-y-5">
                <WelcomeBanner profile={currentProfile} typeLabel={typeLabel} onBrowse={() => setActiveSection('available')} onRequest={() => setActiveSection('available')} />
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {stats.map(([label, value, Icon, tone]) => <StatCard key={label} label={label} value={value} icon={Icon} tone={tone} />)}
                </section>
                <AnalyticsPanel analytics={derivedAnalytics} error={analyticsError} />
              </div>
            )}

            {activeSection === 'available' && (
              <AvailableFoodView
                foods={filteredFood}
                loading={loading}
                requests={myRequests}
                onView={setSelectedFood}
                onRequest={openRequestModal}
                requestingFood={requestingFood}
                foodType={foodType}
                onFoodType={setFoodType}
              />
            )}
            {activeSection === 'requests' && <RequestsView requests={myRequests} loading={loading} error={requestError} onCollected={markAsCollected} collecting={collectingRequest} onBrowse={() => setActiveSection('available')} />}
            {activeSection === 'organizations' && (
              <EmptyPanel icon={Users} title="Organization directory is not connected yet" copy="Verified organization listings will appear here when the backend returns them." />
            )}
            {activeSection === 'messages' && <MessagesPanel messages={messages} error={messageError} />}
            {activeSection === 'notifications' && <NotificationsPage notifications={notifications} error={notificationError} />}
            {activeSection === 'profile' && <ProfilePanel profile={currentProfile} onLogout={onLogout} />}
          </div>
        </main>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close receiver menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 flex h-full w-[min(86vw,320px)] flex-col border-r border-[#E5E7EB] bg-white p-4 text-[#111827] shadow-[0_20px_50px_rgba(15,23,42,.22)] dark:border-white/[.08] dark:bg-[#111827] dark:text-[#F9FAFB] dark:shadow-[0_20px_50px_rgba(0,0,0,.55)]">
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <button type="button" onClick={() => { setActiveSection('overview'); setMobileMenuOpen(false) }} className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#0F766E] text-white shadow-lg shadow-emerald-500/20 dark:from-[#15803D] dark:to-[#0F766E] dark:shadow-emerald-950/40"><Utensils size={23} /></span>
                <span className="min-w-0 text-left"><span className="block text-xl font-black tracking-tight">FoodBridge</span><span className="block text-[10px] font-black uppercase tracking-[.22em] text-slate-400">Receiver console</span></span>
              </button>
              <button type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"><X size={19} /></button>
            </div>

            <nav className="mt-7 space-y-1.5 overflow-y-auto pr-1">
              {navItems.map(([value, label, Icon]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => {
                    setActiveSection(value)
                    setMobileMenuOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition duration-200 ${activeSection === value ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 dark:bg-gradient-to-r dark:from-[#166534] dark:to-[#0F766E] dark:shadow-emerald-950/40' : 'text-slate-500 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-800 hover:ring-1 hover:ring-emerald-200 hover:shadow-lg hover:shadow-emerald-500/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:ring-white/10 dark:hover:shadow-none'}`}
                >
                  <Icon size={19} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {value === 'notifications' && unreadNotifications > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] text-white">{unreadNotifications}</span>}
                  {value === 'requests' && pendingRequests.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">{pendingRequests.length}</span>}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {selectedFood && <FoodDetailsModal food={selectedFood} pending={myRequests.some((request) => request.foodId === selectedFood.id && request.status === 'pending')} onClose={() => setSelectedFood(null)} onRequest={() => { setSelectedFood(null); openRequestModal(selectedFood) }} />}
      {requestModal && <RequestFoodModal state={requestModal} setState={setRequestModal} onClose={() => setRequestModal(null)} onSubmit={submitFoodRequest} submitting={requestingFood === requestModal.donation.id} />}
    </div>
  )
}

function LoaderIcon() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
}

function StatusMessage({ message, onClose }: { message: { type: 'success' | 'error' | 'info'; text: string }; onClose: () => void }) {
  return (
    <div role={message.type === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mb-5 flex items-start justify-between gap-4 rounded-3xl border px-5 py-4 text-sm font-bold ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200' : message.type === 'info' ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>
      <span className="flex items-start gap-3">{message.type === 'error' ? <AlertCircle className="mt-0.5 shrink-0" size={18} /> : <CheckCircle2 className="mt-0.5 shrink-0" size={18} />}{message.text}</span>
      <button onClick={onClose} aria-label="Dismiss message" className="shrink-0 opacity-60 transition hover:opacity-100"><X size={17} /></button>
    </div>
  )
}

function Avatar({ profile, initials, size }: { profile: Partial<ProfileResponse>; initials: string; size: 'sm' | 'md' | 'lg' }) {
  const classes = size === 'lg' ? 'h-20 w-20 text-2xl rounded-3xl' : 'h-12 w-12 text-base rounded-2xl'
  return profile.profileImageUrl ? <img src={profile.profileImageUrl} alt="" className={`${classes} object-cover ring-1 ring-slate-200 dark:ring-white/10`} /> : <span className={`${classes} flex shrink-0 items-center justify-center bg-emerald-500 font-black text-white shadow-lg shadow-emerald-500/20`}>{initials}</span>
}

function WelcomeBanner({ profile, typeLabel, onBrowse, onRequest }: { profile: ProfileResponse; typeLabel: string; onBrowse: () => void; onRequest: () => void }) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)]">
      <div className="p-6 md:p-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[.18em] text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">{typeLabel}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-300"><ShieldCheck size={13} />{profile.status || profile.verificationStatus || 'Active'}</span>
          </div>
          <h2 className="mt-5 max-w-3xl text-3xl font-black tracking-[-.04em] md:text-5xl">Find food support.</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">Discover available food and manage every request from one trusted workspace.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={onBrowse} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20"><Utensils size={18} />Browse Food</button>
            <button onClick={onRequest} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white"><Send size={18} />Request Food</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Utensils; tone: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 dark:border-white/10 dark:bg-white/[.05]">
      <div className="flex items-start justify-between"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${tone}`}><Icon size={22} /></span><Sparkles size={17} className="text-emerald-500" /></div>
      <p className="mt-5 text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight">{value.toLocaleString()}</p>
    </article>
  )
}

function AvailableFoodView({ foods, loading, requests, onView, onRequest, requestingFood, foodType, onFoodType }: { foods: FoodDonation[]; loading: boolean; requests: FoodRequest[]; onView: (food: FoodDonation) => void; onRequest: (food: FoodDonation) => void; requestingFood: string; foodType: 'All' | FoodDonation['foodType']; onFoodType: (value: 'All' | FoodDonation['foodType']) => void }) {
  const foodTypes = ['All', 'Veg', 'Non-Veg'] as const

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[.05]">
        <div className="flex flex-col gap-5 p-5 md:flex-row md:items-end md:justify-between md:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-orange-600 dark:text-orange-300">Available food</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Food options</h2>
            <p className="mt-2 max-w-xl text-sm font-semibold text-slate-500 dark:text-slate-400">Browse fresh donations within 10 km of your saved receiver location.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {foodTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onFoodType(type)}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-black transition ${
                  foodType === type
                    ? 'bg-slate-950 text-white shadow-lg shadow-slate-900/15 dark:bg-emerald-500 dark:shadow-emerald-950/30'
                    : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-orange-50 hover:text-orange-700 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/15'
                }`}
              >
                {type === foodType && <Compass size={15} />}
                {type}
              </button>
            ))}
          </div>
        </div>
      </section>
      <FoodGrid title="Available food" foods={foods} loading={loading} requests={requests} onView={onView} onRequest={onRequest} requestingFood={requestingFood} />
    </div>
  )
}

function FoodGrid({ title, foods, loading, requests, onView, onRequest, requestingFood }: { title: string; foods: FoodDonation[]; loading: boolean; requests: FoodRequest[]; onView: (food: FoodDonation) => void; onRequest: (food: FoodDonation) => void; requestingFood: string }) {
  const hasPendingRequest = (foodId: string) => requests.some((request) => request.foodId === foodId && request.status === 'pending')

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[.05] md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.22em] text-orange-600 dark:text-orange-300">Available food</p>
          <h2 className="mt-2 text-2xl font-black">{title}</h2>
        </div>
        <p className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">{foods.length} shown</p>
      </div>
      {loading && <div className="mt-5 grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-[360px] animate-pulse rounded-[28px] bg-slate-100 dark:bg-white/10" />)}</div>}
      {!loading && foods.length === 0 && <EmptyInline icon={Utensils} title="No nearby food donations" copy="Food donations will appear here when a donor publishes within 10 km of your saved receiver location." />}
      {!loading && foods.length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {foods.map((food) => {
            const pending = hasPendingRequest(food.id)
            return (
              <article key={food.id} className="group overflow-hidden rounded-[28px] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10 dark:bg-white/[.04] dark:hover:shadow-black/30">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-orange-50 dark:bg-white/10">
                  {getFoodImage(food) ? (
                    <img src={getFoodImage(food)} alt={food.foodName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center bg-[linear-gradient(135deg,#fff7ed,#dcfce7)] text-orange-600 dark:bg-[linear-gradient(135deg,rgba(251,146,60,.16),rgba(34,197,94,.14))] dark:text-orange-200">
                      <Utensils size={42} />
                      <span className="mt-3 text-sm font-black">{food.foodName}</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 to-transparent p-3">
                    <p className="text-lg font-black text-white">{food.quantity} {food.unit} available</p>
                  </div>
                  <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-black shadow-sm ${food.foodType === 'Non-Veg' ? 'bg-red-50 text-red-700' : food.foodType === 'Both' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>{food.foodType}</span>
                  <button aria-label="Bookmark food" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:text-orange-600"><Bookmark size={16} /></button>
                </div>
                <div className="px-1 pb-1 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-black tracking-tight">{food.foodName}</h3>
                      <p className="mt-1 truncate text-sm font-bold text-slate-500 dark:text-slate-400">{food.organizationName || food.donorName}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-black text-white"><ShieldCheck size={12} />Open</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-300">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/10">Pickup {pickupLabel(food.pickupTime)}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-white/10">{food.status}</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <p className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-orange-500" size={16} /><span className="line-clamp-2">{food.location}</span></p>
                    <p className="flex items-center gap-2"><Sparkles className="shrink-0 text-orange-500" size={16} /><span className="truncate">Expires {formatDate(food.expiryTime)}</span></p>
                  </div>
                  {food.description && <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{food.description}</p>}
                  <div className="mt-4 grid grid-cols-[1fr_1.2fr] gap-2">
                    <button onClick={() => onView(food)} className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">View</button>
                    <button onClick={() => onRequest(food)} disabled={pending || requestingFood === food.id} className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${pending ? 'bg-slate-200 text-slate-500 dark:bg-white/10' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>{pending ? 'Pending' : requestingFood === food.id ? 'Sending...' : 'Request'}</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}


function RequestsView({ requests, loading, error, onCollected, collecting, onBrowse, title = 'My food requests' }: { requests: FoodRequest[]; loading: boolean; error: string; onCollected: (id: string) => void; collecting: string; onBrowse: () => void; title?: string }) {
  const [selectedMonth, setSelectedMonth] = useState('')
  const monthOptions = useMemo(() => {
    const monthMap = new Map<string, number>()
    requests.forEach((request) => {
      const key = getMonthKey(getRequestDate(request))
      if (!key) return
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
    })
    return Array.from(monthMap.entries())
      .sort(([first], [second]) => second.localeCompare(first))
      .map(([value, count]) => ({ value, label: formatMonthLabel(value), count }))
  }, [requests])
  const visibleRequests = useMemo(() => {
    if (!selectedMonth) return requests
    return requests.filter((request) => getMonthKey(getRequestDate(request)) === selectedMonth)
  }, [requests, selectedMonth])

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[.05] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Requests</p>
          <h2 className="mt-2 text-2xl font-black">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{visibleRequests.length} of {requests.length} requests shown</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
            <CalendarDays size={17} />
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="min-w-[170px] bg-transparent text-sm font-black outline-none dark:text-white">
              <option value="">All months</option>
              {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label} ({month.count})</option>)}
            </select>
          </label>
          {selectedMonth && <button type="button" onClick={() => setSelectedMonth('')} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/15">Clear</button>}
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {loading && <p className="rounded-3xl bg-slate-50 px-5 py-8 text-center text-sm font-bold text-slate-500 dark:bg-white/5 dark:text-slate-300">Loading food requests...</p>}
        {!loading && error && <EmptyInline icon={AlertCircle} title="Could not load requests" copy={error} />}
        {!loading && !error && visibleRequests.map((request) => <RequestCard key={request.id} request={request} onCollected={onCollected} collecting={collecting} />)}
        {!loading && !error && !visibleRequests.length && (
          <div>
            <EmptyInline icon={Send} title={selectedMonth ? 'No requests for selected month' : 'No requests returned'} copy={selectedMonth ? 'Clear the month filter to see all food requests.' : 'Your food requests will appear after you request a donation.'} />
            {!selectedMonth && <button type="button" onClick={onBrowse} className="mx-auto mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600"><Utensils size={17} />Browse available food</button>}
          </div>
        )}
      </div>
    </section>
  )
}

function RequestCard({ request, onCollected, collecting }: { request: FoodRequest; onCollected: (id: string) => void; collecting: string }) {
  return (
    <article className="rounded-3xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[.04]">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h3 className="text-xl font-black">{request.foodName}</h3><span className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${requestStatusStyles[request.status]}`}>{request.status}</span></div>
          <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">Donor: <span className="font-black">{request.donorOrg}</span></p>
          <p className="mt-1 text-xs font-bold text-slate-400">{formatDate(getRequestDate(request))}</p>
        </div>
        {request.status === 'approved' && <button disabled={collecting === request.id} onClick={() => onCollected(request.id)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 size={17} />Mark Collected</button>}
      </div>
      <Timeline status={request.status} />
      {request.status === 'rejected' && <p className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800 ring-1 ring-red-200 dark:bg-red-400/10 dark:text-red-200 dark:ring-red-400/20"><XCircle size={16} /> Request was rejected by the donor.</p>}
    </article>
  )
}

function Timeline({ status }: { status: FoodRequest['status'] }) {
  const steps = ['Requested', 'Accepted', 'Volunteer', 'Picked', 'Delivered', 'Completed']
  const activeIndex = status === 'pending' ? 0 : status === 'approved' ? 1 : status === 'collected' ? 5 : 0
  return <div className="mt-5 grid grid-cols-3 gap-2 md:grid-cols-6">{steps.map((step, index) => <div key={step} className={`rounded-2xl px-3 py-2 text-center text-[11px] font-black ${index <= activeIndex ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10'}`}>{step}</div>)}</div>
}

function AnalyticsPanel({ analytics, error, expanded = false }: { analytics: ReturnType<typeof buildAnalytics>; error: string; expanded?: boolean }) {
  return (
    <section className={`rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[.05] md:p-6 ${expanded ? 'min-h-[70vh]' : ''}`}>
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Analytics</p><h2 className="mt-2 text-2xl font-black">Receiver impact</h2></div><BarChart3 className="text-emerald-500" size={24} /></div>
      {error && <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/20">{error}</p>}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.monthlyRequests}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" /><XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} /><Tooltip /><Line type="monotone" dataKey="requests" stroke="#16a34a" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer>
        </div>
        <div className="h-72">
          {analytics.foodCategories.length ? (
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analytics.foodCategories} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={4}>{analytics.foodCategories.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          ) : <EmptyInline icon={BarChart3} title="No category data" copy="Food categories appear after request records are available." />}
        </div>
      </div>
      <div className="mt-6 h-64">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.weeklyDeliveries}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" /><XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} /><YAxis tickLine={false} axisLine={false} fontSize={12} /><Tooltip /><Bar dataKey="deliveries" fill="#22c55e" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer>
      </div>
    </section>
  )
}

function MessagesPanel({ messages, error }: { messages: DashboardMessage[]; error: string }) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[.05] md:p-6">
      <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Messages</p><h2 className="mt-2 text-2xl font-black">Conversations</h2>
      <div className="mt-5 space-y-3">
        {messages.map((item) => <article key={item.id} className="rounded-3xl bg-slate-50 p-4 dark:bg-white/[.04]"><p className="text-sm font-black">{item.subject || item.senderName || item.from || 'Message'}</p><p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{item.message}</p><p className="mt-2 text-xs font-bold text-slate-400">{formatDate(item.createdAt)}</p></article>)}
        {!messages.length && <EmptyInline icon={MessageSquare} title={error || 'No messages returned'} copy="Donor, volunteer, admin, and organization messages will appear when the backend returns them." />}
      </div>
    </section>
  )
}

function NotificationsPage({ notifications, error }: { notifications: ReceiverNotification[]; error: string }) {
  return <NotificationList notifications={notifications} error={error} />
}

function NotificationPanel({ notifications, unreadCount, error, onClose, onViewAll }: { notifications: ReceiverNotification[]; unreadCount: number; error: string; onClose: () => void; onViewAll: () => void }) {
  return (
    <section className="donor-notification-panel fixed right-4 top-20 z-[80] w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-[0_20px_50px_rgba(15,23,42,.16)] dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.55)] md:right-8 md:top-24">
      <div className="relative overflow-hidden border-b border-slate-100 p-5 dark:border-white/10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-400/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
              <Bell size={19} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-black text-slate-950 dark:text-white">Notifications</p>
                {unreadCount > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">{unreadCount} new</span>}
              </div>
              <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-300">Food requests and delivery updates</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close notifications" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto p-4"><NotificationList notifications={notifications} error={error} compact /></div>
      <div className="border-t border-slate-100 p-4 dark:border-white/10"><button onClick={onViewAll} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-600 dark:bg-gradient-to-r dark:from-[#16A34A] dark:to-[#0F766E]">View all notifications</button></div>
    </section>
  )
}

function ProfileCard({ profile, initials, onClose, onLogout }: { profile: ProfileResponse; initials: string; onClose: () => void; onLogout: () => void }) {
  return (
    <section className="fixed right-4 top-20 z-[80] w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-[0_20px_50px_rgba(15,23,42,.16)] dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.55)] md:right-8 md:top-24">
      <div className="relative overflow-hidden border-b border-slate-100 p-5 dark:border-white/10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-400/10" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar profile={profile} initials={initials} size="md" />
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950 dark:text-white">{profile.organizationName || profile.name}</p>
              <p className="mt-0.5 truncate text-xs font-bold text-slate-500 dark:text-slate-300">{profile.email || 'Email not available'}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                <ShieldCheck size={13} />{profile.status || profile.verificationStatus || 'Active receiver'}
              </span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close receiver profile" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 p-4 dark:border-white/10">
        <button onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700">
          <LogOut size={16} />Log out
        </button>
      </div>
    </section>
  )
}

function NotificationList({ notifications, error, compact = false }: { notifications: ReceiverNotification[]; error: string; compact?: boolean }) {
  const toneClass: Record<ReceiverNotification['tone'], string> = {
    food: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-400/20',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/20',
    info: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/20',
  }
  return (
    <div className={compact ? 'space-y-2' : 'rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[.05] md:p-6'}>
      {!compact && <><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Notifications</p><h2 className="mt-2 text-2xl font-black">Real-time updates</h2></>}
      <div className={compact ? 'space-y-2' : 'mt-5 space-y-3'}>
        {notifications.map((notification) => <article key={notification.id} className={`rounded-2xl p-3 ring-1 ${toneClass[notification.tone]}`}><div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 dark:bg-white/10"><Bell size={15} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-black">{notification.title}</p>{notification.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />}</div><p className="mt-1 text-xs font-semibold leading-5 opacity-80">{notification.detail}</p><p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold opacity-70"><Clock3 size={12} />{formatDate(notification.createdAt)}</p></div></div></article>)}
        {!notifications.length && <EmptyInline icon={Bell} title={error || 'No notifications returned'} copy="New food, accepted requests, volunteer assignments, and delivery updates will appear here." />}
      </div>
    </div>
  )
}

function formatProfileField(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not available'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.length ? value.map(formatProfileField).join(', ') : 'Not available'
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const documentSummary = ['name', 'type', 'size', 'url', 'publicId']
      .filter((key) => record[key])
      .map((key) => `${key}: ${String(record[key])}`)
      .join(' | ')
    if (documentSummary) return documentSummary

    const safeRecord = Object.fromEntries(
      Object.entries(record).map(([key, entry]) => [key, key.toLowerCase().includes('data') ? 'Uploaded file data' : entry]),
    )
    return JSON.stringify(safeRecord)
  }
  return String(value)
}

function formatProfileLabel(label: string) {
  return label
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatFileSize(size?: number) {
  if (!size) return 'Size not available'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function ProfilePanel({ profile, onLogout }: { profile: ProfileResponse; onLogout: () => void }) {
  const documents = Object.entries(profile.documents ?? {})
    .filter((entry): entry is [string, StoredDocument] => Boolean(entry[1]))
  const detailEntries = Object.entries(profile.details ?? {})
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .sort(([first], [second]) => first.localeCompare(second))
  const profileEntries = Object.entries(profile as Record<string, unknown>)
    .filter(([key, value]) => !['documents', 'details'].includes(key) && value !== undefined && value !== null && value !== '')
    .sort(([first], [second]) => first.localeCompare(second))

  return (
    <section>
      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,.08)] dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)] md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Profile</p>
            <h3 className="mt-2 text-2xl font-black">Receiver registration details</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">Showing account, registration, and verification data saved for this receiver.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">{profileEntries.length + detailEntries.length} fields</span>
            <button onClick={onLogout} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-red-700">
              <LogOut size={15} />Log out
            </button>
          </div>
        </div>

        <h4 className="mt-6 text-lg font-black">Account information</h4>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {profileEntries.map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-100 bg-[#F9FAFB] p-4 dark:border-white/[.08] dark:bg-[#1F2937]">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">{formatProfileLabel(label)}</p>
              <p className="mt-2 break-words text-sm font-black text-slate-700 dark:text-slate-200">{formatProfileField(value)}</p>
            </div>
          ))}
          {!profileEntries.length && <div className="md:col-span-2"><EmptyInline icon={UserCircle} title="No profile details returned" copy="Profile fields will appear here when the backend returns receiver data." /></div>}
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-white/10">
          <h4 className="text-lg font-black">Registration details</h4>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {detailEntries.map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-slate-100 bg-[#F9FAFB] p-4 dark:border-white/[.08] dark:bg-[#1F2937]">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">{formatProfileLabel(label)}</p>
                <p className="mt-2 break-words text-sm font-black text-slate-700 dark:text-slate-200">{formatProfileField(value)}</p>
              </div>
            ))}
            {!detailEntries.length && <div className="md:col-span-2"><EmptyInline icon={UserCircle} title="No registration details returned" copy="Extra receiver registration fields will appear here when the backend includes them." /></div>}
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Documents</p>
              <h4 className="mt-2 text-2xl font-black">Uploaded documents</h4>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">{documents.length} files</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {documents.map(([key, document]) => {
              const href = document.url || document.data
              return (
                <article key={key} className="rounded-3xl border border-slate-100 bg-[#F9FAFB] p-4 dark:border-white/[.08] dark:bg-[#1F2937]">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">{formatProfileLabel(key)}</p>
                  <h5 className="mt-2 break-words text-sm font-black text-slate-800 dark:text-slate-100">{document.name || 'Uploaded document'}</h5>
                  <div className="mt-3 space-y-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                    <p>{document.type || 'Type not available'}</p>
                    <p>{formatFileSize(document.size)}</p>
                    {document.publicId && <p className="break-words">Public ID: {document.publicId}</p>}
                  </div>
                  {href && <a href={href} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-600 dark:bg-gradient-to-r dark:from-[#16A34A] dark:to-[#0F766E]">View document</a>}
                </article>
              )
            })}
            {!documents.length && <div className="md:col-span-2"><EmptyInline icon={UserCircle} title="No documents returned" copy="Uploaded receiver documents will appear here when the backend profile includes them." /></div>}
          </div>
        </div>
      </section>
    </section>
  )
}

function FoodDetailsModal({ food, pending, onClose, onRequest }: { food: FoodDonation; pending: boolean; onClose: () => void; onRequest: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:border-white/[.08] dark:bg-[#111827]">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-white/10"><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600">Food details</p><h2 className="mt-1 text-2xl font-black">{food.foodName}</h2></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10"><X size={18} /></button></div>
        {getFoodImage(food) && <img src={getFoodImage(food)} alt="" className="h-72 w-full object-cover" />}
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Detail label="Description" value={food.description || 'No description'} />
          <Detail label="Quantity" value={`${food.quantity} ${food.unit}`} />
          <Detail label="Cooking Time" value="Not provided by backend" />
          <Detail label="Expiry Time" value={formatDate(food.expiryTime)} />
          <Detail label="Pickup Window" value={formatDate(food.pickupTime)} />
          <Detail label="Donor" value={food.organizationName || food.donorName} />
          <Detail label="Pickup Address" value={food.location} />
          <Detail label="Current Status" value={food.status} />
        </div>
        <div className="grid gap-3 border-t border-slate-100 p-5 dark:border-white/10 md:grid-cols-2">
          <button disabled={pending} onClick={onRequest} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:bg-slate-200 disabled:text-slate-500">{pending ? 'Request Pending' : 'Request Food'}</button>
          <button className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black dark:border-white/10">Contact Donor</button>
        </div>
      </section>
    </div>
  )
}

function RequestFoodModal({ state, setState, onClose, onSubmit, submitting }: { state: RequestModalState; setState: (state: RequestModalState) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submitting: boolean }) {
  const input = 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-emerald-400/10'
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="w-full max-w-xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/[.08] dark:bg-[#111827]">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600">Food request</p><h2 className="mt-2 text-2xl font-black">{state.donation.foodName}</h2></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10"><X size={18} /></button></div>
        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-black">Required quantity<input className={input} type="number" min="1" max={state.donation.quantity} value={state.quantity} onChange={(event) => setState({ ...state, quantity: Number(event.target.value) })} /></label>
          <label className="grid gap-2 text-sm font-black">Pickup time<input className={input} type="datetime-local" value={state.pickupTime} onChange={(event) => setState({ ...state, pickupTime: event.target.value })} /></label>
          <label className="grid gap-2 text-sm font-black">Message<textarea className={`${input} min-h-24`} value={state.message} onChange={(event) => setState({ ...state, message: event.target.value })} /></label>
          <label className="grid gap-2 text-sm font-black">Receiver notes<textarea className={`${input} min-h-20`} value={state.notes} onChange={(event) => setState({ ...state, notes: event.target.value })} /></label>
        </div>
        <button disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{submitting ? <LoaderIcon /> : <Send size={18} />}{submitting ? 'Sending...' : 'Submit Request'}</button>
      </form>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl bg-slate-50 p-4 dark:bg-white/[.04]"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-sm font-black">{value}</p></div>
}

function EmptyPanel({ icon: Icon, title, copy }: { icon: typeof Users; title: string; copy: string }) {
  return <section className="rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/[.05]"><Icon className="mx-auto text-slate-300" size={38} /><h2 className="mt-4 text-2xl font-black">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{copy}</p></section>
}

function EmptyInline({ icon: Icon, title, copy }: { icon: typeof Bell; title: string; copy: string }) {
  return <div className="mt-5 rounded-3xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10"><Icon className="mx-auto text-slate-300" size={30} /><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{copy}</p></div>
}

function buildAnalytics(requests: FoodRequest[], foods: FoodDonation[], backend: AnalyticsResponse | null) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index))
    return { key: `${date.getFullYear()}-${date.getMonth()}`, name: date.toLocaleString(undefined, { month: 'short' }), requests: 0 }
  })

  requests.forEach((request) => {
    const date = new Date(request.requestedAt)
    const item = months.find((month) => month.key === `${date.getFullYear()}-${date.getMonth()}`)
    if (item) item.requests += 1
  })

  const categoryMap = requests.reduce<Record<string, number>>((acc, request) => {
    acc[request.foodType] = (acc[request.foodType] || 0) + 1
    return acc
  }, {})

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weeklyMap = weekdayNames.map((name) => ({ name, deliveries: 0 }))
  requests.filter((request) => request.status === 'collected').forEach((request) => {
    const date = new Date(request.requestedAt)
    weeklyMap[date.getDay()].deliveries += 1
  })

  return {
    monthlyRequests: backend?.monthlyRequests?.length ? backend.monthlyRequests : months.map(({ key, ...item }) => item),
    weeklyDeliveries: backend?.weeklyDeliveries?.length ? backend.weeklyDeliveries : weeklyMap,
    foodCategories: backend?.foodCategories?.length ? backend.foodCategories : Object.entries(categoryMap).map(([name, value]) => ({ name, value })),
    mealsReceived: backend?.mealsReceived ?? requests.filter((request) => request.status === 'collected').length,
    successRate: backend?.successRate ?? (requests.length ? Math.round((requests.filter((request) => ['approved', 'collected'].includes(request.status)).length / requests.length) * 100) : 0),
    availableMeals: foods.reduce((sum, food) => sum + Number(food.quantity || 0), 0),
  }
}
