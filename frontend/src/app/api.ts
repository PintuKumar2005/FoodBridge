const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api'
const ACCESS_TOKEN_KEY = 'foodbridge-access-token'
const REFRESH_TOKEN_KEY = 'foodbridge-refresh-token'

type ApiOptions = RequestInit & {
  body?: BodyInit | Record<string, unknown> | null
}

async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const init: RequestInit = {
    ...options,
    headers,
  }

  if (options.body && !(options.body instanceof FormData) && typeof options.body !== 'string') {
    headers.set('Content-Type', 'application/json')
    init.body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init)
  } catch (error) {
    throw new Error(`Cannot connect to FoodBridge API at ${API_BASE_URL}. Start the backend with "cd foodbridge-backend && mvn spring-boot:run", then try again.`)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Something went wrong')
  }

  return payload as T
}

export function storeAuthTokens(tokens: { accessToken?: string; refreshToken?: string }) {
  if (tokens.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  if (tokens.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export type AccountRole = 'donor' | 'receiver'
export type UserRole = AccountRole | 'admin'

export type AuthUser = {
  id: string
  type: UserRole
  email: string
  name: string
  organizationName: string
  organizationType: string
  phone: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  latitude?: number
  longitude?: number
  status?: string
  createdAt?: string
  details?: Record<string, unknown>
}

export type AuthResponse = {
  message: string
  user: AuthUser
  accessToken?: string
  refreshToken?: string
  tokenType?: 'Bearer'
}

export type StoredDocument = {
  name: string
  type: string
  size: number
  data: string
  url?: string
  publicId?: string
}

export type DonorRegistrationPayload = {
  businessName: string
  businessType: string
  fssaiLicenseNumber?: string
  businessRegistrationNumber?: string
  ownerName: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  pincode: string
  latitude?: number
  longitude?: number
  foodType: 'Veg' | 'Non-Veg' | 'Both'
  averageDailySurplus?: number
  pickupAvailability: 'NGO Pickup' | 'Self Delivery'
  documents: {
    fssaiCertificate?: StoredDocument
    businessLicense?: StoredDocument
    identityProof: StoredDocument
  }
}

export type FoodDonation = {
  id: string
  donorId: string
  donorName: string
  organizationName: string
  foodName: string
  foodType: 'Veg' | 'Non-Veg' | 'Both'
  quantity: number
  unit: 'Meals' | 'Plates' | 'Boxes' | 'Packs' | 'Kg'
  location: string
  latitude?: number
  longitude?: number
  pickupTime: string
  expiryTime: string
  description: string
  image?: StoredDocument
  status: 'available' | 'requested' | 'assigned' | 'collected'
  assignedReceiverName?: string
  assignedVolunteerName?: string
  createdAt: string
}

export type FoodRequest = {
  id: string
  foodId: string
  donorId: string
  receiverId: string
  foodName: string
  foodType: string
  donorOrg: string
  receiverName: string
  receiverOrg: string
  receiverType: string
  message: string
  requestedAt: string
  createdAt?: string
  status: 'pending' | 'approved' | 'rejected' | 'collected'
}

export type DashboardMessage = {
  id: string
  from?: string
  senderName?: string
  subject?: string
  message?: string
  createdAt?: string
  read?: boolean
}

export type AnalyticsResponse = {
  mealsReceived?: number
  foodCategories?: Array<{ name: string; value: number }>
  monthlyRequests?: Array<{ name: string; requests: number }>
  weeklyDeliveries?: Array<{ name: string; deliveries: number }>
  successRate?: number
}

export type AppNotification = {
  id: string
  subject?: string
  title?: string
  message?: string
  detail?: string
  type?: string
  read?: boolean
  createdAt?: string
  referenceId?: string
}

export type ProfileResponse = AuthUser & {
  profileImageUrl?: string
  verificationStatus?: string
  restaurant?: string
  details?: Record<string, unknown>
  documents?: Record<string, StoredDocument | undefined>
}

export function sendOtp(payload: { role: AccountRole; phone: string }) {
  return apiRequest<{ message: string; otp?: string }>('/auth/send-otp', {
    method: 'POST',
    body: payload,
  })
}

export function verifyOtp(payload: { role: AccountRole; phone: string; otp: string }) {
  return apiRequest<AuthResponse>('/auth/verify-otp', {
    method: 'POST',
    body: payload,
  })
}

export function directLogin(payload: { role: AccountRole; phone: string }) {
  return apiRequest<AuthResponse>('/auth/direct-login', {
    method: 'POST',
    body: payload,
  })
}

export function registerDonor(payload: DonorRegistrationPayload) {
  return apiRequest<AuthResponse>('/donors', {
    method: 'POST',
    body: payload,
  })
}

export function registerReceiver(payload: Record<string, FormDataEntryValue>) {
  return apiRequest<AuthResponse>('/receivers', {
    method: 'POST',
    body: payload,
  })
}

export function createDonation(payload: Omit<FoodDonation, 'id' | 'donorName' | 'organizationName' | 'status' | 'assignedReceiverName' | 'assignedVolunteerName' | 'createdAt'>) {
  return apiRequest<{ message: string; donation: FoodDonation }>('/donations', { method: 'POST', body: payload })
}

export function getDonations(params: { donorId?: string; status?: 'available' } = {}) {
  const query = new URLSearchParams(params).toString()
  return apiRequest<{ donations: FoodDonation[] }>(`/donations${query ? `?${query}` : ''}`)
}

export function updateDonation(id: string, payload: Partial<FoodDonation> & { donorId?: string }) {
  return apiRequest<{ message: string; donation: FoodDonation }>(`/donations/${id}`, { method: 'PUT', body: payload })
}

export function deleteDonation(id: string, donorId: string) {
  return apiRequest<{ message: string }>(`/donations/${id}`, { method: 'DELETE', body: { donorId } })
}

export function createFoodRequest(payload: { foodId: string; receiverId: string; message?: string; requiredQuantity?: number; pickupTime?: string; notes?: string }) {
  return apiRequest<{ message: string; request: FoodRequest }>('/food-requests', { method: 'POST', body: payload })
}

export function getFoodRequests(params: { donorId?: string; receiverId?: string }) {
  return apiRequest<{ requests: FoodRequest[] }>(`/food-requests?${new URLSearchParams(params).toString()}`)
}

export function updateFoodRequest(id: string, payload: { action: 'approve' | 'reject' | 'collected'; userId: string }) {
  return apiRequest<{ message: string; request: FoodRequest }>(`/food-requests/${id}`, { method: 'PATCH', body: payload })
}

export function getCurrentUser() {
  return apiRequest<{ user?: AuthUser } | AuthUser>('/users/me')
}

export function getProfile(params: { userId?: string } = {}) {
  const query = new URLSearchParams(params).toString()
  return apiRequest<{ profile?: ProfileResponse | null; user?: ProfileResponse } | ProfileResponse | null>(`/profile${query ? `?${query}` : ''}`)
}

export function getNotifications(params: { userId?: string } = {}) {
  const query = new URLSearchParams(params).toString()
  return apiRequest<{ notifications?: AppNotification[] } | AppNotification[]>(`/notifications${query ? `?${query}` : ''}`)
}

export function getMessages(params: { userId?: string } = {}) {
  const query = new URLSearchParams(params).toString()
  return apiRequest<{ messages?: DashboardMessage[] } | DashboardMessage[]>(`/messages${query ? `?${query}` : ''}`)
}

export function getAnalytics(params: { userId?: string } = {}) {
  const query = new URLSearchParams(params).toString()
  return apiRequest<AnalyticsResponse>(`/analytics${query ? `?${query}` : ''}`)
}

export function getAdminUsers() {
  return apiRequest<{ users: AuthUser[] }>('/admin/users')
}

export function deleteAdminUser(id: string) {
  return apiRequest<{ message: string }>(`/admin/users/${id}`, { method: 'DELETE' })
}

export function deleteAdminDonation(id: string) {
  return apiRequest<{ message: string }>(`/admin/donations/${id}`, { method: 'DELETE' })
}

export function deleteAdminFoodRequest(id: string) {
  return apiRequest<{ message: string }>(`/admin/food-requests/${id}`, { method: 'DELETE' })
}
