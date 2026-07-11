import { useCallback, useEffect, useMemo, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import {
  AlertCircle, ArrowUpRight, BarChart3, Bell, CalendarDays, Check, CheckCircle2, Clock3, FileCheck2, History, ImagePlus,
  LayoutDashboard, LocateFixed, Loader2, LogOut, MapPin, Menu, MessageSquare, Moon,
  Package, Search, Send, ShieldCheck, Trash2, TrendingUp,
  UploadCloud, UserCircle, Utensils, X, type LucideIcon,
} from 'lucide-react'
import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  analyzeDonationImage, createDonation, deleteDonation, getDonations, getFoodRequests, getProfile, updateFoodRequest, updateProfile,
  isAuthError,
  type AppNotification, type AuthUser, type FoodDonation, type FoodRequest, type ProfileResponse, type StoredDocument,
} from '../api'
import { getCurrentLocationAddress, type LocationDraft } from '../location'

interface DonorDashboardProps {
  user: AuthUser
  onLogout: () => void
  themeToggle?: ReactNode
}

type DashboardSection = 'overview' | 'donate' | 'donations' | 'history' | 'notifications' | 'messages' | 'profile'

type DonorNotification = {
  id: string
  title: string
  detail: string
  createdAt: string
  tone: 'request' | 'success' | 'info'
  unread: boolean
}

const statusStyles: Record<FoodDonation['status'], string> = {
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  requested: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20',
  assigned: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20',
  collected: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15',
}

const chartColors = ['#16a34a', '#22c55e', '#38bdf8', '#f59e0b', '#8b5cf6']

const vegFoodOptions = [
  'Plain Rice', 'Jeera Rice', 'Veg Biryani', 'Veg Pulao', 'Khichdi', 'Roti', 'Chapati', 'Naan', 'Poori',
  'Dal Tadka', 'Dal Fry', 'Rajma', 'Chole', 'Mixed Vegetable Curry', 'Aloo Gobi', 'Palak Paneer',
  'Paneer Butter Masala', 'Kadai Paneer', 'Idli', 'Dosa', 'Upma', 'Poha', 'Veg Sandwich', 'Veg Burger',
  'Veg Noodles', 'Veg Fried Rice', 'Samosa', 'Pakora', 'Gulab Jamun', 'Rasgulla', 'Halwa', 'Kheer',
]

const nonVegFoodOptions = [
  'Chicken Curry', 'Butter Chicken', 'Chicken Biryani', 'Chicken Fried Rice', 'Chicken Noodles',
  'Chicken Sandwich', 'Chicken Burger', 'Chicken Tikka', 'Chicken Roast', 'Egg Curry', 'Boiled Eggs',
  'Omelette', 'Fish Curry', 'Fish Fry', 'Prawn Curry', 'Mutton Curry', 'Mutton Biryani',
]

const foodNameOptions = [...vegFoodOptions, ...nonVegFoodOptions]

function dateTimeLocal(hoursAhead: number) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function startOfTodayLocal() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

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

function searchableText(values: unknown[]) {
  return values
    .filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLowerCase()
}

function getMonthKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getDateKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getDonationImage(donation: FoodDonation) {
  return donation.image?.url || donation.image?.data
}

function locationFromProfile(profile: Partial<ProfileResponse>): LocationDraft {
  return {
    address: profile.address || '',
    latitude: profile.latitude,
    longitude: profile.longitude,
  }
}

function calculateImpactScore(donations: FoodDonation[], requests: FoodRequest[]) {
  const completed = donations.filter((donation) => donation.status === 'collected').length
  const accepted = requests.filter((request) => ['approved', 'collected'].includes(request.status)).length
  const meals = donations.reduce((sum, donation) => sum + Number(donation.quantity || 0), 0)
  return Math.min(100, Math.round(completed * 12 + accepted * 8 + meals / 20))
}

