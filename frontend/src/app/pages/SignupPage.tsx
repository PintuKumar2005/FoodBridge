import { ArrowRight, CheckCircle2, ChevronLeft, HeartHandshake, Sparkles, Store } from 'lucide-react'

interface SignupPageProps {
  onBack: () => void
  onDonor: () => void
  onReceiver: () => void
}

export default function SignupPage({ onBack, onDonor, onReceiver }: SignupPageProps) {
  return (
    <section className="premium-page relative min-h-[calc(100vh-78px)] overflow-hidden bg-[linear-gradient(180deg,#F8FAFC_0%,#F0FDF4_52%,#ECFDF5_100%)] px-5 py-14 text-[#111827] dark:bg-[linear-gradient(180deg,#020617_0%,#0B1220_52%,#111827_100%)] dark:text-[#F9FAFB] lg:px-8 lg:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(22,163,74,.12),transparent_27%),radial-gradient(circle_at_88%_75%,rgba(15,118,110,.09),transparent_28%),radial-gradient(circle_at_70%_8%,rgba(14,165,233,.07),transparent_25%)] dark:bg-[radial-gradient(circle_at_12%_18%,rgba(34,197,94,.10),transparent_27%),radial-gradient(circle_at_88%_75%,rgba(6,182,212,.09),transparent_28%),radial-gradient(circle_at_70%_8%,rgba(99,102,241,.08),transparent_25%)]" />
      <div className="relative mx-auto max-w-6xl">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200">
          <ChevronLeft size={17} />
          Back to home
        </button>

        <div className="mx-auto mb-12 mt-10 max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-emerald-700 shadow-sm backdrop-blur dark:border-emerald-400/20 dark:bg-white/5 dark:text-emerald-300">
            <Sparkles size={14} /> FoodBridge onboarding
          </p>
          <h1 className="mt-6 text-5xl font-bold leading-[1.04] tracking-[-.045em] text-slate-900 dark:text-white md:text-7xl">How will you join the bridge?</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Choose your role and become part of a trusted network that moves surplus food to communities that need it.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <article className="group relative overflow-hidden rounded-[30px] border border-[#E5E7EB] bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(15,23,42,.10)] dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.45)] md:p-10">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-200/35 blur-2xl dark:bg-amber-400/10" />
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-sm dark:bg-amber-400/10 dark:text-amber-300">
                <Store size={30} />
              </div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-amber-600 dark:text-amber-300">Share surplus food</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-.03em] md:text-4xl">Register as a Donor</h2>
              <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">For restaurants, hotels, bakeries, caterers, and event organizers ready to donate safely.</p>
              <div className="mt-6 space-y-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {['List surplus meals quickly', 'Connect with verified receivers'].map((item) => <p key={item} className="flex items-center gap-2"><CheckCircle2 size={17} className="text-amber-500" />{item}</p>)}
              </div>
              <button onClick={onDonor} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-4 font-bold text-white shadow-lg shadow-amber-500/20 transition group-hover:bg-amber-600">
                Continue as Donor <ArrowRight size={18} />
              </button>
            </div>
          </article>

          <article className="group relative overflow-hidden rounded-[30px] border border-[#E5E7EB] bg-white p-8 shadow-[0_10px_40px_rgba(15,23,42,.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(15,23,42,.10)] dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.45)] md:p-10">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-200/40 blur-2xl dark:bg-emerald-400/10" />
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm dark:bg-emerald-400/10 dark:text-emerald-300">
                <HeartHandshake size={30} />
              </div>
              <p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-emerald-600 dark:text-emerald-300">Receive food support</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-.03em] md:text-4xl">Register as a Receiver</h2>
              <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">For NGOs, orphanages, old age homes, and shelters seeking food donation support.</p>
              <div className="mt-6 space-y-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {['Receive donation alerts', 'Join the verified NGO network'].map((item) => <p key={item} className="flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-500" />{item}</p>)}
              </div>
              <button onClick={onReceiver} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-bold text-white shadow-lg shadow-emerald-500/20 transition group-hover:bg-emerald-600">
                Continue as Receiver <ArrowRight size={18} />
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
