import { useState } from 'react'
import { CheckCircle2, ChevronLeft, LogIn, Phone, ShieldCheck, Store, Users } from 'lucide-react'
import { sendOtp, verifyOtp, type AccountRole, type AuthUser } from '../api'

interface LoginPageProps {
  onBack: () => void
  onLogin: (user: AuthUser, tokens?: { accessToken?: string; refreshToken?: string }) => void
}

export default function LoginPage({ onBack, onLogin }: LoginPageProps) {
  const [role, setRole] = useState<AccountRole>('donor')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async () => {
    setStatus('')
    if (!phone.trim()) {
      setStatus('Please enter your registered mobile number to continue.')
      return
    }
    setIsSubmitting(true)
    try {
      if (!otpSent) {
        const response = await sendOtp({ role, phone })
        setOtpSent(true)
        setStatus(response.otp ? `Dummy OTP: ${response.otp}` : response.message || 'OTP sent. Enter the code to continue.')
        return
      }
      if (!otp.trim()) {
        setStatus('Please enter the OTP sent to your registered mobile number.')
        return
      }
      const response = await verifyOtp({ role, phone, otp })
      onLogin(response.user, response)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to log in')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="premium-page login-page relative isolate min-h-[calc(100vh-96px)] overflow-hidden bg-[linear-gradient(180deg,#F8FAFC_0%,#F0FDF4_52%,#ECFDF5_100%)] px-5 py-12 text-[#111827] dark:bg-[linear-gradient(180deg,#020617_0%,#0B1220_52%,#111827_100%)] dark:text-[#F9FAFB] lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_10%,rgba(22,163,74,.12),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(15,118,110,.10),transparent_28%),radial-gradient(circle_at_62%_6%,rgba(14,165,233,.08),transparent_25%)] dark:bg-[radial-gradient(circle_at_14%_8%,rgba(34,197,94,.10),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(6,182,212,.09),transparent_28%),radial-gradient(circle_at_60%_4%,rgba(99,102,241,.08),transparent_25%)]" />
      <div className="mx-auto max-w-6xl">
        <button onClick={onBack} className="login-back mb-7 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-200">
          <ChevronLeft size={17} />
          Back to home
        </button>

        <div className="login-card grid overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-2xl shadow-slate-900/8 dark:border-white/[.08] dark:bg-[#111827] lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="login-hero bg-gradient-to-br from-emerald-100 via-[#16A34A]/40 to-[#0F766E]/50 p-8 text-emerald-950 dark:from-[#22C55E]/20 dark:via-[#14B8A6]/20 dark:to-[#1F2937] dark:text-[#F9FAFB] md:p-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/45 px-4 py-2 text-sm font-black ring-1 ring-white/60 backdrop-blur dark:bg-white/10 dark:ring-white/15">
              <ShieldCheck size={17} />
              Simple account access
            </span>
            <h1 className="premium-display mt-7 text-4xl font-normal leading-tight tracking-tight md:text-6xl">Welcome back to FoodBridge</h1>
            <p className="mt-5 text-lg leading-8">
              Choose your account type and enter your registered phone number to open your FoodBridge workspace.
            </p>

            <div className="mt-10 grid gap-3">
              {['One-step phone login', 'Registered accounts only', 'Donor and receiver workspaces'].map((item) => (
                <p key={item} className="flex items-center gap-3 rounded-2xl bg-white/35 px-4 py-3 font-semibold ring-1 ring-white/50 backdrop-blur dark:bg-white/10 dark:ring-white/10">
                  <CheckCircle2 size={20} />
                  {item}
                </p>
              ))}
            </div>
          </aside>

          <div className="login-form-panel p-6 md:p-10">
            <div className="mx-auto max-w-xl">
              <div className="mb-8">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-500">Login</p>
                <h2 className="premium-display mt-2 text-4xl font-normal tracking-tight text-slate-950 dark:text-white">Direct login</h2>
                <p className="mt-2 text-slate-500 dark:text-slate-400">Choose your account type and use the phone number entered during registration.</p>
              </div>

              <div className="mb-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setRole('donor')
                    setOtpSent(false)
                    setOtp('')
                  }}
                  className={`login-role-card rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                    role === 'donor'
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-950 ring-4 ring-emerald-100 dark:bg-emerald-400/20 dark:text-emerald-100 dark:ring-emerald-400/15'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-black dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/10 dark:hover:text-white'
                  }`}
                >
                  <Store className={role === 'donor' ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-500 dark:text-emerald-100'} size={24} />
                  <p className="mt-3 font-black">Donor</p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Restaurant, hotel, caterer</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole('receiver')
                    setOtpSent(false)
                    setOtp('')
                  }}
                  className={`login-role-card rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                    role === 'receiver'
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-950 ring-4 ring-emerald-100 dark:bg-emerald-400/20 dark:text-emerald-100 dark:ring-emerald-400/15'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-slate-950 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/10 dark:hover:text-white'
                  }`}
                >
                  <Users className={role === 'receiver' ? 'text-emerald-700 dark:text-emerald-100' : 'text-slate-500 dark:text-emerald-100'} size={24} />
                  <p className="mt-3 font-black">Receiver</p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">NGO, orphanage, shelter</p>
                </button>
              </div>

              <div className="grid gap-5">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Phone Number</span>
                  <div className="login-phone-field flex items-center gap-3 rounded-2xl border border-slate-200 bg-transparent px-4 py-3 transition hover:border-emerald-400 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-100 dark:border-white/10 dark:hover:border-emerald-400/30 dark:focus-within:ring-emerald-400/10">
                    <Phone size={19} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-300">+91</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value)
                        setOtpSent(false)
                        setOtp('')
                      }}
                    />
                  </div>
                </label>

                {otpSent && (
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">OTP Code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:text-white dark:placeholder:text-slate-500 dark:hover:border-emerald-400/30 dark:focus-within:ring-emerald-400/10"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                  </label>
                )}

                {status && <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{status}</p>}

                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={isSubmitting}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-6 py-4 text-base font-black text-emerald-950 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5 hover:bg-emerald-300 hover:shadow-xl hover:shadow-emerald-400/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-400/20"
                >
                  <LogIn size={19} />
                  {isSubmitting ? (otpSent ? 'Verifying...' : 'Sending OTP...') : otpSent ? 'Verify OTP & Login' : 'Send OTP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