export default function DonorDashboard({ user, onLogout, themeToggle }: DonorDashboardProps) {
  const [donations, setDonations] = useState<FoodDonation[]>([])
  const [requests, setRequests] = useState<FoodRequest[]>([])
  const [backendNotifications, setBackendNotifications] = useState<AppNotification[]>([])
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [updatingRequest, setUpdatingRequest] = useState('')
  const [deletingDonation, setDeletingDonation] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedDonation, setSelectedDonation] = useState<FoodDonation | null>(null)
  const [notificationError, setNotificationError] = useState('')
  const [qualityGate, setQualityGate] = useState<{
    open: boolean
    status: 'checking' | 'passed' | 'failed' | 'error'
    message: string
    qualityCheck?: Record<string, unknown> | null
    aiAnalysis?: Record<string, unknown> | null
  }>({ open: false, status: 'checking', message: '' })

  const currentProfile = profile ?? user
  const displayName = currentProfile.organizationName || currentProfile.name
  const initials = displayName.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setMessage(null)
      setNotificationError('')
    }

    const [donationResult, requestResult, profileResult] = await Promise.allSettled([
      getDonations({ donorId: user.id }),
      getFoodRequests({ donorId: user.id }),
      getProfile({ userId: user.id }),
    ])

    if ([donationResult, requestResult, profileResult].some((result) => result.status === 'rejected' && isAuthError(result.reason))) {
      onLogout()
      return
    }

    if (donationResult.status === 'fulfilled') {
      setDonations(donationResult.value.donations)
    } else if (!silent) {
      setMessage({ type: 'error', text: donationResult.reason instanceof Error ? donationResult.reason.message : 'Could not load donations.' })
    }

    if (requestResult.status === 'fulfilled') {
      setRequests(requestResult.value.requests)
    }

    setBackendNotifications([])
    if (profileResult.status === 'fulfilled') {
      setProfile(unwrapProfile(profileResult.value))
    } else {
      setProfile(null)
    }

    if (!silent) setLoading(false)
  }, [onLogout, user.id])

  const handleProfileUpdated = (updatedProfile: ProfileResponse) => {
    setProfile(updatedProfile)
    setMessage({ type: 'success', text: 'Account information updated successfully.' })
  }

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadDashboard(true)
    }, 10000)
    return () => window.clearInterval(intervalId)
  }, [loadDashboard])

  const imageToDocument = (file: File): Promise<StoredDocument> => new Promise((resolve, reject) => {
    if (file.size > 1024 * 1024) return reject(new Error('Food photo must be smaller than 1 MB'))
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: String(reader.result) })
    reader.onerror = () => reject(new Error('Could not read the food photo'))
    reader.readAsDataURL(file)
  })

  const handleDonation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setQualityGate({ open: true, status: 'checking', message: 'Checking food quality with AI before posting...' })
    try {
      const form = event.currentTarget
      const data = new FormData(form)
      const file = data.get('image')
      const image = file instanceof File && file.size ? await imageToDocument(file) : undefined
      const latitude = typeof user.latitude === 'number' ? user.latitude : undefined
      const longitude = typeof user.longitude === 'number' ? user.longitude : undefined
      const donationPayload = {
        donorId: user.id,
        foodName: String(data.get('foodName') ?? '').trim(),
        foodType: String(data.get('foodType')) as FoodDonation['foodType'],
        quantity: Number(data.get('quantity')),
        unit: String(data.get('unit')) as FoodDonation['unit'],
        packaging: String(data.get('packaging') || 'Covered'),
        refrigeratorUsed: String(data.get('refrigeratorUsed') || 'No'),
        location: String(data.get('location') ?? '').trim(),
        latitude: latitude !== undefined && Number.isFinite(latitude) ? latitude : undefined,
        longitude: longitude !== undefined && Number.isFinite(longitude) ? longitude : undefined,
        pickupTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        expiryTime: new Date(String(data.get('preparationTime'))).toISOString(),
        description: String(data.get('description') ?? '').trim(),
        image,
      }
      const analysisResponse = await analyzeDonationImage(donationPayload)
      if (!qualityCheckCanPost(analysisResponse.qualityCheck)) {
        const failMessage = String(analysisResponse.qualityCheck.message || 'Food did not pass visible AI quality checks. Donation was not posted.')
        setQualityGate({
          open: true,
          status: 'failed',
          message: failMessage,
          qualityCheck: analysisResponse.qualityCheck,
          aiAnalysis: analysisResponse.aiAnalysis,
        })
        setMessage({ type: 'error', text: 'It is danger. Donation was blocked.' })
        return
      }
      setQualityGate({
        open: true,
        status: 'passed',
        message: 'Quality check passed. Posting donation...',
        qualityCheck: analysisResponse.qualityCheck,
        aiAnalysis: analysisResponse.aiAnalysis,
      })
      await createDonation(donationPayload)
      form.reset()
      await loadDashboard()
      setQualityGate({
        open: true,
        status: 'passed',
        message: 'Donation Successful. Verified receivers can request it now.',
        qualityCheck: analysisResponse.qualityCheck,
        aiAnalysis: analysisResponse.aiAnalysis,
      })
      setMessage({ type: 'success', text: 'Donation Successful.' })
      setActiveSection('overview')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to publish this donation. Please check the details and try again.'
      setQualityGate({ open: true, status: 'error', message: errorMessage })
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequest = async (request: FoodRequest, action: 'approve' | 'reject') => {
    setUpdatingRequest(request.id)
    setMessage(null)
    try {
      await updateFoodRequest(request.id, { action, userId: user.id })
      await loadDashboard()
      setMessage({
        type: action === 'approve' ? 'success' : 'info',
        text: action === 'approve'
          ? `Request accepted. ${request.receiverOrg} is now assigned to collect ${request.foodName}.`
          : `${request.receiverOrg}'s request for ${request.foodName} was declined.`,
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to update this request. Please try again.' })
    } finally {
      setUpdatingRequest('')
    }
  }

  const handleDeleteDonation = async (donation: FoodDonation) => {
    if (!window.confirm(`Delete ${donation.foodName}? This cannot be undone.`)) return
    setDeletingDonation(donation.id)
    setMessage(null)
    try {
      await deleteDonation(donation.id, user.id)
      await loadDashboard()
      setMessage({ type: 'success', text: `${donation.foodName} was deleted successfully.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to delete this donation.' })
    } finally {
      setDeletingDonation('')
    }
  }

  const activeDonations = donations.filter((donation) => donation.status !== 'collected')
  const completedDonations = donations.filter((donation) => donation.status === 'collected')
  const pendingRequests = requests.filter((request) => request.status === 'pending')
  const totalMeals = donations.reduce((sum, donation) => sum + Number(donation.quantity || 0), 0)
  const receiversHelped = new Set(requests.filter((request) => ['approved', 'collected'].includes(request.status)).map((request) => request.receiverId)).size
  const impactScore = calculateImpactScore(donations, requests)
  const normalizedSearch = search.trim().toLowerCase()
  const filteredDonations = useMemo(() => {
    if (!normalizedSearch) return donations
    return donations.filter((donation) => searchableText([
      donation.foodName,
      donation.foodType,
      donation.status,
      donation.assignedReceiverName,
      donation.organizationName,
      donation.quantity,
      donation.unit,
      donation.location,
      donation.description,
      formatDate(donation.pickupTime),
      formatDate(donation.createdAt),
    ]).includes(normalizedSearch))
  }, [donations, normalizedSearch])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (value.trim() && !['donations', 'history'].includes(activeSection)) {
      setActiveSection('donations')
    }
  }

  const navItems = [
    ['overview', 'Dashboard', LayoutDashboard],
    ['donate', 'Donate Food', UploadCloud],
    ['donations', 'My Donations', Package],
    ['history', 'Donation History', History],
    ['notifications', 'Notifications', Bell],
    ['messages', 'Messages', MessageSquare],
    ['profile', 'Profile', UserCircle],
  ] as const

  const sectionMeta: Record<DashboardSection, { eyebrow: string; title: string; copy: string }> = {
    overview: { eyebrow: 'Donor dashboard', title: `Welcome back, ${currentProfile.name || displayName}`, copy: 'A calm command center for donations, receiver requests, and impact.' },
    donate: { eyebrow: 'Create listing', title: 'Publish surplus food', copy: 'Add food details, pickup timing, location, and a photo for receivers.' },
    donations: { eyebrow: 'Live tracking', title: 'Manage live donations', copy: 'Track available, requested, and assigned food from one place.' },
    history: { eyebrow: 'Donation records', title: 'Donation history', copy: 'Review previous activity by month and date.' },
    notifications: { eyebrow: 'Live requests', title: 'Notifications', copy: 'Receiver requests and backend updates appear instantly here.' },
    messages: { eyebrow: 'Messages', title: 'Conversation center', copy: 'Backend message threads will appear when available.' },
    profile: { eyebrow: 'Account', title: 'Donor profile', copy: 'Registration data, documents, and logout are available here.' },
  }

  const stats = useMemo(() => [
    ['Total Donations', donations.length, Package, 'bg-emerald-600'],
    ['Active Donations', activeDonations.length, Clock3, 'bg-blue-600'],
    ['Completed', completedDonations.length, CheckCircle2, 'bg-violet-600'],
    ['Meals Shared', totalMeals, Utensils, 'bg-amber-500'],
    ['Impact Score', impactScore, TrendingUp, 'bg-teal-500'],
  ] as const, [activeDonations.length, completedDonations.length, donations.length, impactScore, totalMeals])

  const notifications = useMemo<DonorNotification[]>(() => {
    const apiNotifications = backendNotifications.map((notification) => ({
      id: notification.id,
      title: notification.subject || notification.title || 'Donation update',
      detail: notification.message || notification.detail || 'New update from FoodBridge.',
      createdAt: notification.createdAt || new Date().toISOString(),
      tone: notification.type?.toLowerCase().includes('delivered') || notification.type?.toLowerCase().includes('accepted') ? 'success' : 'info',
      unread: notification.read === false,
    } satisfies DonorNotification))

    const requestNotifications = requests.map((request) => {
      const isPending = request.status === 'pending'
      const statusText = request.status.charAt(0).toUpperCase() + request.status.slice(1)
      return {
        id: `request-${request.id}`,
        title: isPending ? 'New receiver request' : `Request ${statusText}`,
        detail: isPending
          ? `${request.receiverOrg} wants to collect ${request.foodName}.`
          : `${request.receiverOrg}'s ${request.foodName} request is ${statusText}.`,
        createdAt: request.requestedAt,
        tone: isPending ? 'request' : request.status === 'collected' ? 'success' : 'info',
        unread: isPending,
      } satisfies DonorNotification
    })

    return [...apiNotifications, ...requestNotifications]
      .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
  }, [backendNotifications, requests])

  const unreadNotifications = notifications.filter((notification) => notification.unread).length
  const analytics = useMemo(() => buildAnalytics(donations), [donations])

  return (
    <div className="donor-workspace min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#F0FDF4_52%,#ECFDF5_100%)] text-[#111827] dark:bg-[linear-gradient(180deg,#020617_0%,#0B1220_52%,#111827_100%)] dark:text-[#F9FAFB]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[292px] shrink-0 flex-col border-r border-[#E5E7EB] p-4 dark:border-white/[.08] lg:flex">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <button type="button" onClick={() => setActiveSection('overview')} className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#0F766E] text-white shadow-lg shadow-emerald-500/20 dark:from-[#15803D] dark:to-[#0F766E] dark:shadow-emerald-950/40"><Utensils size={23} /></span>
              <span className="hidden min-w-0 text-left lg:block"><span className="block text-xl font-black tracking-tight">FoodBridge</span><span className="block text-[10px] font-black uppercase tracking-[.22em] text-slate-400">Donor console</span></span>
            </button>
          </div>

          <nav className="mt-7 space-y-1.5 overflow-y-auto pr-1">
            {navItems.map(([value, label, Icon]) => (
              <button type="button" key={value} onClick={() => setActiveSection(value)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition duration-200 ${activeSection === value ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 dark:bg-gradient-to-r dark:from-[#166534] dark:to-[#0F766E] dark:shadow-emerald-950/40' : 'text-slate-500 hover:-translate-y-0.5 hover:bg-emerald-50 hover:text-emerald-800 hover:ring-1 hover:ring-emerald-200 hover:shadow-lg hover:shadow-emerald-500/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:hover:ring-white/10 dark:hover:shadow-none'}`}>
                <Icon size={19} className="shrink-0" />
                <span className="hidden truncate lg:inline">{label}</span>
                {value === 'notifications' && unreadNotifications > 0 && <span className="ml-auto hidden rounded-full bg-red-600 px-2 py-0.5 text-[10px] text-white lg:inline">{unreadNotifications}</span>}
                {value === 'donations' && activeDonations.length > 0 && <span className="ml-auto hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 lg:inline">{activeDonations.length}</span>}
              </button>
            ))}
          </nav>
        </aside>

        <main className="w-0 min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white px-4 py-4 shadow-[0_10px_40px_rgba(15,23,42,.08)] backdrop-blur-[20px] dark:border-white/[.08] dark:bg-[#020617] dark:shadow-[0_20px_50px_rgba(0,0,0,.55)] lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start justify-between gap-3 sm:items-center">
                <div className="min-w-0 flex-1 pt-0.5 sm:pt-0">
                  <h1 className="break-words text-xl font-black leading-tight tracking-tight sm:text-2xl md:text-3xl">{sectionMeta.overview.title}</h1>
                  <p className="mt-1 hidden text-sm font-semibold text-slate-500 dark:text-slate-300 md:block">{sectionMeta.overview.copy}</p>
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-[auto_1fr_auto_auto] items-center gap-3 md:grid-cols-[1fr_auto_auto] xl:flex xl:flex-wrap xl:justify-end">
                <button
                  type="button"
                  aria-label="Show dashboard menu"
                  aria-expanded={mobileMenuOpen}
                  onClick={() => {
                    setMobileMenuOpen((open) => !open)
                    setNotificationsOpen(false)
                    setProfileOpen(false)
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-[#111827] dark:text-white lg:hidden"
                >
                  {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
                </button>
                <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-500 shadow-sm transition focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100 dark:border-white/10 dark:bg-[#111827] dark:text-slate-300 dark:focus-within:ring-emerald-400/10 xl:min-w-[220px] xl:flex-1 xl:max-w-[440px]">
                  <Search size={18} />
                  <input
                    value={search}
                    onChange={(event) => handleSearchChange(event.target.value)}
                    placeholder="Search donations, status, receiver"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none dark:text-white"
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
                      <X size={15} />
                    </button>
                  )}
                </label>
                <span className="justify-self-end">{themeToggle ?? <button className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white"><Moon size={18} /></button>}</span>
                <div className="relative shrink-0 md:hidden">
                  <button onClick={() => {
                    setProfileOpen((open) => !open)
                    setNotificationsOpen(false)
                    setMobileMenuOpen(false)
                  }} aria-label="Open donor profile" className="rounded-2xl outline-none ring-offset-2 ring-offset-[#f8fafc] transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-emerald-100 dark:ring-offset-[#020617] dark:focus-visible:ring-emerald-400/20">
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
                <div className="relative hidden md:block">
                  <button onClick={() => {
                    setNotificationsOpen((open) => !open)
                    setProfileOpen(false)
                  }} aria-label="Open notifications" className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-600 hover:shadow-lg hover:shadow-emerald-500/10 dark:bg-white/5 dark:hover:border-emerald-400/30 dark:hover:text-emerald-300 dark:hover:shadow-emerald-950/30 ${notificationsOpen ? 'border-emerald-300 text-emerald-600 shadow-lg shadow-emerald-500/10 dark:border-emerald-400/30 dark:text-emerald-300' : 'border-slate-200 text-slate-700 dark:border-white/10 dark:text-white'}`}>
                    <Bell size={18} className="transition duration-200 group-hover:rotate-6" />
                    {unreadNotifications > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">{unreadNotifications}</span>}
                  </button>
                  {notificationsOpen && (
                    <NotificationPanel
                      notifications={notifications}
                      unreadCount={unreadNotifications}
                      error={notificationError}
                      onClose={() => setNotificationsOpen(false)}
                      onViewRequests={() => {
                        setActiveSection('notifications')
                        setNotificationsOpen(false)
                      }}
                    />
                  )}
                </div>
                <div className="relative hidden shrink-0 md:block">
                  <button onClick={() => {
                    setProfileOpen((open) => !open)
                    setNotificationsOpen(false)
                  }} aria-label="Open donor profile" className="rounded-2xl outline-none ring-offset-2 ring-offset-[#f8fafc] transition hover:scale-[1.03] focus-visible:ring-4 focus-visible:ring-emerald-100 dark:ring-offset-[#020617] dark:focus-visible:ring-emerald-400/20">
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
                <WelcomeBanner profile={currentProfile} onDonate={() => setActiveSection('donate')} onTrack={() => setActiveSection('donations')} onHistory={() => setActiveSection('history')} />
                <QuickActionRail pendingRequests={pendingRequests.length} activeDonations={activeDonations.length} onDonate={() => setActiveSection('donate')} onRequests={() => setActiveSection('notifications')} onHistory={() => setActiveSection('history')} />
                <section className="donor-stats-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {stats.map(([label, value, Icon, tone], index) => <StatCard key={label} label={label} value={value} icon={Icon} tone={tone} delay={index * 45} />)}
                </section>
                <AnalyticsPanel monthly={analytics.monthly} categories={analytics.categories} />
                <section className="grid gap-5 xl:grid-cols-[1fr_.95fr]">
                  <RequestList requests={pendingRequests.slice(0, 4)} updating={updatingRequest} onAction={handleRequest} compact onViewAll={() => setActiveSection('notifications')} />
                  <Timeline donations={donations.slice(0, 6)} requests={requests.slice(0, 6)} />
                </section>
                <DonationHistory donations={filteredDonations.slice(0, 6)} loading={loading} deleting={deletingDonation} onDelete={handleDeleteDonation} onView={setSelectedDonation} />
              </div>
            )}

            {activeSection === 'donate' && <DonationForm user={currentProfile} submitting={submitting} onSubmit={handleDonation} />}
            {activeSection === 'donations' && <DonationHistory donations={filteredDonations.filter((donation) => donation.status !== 'collected')} loading={loading} deleting={deletingDonation} onDelete={handleDeleteDonation} onView={setSelectedDonation} title="My active donations" />}
            {activeSection === 'history' && <DonationHistory donations={filteredDonations} loading={loading} deleting={deletingDonation} onDelete={handleDeleteDonation} onView={setSelectedDonation} title="Donation history" filterable />}
            {activeSection === 'notifications' && <NotificationsPage notifications={notifications} error={notificationError} requests={requests} updating={updatingRequest} onAction={handleRequest} />}
            {activeSection === 'messages' && <EmptyPanel icon={MessageSquare} title="No backend messages yet" copy="Messages will appear here when your Spring Boot messages API returns conversation data." />}
            {activeSection === 'profile' && <ProfileDetailsPage profile={currentProfile} onUpdated={handleProfileUpdated} onLogout={onLogout} />}
          </div>
        </main>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close dashboard menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 flex h-full w-[min(86vw,320px)] flex-col border-r border-[#E5E7EB] bg-white p-4 text-[#111827] shadow-[0_20px_50px_rgba(15,23,42,.22)] dark:border-white/[.08] dark:bg-[#111827] dark:text-[#F9FAFB] dark:shadow-[0_20px_50px_rgba(0,0,0,.55)]">
            <div className="flex items-center justify-between gap-3 px-2 py-2">
              <button type="button" onClick={() => { setActiveSection('overview'); setMobileMenuOpen(false) }} className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#0F766E] text-white shadow-lg shadow-emerald-500/20 dark:from-[#15803D] dark:to-[#0F766E] dark:shadow-emerald-950/40"><Utensils size={23} /></span>
                <span className="min-w-0 text-left"><span className="block text-xl font-black tracking-tight">FoodBridge</span><span className="block text-[10px] font-black uppercase tracking-[.22em] text-slate-400">Donor console</span></span>
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
                  {value === 'donations' && activeDonations.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-200">{activeDonations.length}</span>}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {selectedDonation && <DonationDetailsModal donation={selectedDonation} request={requests.find((request) => request.foodId === selectedDonation.id)} onClose={() => setSelectedDonation(null)} />}
      {qualityGate.open && (
        <QualityGateModal
          status={qualityGate.status}
          message={qualityGate.message}
          qualityCheck={qualityGate.qualityCheck}
          aiAnalysis={qualityGate.aiAnalysis}
          onClose={() => setQualityGate((current) => ({ ...current, open: false }))}
        />
      )}
    </div>
  )
}

function StatusMessage({ message, onClose }: { message: { type: 'success' | 'error' | 'info'; text: string }; onClose: () => void }) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, 1000)
    return () => window.clearTimeout(timeoutId)
  }, [message.text, message.type, onClose])

  return (
    <div role={message.type === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mb-5 flex items-start justify-between gap-4 rounded-3xl border px-5 py-4 text-sm font-bold ${message.type === 'error' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200' : message.type === 'info' ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>
      <span className="flex items-start gap-3">{message.type === 'error' ? <AlertCircle className="mt-0.5 shrink-0" size={18} /> : <CheckCircle2 className="mt-0.5 shrink-0" size={18} />}{message.text}</span>
      <button onClick={onClose} aria-label="Dismiss message" className="shrink-0 opacity-60 transition hover:opacity-100"><X size={17} /></button>
    </div>
  )
}

function Avatar({ profile, initials, size }: { profile: Partial<ProfileResponse>; initials: string; size: 'sm' | 'md' | 'lg' }) {
  const classes = size === 'lg' ? 'h-20 w-20 text-2xl rounded-3xl' : size === 'md' ? 'h-12 w-12 text-base rounded-2xl' : 'h-12 w-12 text-sm rounded-2xl'
  return profile.profileImageUrl ? <img src={profile.profileImageUrl} alt="" className={`${classes} object-cover ring-1 ring-slate-200 dark:ring-white/10`} /> : <span className={`${classes} flex shrink-0 items-center justify-center bg-emerald-500 font-black text-white shadow-lg shadow-emerald-500/20`}>{initials}</span>
}

function WelcomeBanner({ profile, onDonate, onTrack, onHistory }: { profile: ProfileResponse; onDonate: () => void; onTrack: () => void; onHistory: () => void }) {
  return (
    <section className="donor-hero-card overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.45)]">
      <div className="p-6 md:p-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[.18em] text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">Verified donor</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-300"><ShieldCheck size={13} />{profile.status || profile.verificationStatus || 'Active'}</span>
          </div>
          <h2 className="mt-5 max-w-3xl text-3xl font-black tracking-[-.04em] md:text-5xl">Turn extra food into verified impact.</h2>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-500 dark:text-slate-300">Publish surplus food, respond to receiver requests, and track every pickup from one clean workspace.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button onClick={onDonate} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 dark:bg-gradient-to-r dark:from-[#16A34A] dark:to-[#0F766E] dark:shadow-emerald-950/40"><UploadCloud size={18} />Donate Food</button>
            <button onClick={onTrack} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white"><MapPin size={18} />Track Donation</button>
            <button onClick={onHistory} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white"><History size={18} />View History</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function QuickActionRail({ pendingRequests, activeDonations, onDonate, onRequests, onHistory }: { pendingRequests: number; activeDonations: number; onDonate: () => void; onRequests: () => void; onHistory: () => void }) {
  const actions = [
    { label: 'Create donation', value: 'New listing', icon: UploadCloud, onClick: onDonate, tone: 'emerald' },
    { label: 'Receiver requests', value: `${pendingRequests} pending`, icon: Bell, onClick: onRequests, tone: 'blue' },
    { label: 'Active pickups', value: `${activeDonations} live`, icon: MapPin, onClick: onRequests, tone: 'amber' },
    { label: 'Monthly history', value: 'Filter records', icon: CalendarDays, onClick: onHistory, tone: 'slate' },
  ] as const

  return (
    <section className="grid gap-3 rounded-[28px] border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-white/5 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map(({ label, value, icon: Icon, onClick, tone }) => (
        <button key={label} onClick={onClick} className={`donor-action-tile donor-action-${tone} group flex min-h-[86px] items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition dark:border-white/[.08] dark:bg-[#111827]`}>
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm dark:bg-white/10 dark:text-emerald-200"><Icon size={19} /></span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-950 dark:text-white">{label}</span>
              <span className="mt-0.5 block truncate text-xs font-bold text-slate-500 dark:text-slate-300">{value}</span>
            </span>
          </span>
          <ArrowUpRight size={17} className="shrink-0 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-600" />
        </button>
      ))}
    </section>
  )
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: string; delay: number }) {
  return (
    <article className="donor-stat-card flex h-full flex-col justify-between rounded-3xl border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)]">
       <div className="flex items-start justify-between">
       <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${tone}`}><Icon size={22} /></span>
       <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">Live</span>
       </div>
       <p className="mt-5 text-sm font-bold text-slate-500 dark:text-slate-300">{label}</p>
       <p className="mt-1 text-3xl font-black tracking-tight">{value.toLocaleString()}</p>
    </article>
  )
}

function DonationForm({ user, submitting, onSubmit }: { user: ProfileResponse; submitting: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [location, setLocation] = useState<LocationDraft>(() => locationFromProfile(user))
  const [locating, setLocating] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')
  const [selectedFoodImage, setSelectedFoodImage] = useState('')
  const [foodName, setFoodName] = useState('')
  const [foodPickerOpen, setFoodPickerOpen] = useState(false)
  const input = 'rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-emerald-400/10'
  const matchingFoodOptions = foodNameOptions.filter((option) => option.toLowerCase().includes(foodName.trim().toLowerCase()))

  useEffect(() => {
    setLocation((current) => {
      const saved = locationFromProfile(user)
      return {
        address: current.address || saved.address,
        latitude: current.latitude,
        longitude: current.longitude,
      }
    })
  }, [user])

  const handleLocate = async () => {
    setLocationStatus('')
    setLocating(true)
    try {
      const currentLocation = await getCurrentLocationAddress()
      setLocation(currentLocation)
      setLocationStatus('Current location added for pickup.')
    } catch (error) {
      setLocationStatus(typeof error === 'object' && error !== null && 'code' in error && error.code === 1
        ? 'Location permission was denied. Please allow location access or enter the pickup address manually.'
        : error instanceof Error ? error.message : 'Could not detect your current location.')
    } finally {
      setLocating(false)
    }
  }

  return (
    <section>
      <form onSubmit={onSubmit} className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)] md:p-8">
        <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Quick donate</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">Publish surplus food</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-300">Food details, pickup window, address, and image are submitted to your backend.</p>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <FoodNamePicker value={foodName} options={matchingFoodOptions} open={foodPickerOpen} inputClass={input} onOpen={() => setFoodPickerOpen(true)} onClose={() => setFoodPickerOpen(false)} onChange={setFoodName} />
          <label className="grid gap-2 text-sm font-black">Category<select name="foodType" className={input}><option>Veg</option><option>Non-Veg</option><option>Both</option></select></label>
          <label className="grid gap-2 text-sm font-black">Packaging<select name="packaging" className={input}><option>Sealed</option><option>Covered</option><option>Open</option></select></label>
          <div className="grid gap-3 sm:grid-cols-[1fr_130px]"><Field label="Quantity" name="quantity" type="number" min="1" placeholder="50" className={input} /><label className="grid gap-2 text-sm font-black">Unit<select name="unit" className={input}>{['Meals', 'Plates', 'Boxes', 'Packs', 'Kg'].map((unit) => <option key={unit}>{unit}</option>)}</select></label></div>
          <label className="grid gap-2 text-sm font-black">Refrigerator Used<select name="refrigeratorUsed" className={input}><option value="No">No</option><option value="Yes">Yes</option></select></label>
          <Field label="Preparation time" name="preparationTime" type="datetime-local" min={startOfTodayLocal()} defaultValue={dateTimeLocal(0)} className={input} />
          <label className="grid gap-2 text-sm font-black md:col-span-2">
            Address
            <span className="flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100 dark:border-white/10 dark:bg-white/5 dark:focus-within:ring-emerald-400/10">
              <input required name="location" value={location.address} onChange={(event) => setLocation({ address: event.target.value })} placeholder="Pickup address" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-semibold outline-none" />
              <button type="button" onClick={handleLocate} disabled={locating} aria-label="Use current location" className="flex w-12 shrink-0 items-center justify-center text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-400/10">
                {locating ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
              </button>
            </span>
            <input type="hidden" name="latitude" value={user.latitude ?? ''} />
            <input type="hidden" name="longitude" value={user.longitude ?? ''} />
            {locationStatus && <span className="text-xs font-bold text-slate-500 dark:text-slate-300">{locationStatus}</span>}
          </label>
          <label className="grid gap-2 text-sm font-black md:col-span-2">Description<textarea required name="description" maxLength={500} placeholder="Packaging, ingredients, collection instructions" className={`${input} min-h-28 resize-y`} /></label>
          <label className="flex cursor-pointer flex-col gap-4 rounded-3xl border-2 border-dashed border-slate-200 p-5 transition hover:border-emerald-400 dark:border-white/15 sm:flex-row sm:items-center md:col-span-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10"><ImagePlus size={22} /></span>
            <div><p className="font-black">Upload food image</p><p className="text-xs font-semibold text-slate-500">{selectedFoodImage || 'JPG, PNG, or WebP up to 1 MB'}</p></div>
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setSelectedFoodImage(event.target.files?.[0]?.name || '')} className="sr-only" />
          </label>
        </div>
        <button disabled={submitting} className="mt-7 inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:opacity-60 dark:bg-gradient-to-r dark:from-[#16A34A] dark:to-[#0F766E] dark:shadow-emerald-950/40 dark:hover:from-[#22C55E] dark:hover:to-[#14B8A6]">{submitting ? <Loader2 size={19} className="animate-spin" /> : <UploadCloud size={19} />}{submitting ? 'Publishing...' : 'Submit Donation'}</button>
      </form>
    </section>
  )
}

function Field({ label, className, ...props }: { label: string; className: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="grid gap-2 text-sm font-black">{label}<input required className={className} {...props} /></label>
}

function FoodNamePicker({ value, options, open, inputClass, onOpen, onClose, onChange }: { value: string; options: string[]; open: boolean; inputClass: string; onOpen: () => void; onClose: () => void; onChange: (value: string) => void }) {
  return (
    <label className="relative grid gap-2 text-sm font-black">
      Food name
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
        <input
          required
          name="foodName"
          value={value}
          onFocus={onOpen}
          onChange={(event) => {
            onChange(event.target.value)
            onOpen()
          }}
          onBlur={() => window.setTimeout(onClose, 140)}
          placeholder="Search or type food name"
          autoComplete="off"
          className={`${inputClass} w-full pl-11`}
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/12 dark:border-white/10 dark:bg-[#111827]">
          {(options.length ? options : foodNameOptions).map((option) => (
            <button
              type="button"
              key={option}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option)
                onClose()
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-100"
            >
              <span>{option}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${nonVegFoodOptions.includes(option) ? 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>
                {nonVegFoodOptions.includes(option) ? 'Non-Veg' : 'Veg'}
              </span>
            </button>
          ))}
          {value.trim() && !foodNameOptions.some((option) => option.toLowerCase() === value.trim().toLowerCase()) && (
            <div className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 dark:bg-white/5 dark:text-slate-300">Use manual food name: {value.trim()}</div>
          )}
        </div>
      )}
    </label>
  )
}

function QualityGateModal({ status, message, qualityCheck, aiAnalysis, onClose }: { status: 'checking' | 'passed' | 'failed' | 'error'; message: string; qualityCheck?: Record<string, unknown> | null; aiAnalysis?: Record<string, unknown> | null; onClose: () => void }) {
  const requirements = qualityRequirements(qualityCheck)
  const canPost = qualityCheckCanPost(qualityCheck)
  const safetyScore = qualityCheck?.safetyScore === undefined ? Number(qualityCheck?.passPercentage || 0) : Number(qualityCheck.safetyScore)
  const resultLabel = String(qualityCheck?.resultLabel || (canPost ? 'Safe to Donate' : 'Not Recommended'))
  const title = status === 'checking' ? 'Checking Food Quality' : status === 'passed' ? 'Donation Successful' : resultLabel
  const tone = status === 'passed' ? 'emerald' : status === 'checking' ? 'blue' : 'red'

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:border-white/[.08] dark:bg-[#111827]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 dark:border-white/10">
          <div>
            <p className={`text-xs font-black uppercase tracking-[.22em] ${tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-300' : tone === 'blue' ? 'text-blue-600 dark:text-blue-300' : 'text-red-600 dark:text-red-300'}`}>AI Quality Check</p>
            <h2 className="mt-1 text-2xl font-black">{title}</h2>
            <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-300">{message}</p>
          </div>
          {status !== 'checking' && <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10"><X size={18} /></button>}
        </div>

        <div className="p-5">
          <div className={`rounded-3xl p-5 ring-1 ${canPost ? 'bg-emerald-50 ring-emerald-100 dark:bg-emerald-400/10 dark:ring-emerald-400/20' : status === 'checking' ? 'bg-blue-50 ring-blue-100 dark:bg-blue-400/10 dark:ring-blue-400/20' : 'bg-red-50 ring-red-100 dark:bg-red-400/10 dark:ring-red-400/20'}`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${canPost ? 'bg-emerald-500' : status === 'checking' ? 'bg-blue-500' : 'bg-red-500'}`}>
                  {status === 'checking' ? <Loader2 className="animate-spin" size={22} /> : canPost ? <Check size={22} /> : <AlertCircle size={22} />}
                </span>
                <div>
                  <p className={`text-sm font-black ${canPost ? 'text-emerald-700 dark:text-emerald-100' : status === 'checking' ? 'text-blue-700 dark:text-blue-100' : 'text-red-700 dark:text-red-100'}`}>{status === 'checking' ? 'Analyzing visible quality...' : resultLabel}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">AI checks visible appearance only. It does not prove food safety.</p>
                </div>
              </div>
              <span className={`rounded-full px-4 py-2 text-sm font-black ${canPost ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100' : status === 'checking' ? 'bg-blue-100 text-blue-800 dark:bg-blue-400/20 dark:text-blue-100' : 'bg-red-100 text-red-800 dark:bg-red-400/20 dark:text-red-100'}`}>{status === 'checking' ? 'Checking...' : `Safety Score: ${Number.isFinite(safetyScore) ? safetyScore : 0}`}</span>
            </div>
          </div>

          {requirements.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
            {requirements.map((item) => (
              <div key={item.name} className="rounded-2xl bg-white/80 p-3 ring-1 ring-slate-100 dark:bg-white/10 dark:ring-white/10">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-slate-700 dark:text-slate-100">{item.name}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.passed ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-100' : 'bg-red-50 text-red-700 dark:bg-red-400/15 dark:text-red-100'}`}>{item.percent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div className={`h-full rounded-full ${item.passed ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${item.percent}%` }} />
                </div>
                <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-300">{item.reason}</p>
              </div>
            ))}
            </div>
          )}

          {aiAnalysis && (
            <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[.04]">
              <p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">AI Analysis Fields</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {aiAnalysisEntries(aiAnalysis).slice(0, 6).map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white p-3 dark:bg-white/10">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="mt-1 break-words text-sm font-bold text-slate-700 dark:text-slate-100">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {status !== 'checking' && (
            <div className="mt-5 flex justify-end">
              <button onClick={onClose} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-600 dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-200">Close</button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function AnalyticsPanel({ monthly, categories }: { monthly: Array<{ name: string; donations: number; meals: number }>; categories: Array<{ name: string; value: number }> }) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)] md:p-6">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Analytics</p><h2 className="mt-2 text-2xl font-black">Donation performance</h2></div><BarChart3 className="text-emerald-500" size={24} /></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_.8fr]">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="donations" stroke="#16a34a" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="meals" stroke="#38bdf8" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-72">
          {categories.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categories} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={4}>
                  {categories.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyInline icon={BarChart3} title="No category data" copy="Food category analytics will appear after donations are created." />
          )}
        </div>
      </div>
    </section>
  )
}

function Timeline({ donations, requests }: { donations: FoodDonation[]; requests: FoodRequest[] }) {
  const items = [
    ...donations.map((donation) => ({ id: `d-${donation.id}`, title: donation.foodName, detail: `Donation is ${donation.status}`, time: donation.createdAt, tone: donation.status })),
    ...requests.map((request) => ({ id: `r-${request.id}`, title: request.receiverOrg, detail: `${request.status} request for ${request.foodName}`, time: request.requestedAt, tone: request.status })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 7)

  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)] md:p-6">
      <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Timeline</p><h2 className="mt-2 text-2xl font-black">Recent movement</h2>
      <div className="mt-6 space-y-4">
        {items.map((item) => <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-400/10" /><div><p className="text-sm font-black">{item.title}</p><p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">{item.detail} • {formatDate(item.time)}</p></div></div>)}
        {!items.length && <EmptyInline icon={Clock3} title="No timeline activity" copy="Donation and request events will appear after backend records are created." />}
      </div>
    </section>
  )
}

function DonationHistory({ donations, loading, deleting, onDelete, onView, title = 'Recent donations', filterable = false }: { donations: FoodDonation[]; loading: boolean; deleting: string; onDelete: (donation: FoodDonation) => void; onView: (donation: FoodDonation) => void; title?: string; filterable?: boolean }) {
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [selectedDate, setSelectedDate] = useState('')

  const monthOptions = useMemo(() => {
    const monthMap = new Map<string, string>()
    donations.forEach((donation) => {
      const key = getMonthKey(donation.createdAt)
      if (!key || monthMap.has(key)) return
      monthMap.set(key, new Date(donation.createdAt).toLocaleString(undefined, { month: 'long', year: 'numeric' }))
    })
    return Array.from(monthMap.entries()).map(([value, label]) => ({ value, label }))
  }, [donations])

  const visibleDonations = useMemo(() => {
    if (!filterable) return donations
    return donations.filter((donation) => {
      const matchesMonth = selectedMonth === 'all' || getMonthKey(donation.createdAt) === selectedMonth
      const matchesDate = !selectedDate || getDateKey(donation.createdAt) === selectedDate
      return matchesMonth && matchesDate
    })
  }, [donations, filterable, selectedDate, selectedMonth])

  const hasFilters = selectedMonth !== 'all' || Boolean(selectedDate)

  return <section className="donation-history-panel rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)] md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Donations</p><h2 className="mt-2 text-2xl font-black">{title}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">{visibleDonations.length} records</span></div>
    {filterable && (
      <div className="mt-5 rounded-3xl border border-slate-100 bg-slate-50 p-4 dark:border-white/[.08] dark:bg-[#111827]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-600 dark:text-emerald-300">History filter</p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">{visibleDonations.length} of {donations.length} donations shown</p>
          </div>
          {hasFilters && <button onClick={() => { setSelectedMonth('all'); setSelectedDate('') }} className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15">Clear</button>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-black">
            Month
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-emerald-400/10">
              <option value="all">All months</option>
              {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black">
            Date
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-emerald-400/10" />
          </label>
        </div>
      </div>
    )}
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[920px] text-left"><thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 dark:border-white/10"><th className="pb-3">Food</th><th className="pb-3">NGO</th><th className="pb-3">Quantity</th><th className="pb-3">Pickup</th><th className="pb-3">Created</th><th className="pb-3">Status</th><th className="pb-3 text-right">Actions</th></tr></thead><tbody>
      {!loading && visibleDonations.map((donation) => <tr key={donation.id} className="border-b border-slate-100 last:border-0 dark:border-white/10"><td className="py-4"><div className="flex items-center gap-3">{getDonationImage(donation) ? <img src={getDonationImage(donation)} alt="" className="h-12 w-12 rounded-2xl object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-400/10"><Utensils size={19} /></span>}<div><p className="font-black">{donation.foodName}</p><p className="text-xs font-bold text-slate-500">{donation.foodType}</p></div></div></td><td className="py-4 text-sm font-bold text-slate-600 dark:text-slate-300">{donation.assignedReceiverName || 'Not assigned'}</td><td className="py-4 text-sm font-bold text-slate-600 dark:text-slate-300">{donation.quantity} {donation.unit}</td><td className="py-4 text-sm font-bold text-slate-600 dark:text-slate-300">{formatDate(donation.pickupTime)}</td><td className="py-4 text-sm font-bold text-slate-600 dark:text-slate-300">{formatDate(donation.createdAt)}</td><td className="py-4"><span className={`rounded-full px-3 py-1 text-xs font-black capitalize ring-1 ${statusStyles[donation.status]}`}>{donation.status}</span></td><td className="py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => onView(donation)} className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200">View</button><button onClick={() => onView(donation)} className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200">Track</button>{!['assigned', 'collected'].includes(donation.status) && <button disabled={deleting === donation.id} onClick={() => onDelete(donation)} aria-label={`Delete ${donation.foodName}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-400/10"><Trash2 size={17} /></button>}</div></td></tr>)}
    </tbody></table>{loading && <p className="py-12 text-center text-slate-500">Loading donations...</p>}{!loading && !visibleDonations.length && <p className="py-12 text-center text-slate-500">{hasFilters ? 'No donations for selected date.' : 'No donations returned by the backend.'}</p>}</div>
  </section>
}

function RequestList({ requests, updating, onAction, compact = false, onViewAll }: { requests: FoodRequest[]; updating: string; onAction: (request: FoodRequest, action: 'approve' | 'reject') => void; compact?: boolean; onViewAll?: () => void }) {
  return <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)] md:p-6">
    <div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[.22em] text-blue-600 dark:text-blue-300">Receiver requests</p><h2 className="mt-2 text-2xl font-black">{compact ? 'Needs your response' : 'Manage food requests'}</h2></div>{compact && <button onClick={onViewAll} className="text-sm font-black text-emerald-600">View all</button>}</div>
    <div className="mt-5 space-y-3">{requests.map((request) => <article key={request.id} className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-[0_10px_40px_rgba(15,23,42,.08)] dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.45)]"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{request.receiverOrg}</h3><p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">Requests {request.foodName} • {request.receiverType}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${request.status === 'pending' ? 'bg-blue-100 text-blue-700' : request.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-100' : 'bg-slate-200 text-slate-600'}`}>{request.status}</span></div>{request.message && <p className="mt-3 rounded-2xl bg-[#F9FAFB] p-3 text-sm font-semibold text-slate-600 dark:bg-[#1F2937] dark:text-slate-300">{request.message}</p>}{request.status === 'pending' && <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={updating === request.id} onClick={() => onAction(request, 'reject')} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-black text-slate-600 dark:border-white/10 dark:bg-[#1F2937] dark:text-slate-300"><X size={16} />Decline</button><button disabled={updating === request.id} onClick={() => onAction(request, 'approve')} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-3 py-2.5 text-sm font-black text-white dark:bg-gradient-to-r dark:from-[#16A34A] dark:to-[#0F766E] dark:shadow-lg dark:shadow-emerald-950/40"><Check size={16} />Accept</button></div>}<p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-400"><Clock3 size={13} />{formatDate(request.requestedAt)}</p></article>)}{!requests.length && <EmptyInline icon={Send} title="No receiver requests" copy="Requests will appear here as receivers contact you." />}</div>
  </section>
}

function NotificationsPage({ notifications, error, requests, updating, onAction }: { notifications: DonorNotification[]; error: string; requests: FoodRequest[]; updating: string; onAction: (request: FoodRequest, action: 'approve' | 'reject') => void }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
      <NotificationList notifications={notifications} error={error} />
      <RequestList requests={requests} updating={updating} onAction={onAction} />
    </section>
  )
}

function NotificationPanel({ notifications, unreadCount, error, onClose, onViewRequests }: { notifications: DonorNotification[]; unreadCount: number; error: string; onClose: () => void; onViewRequests: () => void }) {
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
              <p className="mt-0.5 text-xs font-bold text-slate-500 dark:text-slate-300">Receiver requests and live updates</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close notifications" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto p-4"><NotificationList notifications={notifications} error={error} compact /></div>
      <div className="border-t border-slate-100 p-4 dark:border-white/10"><button onClick={onViewRequests} className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-600 dark:bg-gradient-to-r dark:from-[#16A34A] dark:to-[#0F766E]">View receiver requests</button></div>
    </section>
  )
}

function NotificationList({ notifications, error, compact = false }: { notifications: DonorNotification[]; error: string; compact?: boolean }) {
  const toneClass: Record<DonorNotification['tone'], string> = {
    request: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-400/20',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-400/20',
    info: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/20',
  }

  return (
    <div className={compact ? 'space-y-2' : 'rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)] md:p-6'}>
      {!compact && <><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Notifications</p><h2 className="mt-2 text-2xl font-black">Live updates</h2></>}
      <div className={compact ? 'space-y-2' : 'mt-5 space-y-3'}>
        {notifications.map((notification) => (
          <article key={notification.id} className={`donor-notification-item donor-notification-${notification.tone} rounded-2xl p-3 ring-1 ${toneClass[notification.tone]}`}>
            <div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 dark:bg-white/10"><Bell size={15} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-black">{notification.title}</p>{notification.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />}</div><p className="mt-1 text-xs font-semibold leading-5 opacity-80">{notification.detail}</p><p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold opacity-70"><Clock3 size={12} />{formatDate(notification.createdAt)}</p></div></div>
          </article>
        ))}
        {!notifications.length && <EmptyInline icon={Bell} title={error || 'No notifications returned'} copy="When /api/notifications returns records, they will appear here." />}
      </div>
    </div>
  )
}

function ProfileCard({ profile, initials, onClose, onLogout }: { profile: ProfileResponse; initials: string; onClose: () => void; onLogout: () => void }) {
  return (
    <section className="fixed right-4 top-20 z-[80] w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-[0_20px_50px_rgba(15,23,42,.16)] dark:border-white/[.08] dark:bg-[#020617] dark:shadow-[0_20px_50px_rgba(0,0,0,.65)] md:right-8 md:top-24">
      <div className="relative overflow-hidden border-b border-slate-100 bg-white p-5 dark:border-white/10 dark:bg-[#111827]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-400/10" />
        <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar profile={profile} initials={initials} size="md" />
          <div className="min-w-0">
            <p className="truncate text-base font-black text-slate-950 dark:text-white">{profile.organizationName || profile.name}</p>
            <p className="mt-0.5 truncate text-xs font-bold text-slate-500 dark:text-slate-300">{profile.email || 'Email not available'}</p>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
              <ShieldCheck size={13} />{profile.status || profile.verificationStatus || 'Active donor'}
            </span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close donor profile" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">
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

function visibleProfileEntries(profile: ProfileResponse): Array<[string, unknown]> {
  return [
    ['User ID', profile.id],
    ['Status', profile.status || profile.verificationStatus],
    ['User Name', profile.name],
    ['Organization Name', profile.organizationName],
    ['Type', profile.organizationType],
    ['Email', profile.email],
    ['Phone No', profile.phone],
    ['Full Address', profile.address],
    ['District', profile.city],
    ['State', profile.state],
    ['Pincode', profile.pincode],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '')
}

function formatFileSize(size?: number) {
  if (!size) return 'Size not available'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function fileToStoredDocument(file: File): Promise<StoredDocument> {
  if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error(`${file.name} must be smaller than 2 MB`))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: String(reader.result) })
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function ProfileDetailsPage({ profile, onUpdated, onLogout }: { profile: ProfileResponse; onUpdated: (profile: ProfileResponse) => void; onLogout: () => void }) {
  const documents = Object.entries(profile.documents ?? {})
    .filter((entry): entry is [string, StoredDocument] => Boolean(entry[1]))
  const [editingAccount, setEditingAccount] = useState(false)
  const [editingDocuments, setEditingDocuments] = useState(false)

  const detailEntries = Object.entries(profile.details ?? {})
    .filter(([key, value]) => !['latitude', 'longitude'].includes(key) && value !== undefined && value !== null && value !== '')
    .sort(([first], [second]) => first.localeCompare(second))

  const profileEntries = visibleProfileEntries(profile)

  return (
    <section>
      <section className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_10px_40px_rgba(15,23,42,.08)] dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)] md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Profile</p>
            <h2 className="mt-2 text-2xl font-black">Donor registration details</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">Showing profile, registration, and verification data saved for this donor.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={onLogout} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-red-700">
              <LogOut size={15} />Log out
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black">Account information</h3>
          <button type="button" onClick={() => setEditingAccount((open) => !open)} className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-600 dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-200">
            {editingAccount ? 'Close' : 'Update'}
          </button>
        </div>
        {editingAccount && (
          <AccountUpdateCard
            profile={profile}
            onCancel={() => setEditingAccount(false)}
            onUpdated={(updatedProfile) => {
              onUpdated(updatedProfile)
              setEditingAccount(false)
            }}
          />
        )}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {profileEntries.map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-100 bg-[#F9FAFB] p-4 dark:border-white/[.08] dark:bg-[#1F2937]">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">{formatProfileLabel(label)}</p>
              <p className="mt-2 break-words text-sm font-black text-slate-700 dark:text-slate-200">{formatProfileField(value)}</p>
            </div>
          ))}
          {!profileEntries.length && <div className="md:col-span-2"><EmptyInline icon={UserCircle} title="No profile details returned" copy="Profile fields will appear here when the backend returns donor data." /></div>}
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-white/10">
          <h3 className="text-lg font-black">Registration details</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {detailEntries.map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-slate-100 bg-[#F9FAFB] p-4 dark:border-white/[.08] dark:bg-[#1F2937]">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">{formatProfileLabel(label)}</p>
                <p className="mt-2 break-words text-sm font-black text-slate-700 dark:text-slate-200">{formatProfileField(value)}</p>
              </div>
            ))}
            {!detailEntries.length && <div className="md:col-span-2"><EmptyInline icon={UserCircle} title="No registration details returned" copy="Extra donor registration fields will appear here when the backend includes them." /></div>}
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-white/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600 dark:text-emerald-300">Documents</p>
              <h3 className="mt-2 text-2xl font-black">Uploaded documents</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">{documents.length} files</span>
              <button type="button" onClick={() => setEditingDocuments((open) => !open)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-600 dark:bg-white dark:text-slate-950 dark:hover:bg-emerald-200">
                <FileCheck2 size={15} />
                {editingDocuments ? 'Close' : 'Update documents'}
              </button>
            </div>
          </div>
          {editingDocuments && (
            <DocumentUpdateCard
              onCancel={() => setEditingDocuments(false)}
              onUpdated={(updatedProfile) => {
                onUpdated(updatedProfile)
                setEditingDocuments(false)
              }}
            />
          )}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {documents.map(([key, document]) => {
              const href = document.url || document.data
              return (
                <article key={key} className="rounded-3xl border border-slate-100 bg-[#F9FAFB] p-4 dark:border-white/[.08] dark:bg-[#1F2937]">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">{formatProfileLabel(key)}</p>
                  <h4 className="mt-2 break-words text-sm font-black text-slate-800 dark:text-slate-100">{document.name || 'Uploaded document'}</h4>
                  <div className="mt-3 space-y-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                    <p>{document.type || 'Type not available'}</p>
                    <p>{formatFileSize(document.size)}</p>
                    {document.publicId && <p className="break-words">Public ID: {document.publicId}</p>}
                  </div>
                  {href && (
                    <a href={href} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-600 dark:bg-gradient-to-r dark:from-[#16A34A] dark:to-[#0F766E]">
                      View document
                    </a>
                  )}
                </article>
              )
            })}
            {!documents.length && <div className="md:col-span-2"><EmptyInline icon={UserCircle} title="No documents returned" copy="Uploaded donor documents will appear here when the backend profile includes them." /></div>}
          </div>
        </div>
      </section>
    </section>
  )
}

function DocumentUpdateCard({ onUpdated, onCancel }: { onUpdated: (profile: ProfileResponse) => void; onCancel: () => void }) {
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const documentFields = [
    ['fssaiCertificate', 'FSSAI Certificate'],
    ['businessLicense', 'Business License'],
    ['identityProof', 'Identity Proof'],
  ] as const

  useEffect(() => {
    if (!status) return
    const timeoutId = window.setTimeout(() => setStatus(''), 1000)
    return () => window.clearTimeout(timeoutId)
  }, [status])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('')
    setSaving(true)
    try {
      const formData = new FormData(event.currentTarget)
      const documents: Record<string, StoredDocument> = {}
      for (const [name] of documentFields) {
        const file = formData.get(name)
        if (file instanceof File && file.size > 0) {
          documents[name] = await fileToStoredDocument(file)
        }
      }
      if (!Object.keys(documents).length) {
        throw new Error('Choose at least one document to update.')
      }
      const response = await updateProfile({ documents })
      onUpdated(response.profile)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update documents.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/10">
      <div className="grid gap-4 md:grid-cols-3">
        {documentFields.map(([name, label]) => (
          <label key={name} className="flex cursor-pointer flex-col gap-3 rounded-3xl border border-dashed border-emerald-200 bg-white p-4 text-sm font-black transition hover:border-emerald-400 dark:border-emerald-400/20 dark:bg-white/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200">
              <FileCheck2 size={20} />
            </span>
            <span>{label}</span>
            <span className="break-words text-xs font-bold text-slate-500 dark:text-slate-300">{selectedFiles[name] || 'PDF, JPG or PNG up to 2 MB'}</span>
            <input
              name={name}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={(event) => setSelectedFiles((current) => ({ ...current, [name]: event.currentTarget.files?.[0]?.name || '' }))}
            />
          </label>
        ))}
      </div>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Save documents
        </button>
      </div>
      {status && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-200">{status}</p>}
    </form>
  )
}

function AccountUpdateCard({ profile, onUpdated, onCancel }: { profile: ProfileResponse; onUpdated: (profile: ProfileResponse) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({
    name: profile.name || '',
    organizationName: profile.organizationName || '',
    organizationType: profile.organizationType || '',
    email: profile.email || '',
    phone: profile.phone || '',
    address: profile.address || '',
    city: profile.city || '',
    state: profile.state || '',
    pincode: profile.pincode || '',
  })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const inputClass = 'rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-white/10 dark:focus:ring-emerald-400/10'

  useEffect(() => {
    if (!status) return
    const timeoutId = window.setTimeout(() => setStatus(''), 1000)
    return () => window.clearTimeout(timeoutId)
  }, [status])

  const setField = (key: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('')
    setSaving(true)
    try {
      const response = await updateProfile({
        name: draft.name.trim(),
        organizationName: draft.organizationName.trim(),
        organizationType: draft.organizationType.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        address: draft.address.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        pincode: draft.pincode.replace(/\D/g, '').slice(0, 6),
      })
      onUpdated(response.profile)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update account information.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/10">
      <div className="grid gap-4 md:grid-cols-2">
        <ReadonlyProfileField label="User ID" value={profile.id} />
        <ReadonlyProfileField label="Status" value={profile.status || profile.verificationStatus || 'Active'} />
        <EditableProfileField label="User Name" value={draft.name} onChange={(value) => setField('name', value)} inputClass={inputClass} />
        <EditableProfileField label="Organization Name" value={draft.organizationName} onChange={(value) => setField('organizationName', value)} inputClass={inputClass} />
        <EditableProfileField label="Type" value={draft.organizationType} onChange={(value) => setField('organizationType', value)} inputClass={inputClass} />
        <EditableProfileField label="Email" type="email" value={draft.email} onChange={(value) => setField('email', value)} inputClass={inputClass} />
        <EditableProfileField label="Phone No" type="tel" value={draft.phone} onChange={(value) => setField('phone', value)} inputClass={inputClass} />
        <EditableProfileField label="Pincode" value={draft.pincode} onChange={(value) => setField('pincode', value.replace(/\D/g, '').slice(0, 6))} inputClass={inputClass} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} />
        <EditableProfileField label="District" value={draft.city} onChange={(value) => setField('city', value)} inputClass={inputClass} />
        <EditableProfileField label="State" value={draft.state} onChange={(value) => setField('state', value)} inputClass={inputClass} />
        <EditableProfileField label="Full Address" value={draft.address} onChange={(value) => setField('address', value)} inputClass={inputClass} wide />
      </div>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:opacity-60">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Save changes
        </button>
      </div>
      {status && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-400/10 dark:text-red-200">{status}</p>}
    </form>
  )
}

function ReadonlyProfileField({ label, value }: { label: string; value?: string }) {
  return (
    <label className="grid gap-2 text-sm font-black">
      {label}
      <input value={value || 'Not available'} readOnly className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500 outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-300" />
    </label>
  )
}

function EditableProfileField({ label, value, onChange, inputClass, wide = false, type = 'text', ...props }: { label: string; value: string; onChange: (value: string) => void; inputClass: string; wide?: boolean; type?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className' | 'type'>) {
  return (
    <label className={`grid gap-2 text-sm font-black ${wide ? 'md:col-span-2' : ''}`}>
      {label}
      <input required type={type} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} {...props} />
    </label>
  )
}

function DonationDetailsModal({ donation, request, onClose }: { donation: FoodDonation; request?: FoodRequest; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-slate-200 bg-white shadow-2xl dark:border-white/[.08] dark:bg-[#111827]">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-white/10"><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600">Donation details</p><h2 className="mt-1 text-2xl font-black">{donation.foodName}</h2></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10"><X size={18} /></button></div>
        {getDonationImage(donation) && <img src={getDonationImage(donation)} alt="" className="h-72 w-full object-cover" />}
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Detail label="Description" value={donation.description} />
          <Detail label="NGO" value={donation.assignedReceiverName || request?.receiverOrg || 'Not assigned'} />
          <Detail label="Volunteer" value={donation.assignedVolunteerName || 'Not assigned'} />
          <Detail label="Pickup address" value={donation.location} />
          <Detail label="Pickup time" value={formatDate(donation.pickupTime)} />
          <Detail label="Priority" value={donation.priority || 'Not assigned'} />
          <Detail label="Manual review" value={donation.manualReviewRequired ? donation.manualReviewReason || 'Required' : 'Not required'} />
          <Detail label="Recommended NGOs" value={formatRecommendedNgos(donation.recommendedNgos)} />
          <Detail label="Status" value={donation.status} />
          <AIAnalysisPanel analysis={donation.aiAnalysis} />
          <div className="md:col-span-2"><Timeline donations={[donation]} requests={request ? [request] : []} /></div>
        </div>
      </section>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl bg-slate-50 p-4 dark:bg-[#111827]"><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-2 text-sm font-black">{value}</p></div>
}

function AIAnalysisPanel({ analysis }: { analysis?: Record<string, unknown> }) {
  const entries = aiAnalysisEntries(analysis)

  return (
    <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/10 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-200">AI Analyze</p>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100 dark:bg-white/10 dark:text-emerald-100 dark:ring-white/10">
          {analysis?.aiProvider ? `By ${String(analysis.aiProvider)}` : 'Not available'}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {entries.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white/80 p-3 ring-1 ring-emerald-100 dark:bg-white/10 dark:ring-white/10">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 break-words text-sm font-bold leading-5 text-slate-700 dark:text-slate-100">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function aiAnalysisEntries(analysis?: Record<string, unknown>): Array<[string, string]> {
  if (!analysis) return [['Status', 'AI analysis not available']]
  return [
    ['Food Type', formatAnalysisValue(analysis.foodType)],
    ['Category', formatAnalysisValue(analysis.category)],
    ['Estimated Servings', formatAnalysisValue(analysis.estimatedServings)],
    ['Freshness', formatAnalysisValue(analysis.freshness)],
    ['Packaging Quality', formatAnalysisValue(analysis.packaging)],
    ['Visible Damage', formatAnalysisValue(analysis.visibleDamage)],
    ['Mold', formatAnalysisValue(analysis.mold)],
    ['Leakage', formatAnalysisValue(analysis.leakage)],
    ['Burn Marks', formatAnalysisValue(analysis.burnMarks)],
    ['Contamination Signs', formatAnalysisValue(analysis.contaminationSigns)],
    ['Color Changes', formatAnalysisValue(analysis.colorChanges)],
    ['Dryness', formatAnalysisValue(analysis.dryness)],
    ['Spoilage', formatAnalysisValue(analysis.spoilage)],
    ['Visible Issues', formatAnalysisValue(analysis.visibleIssues)],
    ['Confidence Score', analysis.confidence === undefined || analysis.confidence === null || analysis.confidence === '' ? 'Not available' : `${analysis.confidence}%`],
    ['Assessment Basis', formatAnalysisValue(analysis.assessmentBasis)],
  ]
}

function formatAnalysisValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not available'
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : 'None visible'
  return String(value)
}

function qualityCheckCanPost(qualityCheck?: Record<string, unknown> | null) {
  return Boolean(qualityCheck?.canPost)
}

function qualityRequirements(qualityCheck?: Record<string, unknown> | null): Array<{ name: string; passed: boolean; percent: number; reason: string }> {
  const requirements = qualityCheck?.requirements
  if (!Array.isArray(requirements)) return []
  return requirements.map((item) => {
    const requirement = item as Record<string, unknown>
    const percent = Number(requirement.percent)
    return {
      name: String(requirement.name || 'Requirement'),
      passed: Boolean(requirement.passed),
      percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
      reason: String(requirement.reason || ''),
    }
  })
}

function formatRecommendedNgos(recommendations?: Array<Record<string, unknown>>) {
  if (!recommendations?.length) return 'No matches yet'
  return recommendations.slice(0, 5).map((ngo) => `${ngo.ngoName || 'NGO'} (${ngo.distanceKm} km, ${ngo.estimatedArrivalTime})`).join(', ')
}

function EmptyPanel({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return <section className="rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.35)]"><Icon className="mx-auto text-slate-300" size={38} /><h2 className="mt-4 text-2xl font-black">{title}</h2><p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">{copy}</p></section>
}

function EmptyInline({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center dark:border-white/10"><Icon className="mx-auto text-slate-300" size={30} /><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">{copy}</p></div>
}

function buildAnalytics(donations: FoodDonation[]) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - index))
    return { key: `${date.getFullYear()}-${date.getMonth()}`, name: date.toLocaleString(undefined, { month: 'short' }), donations: 0, meals: 0 }
  })

  donations.forEach((donation) => {
    const date = new Date(donation.createdAt)
    const item = months.find((month) => month.key === `${date.getFullYear()}-${date.getMonth()}`)
    if (item) {
      item.donations += 1
      item.meals += Number(donation.quantity || 0)
    }
  })

  const categoryMap = donations.reduce<Record<string, number>>((acc, donation) => {
    acc[donation.foodType] = (acc[donation.foodType] || 0) + 1
    return acc
  }, {})
  const categories = Object.entries(categoryMap).map(([name, value]) => ({ name, value }))

  return {
    monthly: months.map(({ key, ...month }) => month),
    categories,
  }
}
