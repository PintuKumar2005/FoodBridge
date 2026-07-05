import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  ArrowRight, BadgeCheck, BarChart3, BellRing, Bot, Building2, CheckCircle2,
  ChevronRight, CircleCheck, Clock3, Heart, Leaf,
  PackageCheck, Quote, ShieldCheck, Sparkles, Store, Truck,
  UploadCloud, Users, Utensils, WandSparkles, Zap,
} from 'lucide-react'

interface LandingPageProps {
  onDonate: () => void
  onReceive: () => void
}

const features = [
  ['AI Food Matching', 'Smart recommendations connect every donation with a suitable verified organization.', Bot, 'emerald'],
  ['Real-Time Notifications', 'Instant alerts keep donors, NGOs, and volunteers coordinated at every step.', BellRing, 'orange'],
  ['Verified Organizations', 'Identity and registration checks build a trusted network for safer handoffs.', BadgeCheck, 'blue'],
  ['Food Quality Verification', 'Guided quality checks help ensure every shared meal is safe and fresh.', ShieldCheck, 'emerald'],
  ['Request Coordination', 'Keep donors, receivers, and volunteers aligned through each handoff.', Truck, 'blue'],
  ['Impact Analytics', 'See meals served, waste prevented, and communities supported in real time.', BarChart3, 'orange'],
] as const

const workflow = [
  ['Upload food details', 'Donor adds quantity, type, quality, and pickup window.', UploadCloud],
  ['AI finds the best match', 'FoodBridge ranks verified organizations by need and food fit.', WandSparkles],
  ['NGO accepts', 'The receiver confirms need and collection details.', CircleCheck],
  ['Volunteer collects', 'A pickup partner confirms collection details.', Truck],
  ['Delivery completes', 'Both sides confirm the safe handoff.', PackageCheck],
  ['Impact is recorded', 'Meals and avoided waste update automatically.', BarChart3],
] as const

const stats = [
  ['15K+', 'Meals saved', Utensils],
  ['300+', 'NGOs connected', Users],
  ['500+', 'Restaurants registered', Store],
  ['20 t', 'Food waste reduced', Leaf],
] as const

const toneClasses = {
  emerald: 'bg-emerald-50 text-[#16A34A] dark:bg-[#22C55E]/10 dark:text-[#22C55E]',
  orange: 'bg-amber-50 text-[#F59E0B] dark:bg-[#FBBF24]/10 dark:text-[#FBBF24]',
  blue: 'bg-teal-50 text-[#0F766E] dark:bg-[#14B8A6]/10 dark:text-[#14B8A6]',
}

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.65, ease: 'easeOut' },
} as const

function Label({ children }: { children: ReactNode }) {
  return <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[#16A34A] dark:text-[#22C55E]"><Sparkles size={14} />{children}</p>
}

export default function LandingPage({ onDonate, onReceive }: LandingPageProps) {
  return (
    <div className="startup-home overflow-hidden bg-[linear-gradient(180deg,#F8FAFC_0%,#F0FDF4_52%,#ECFDF5_100%)] text-[#111827] dark:bg-[linear-gradient(180deg,#020617_0%,#0B1220_52%,#111827_100%)] dark:text-[#F9FAFB]">
      <section className="relative isolate px-5 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_12%,rgba(22,163,74,.12),transparent_32%),radial-gradient(circle_at_82%_20%,rgba(15,118,110,.10),transparent_30%),radial-gradient(circle_at_62%_4%,rgba(14,165,233,.08),transparent_26%)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(34,197,94,.10),transparent_32%),radial-gradient(circle_at_84%_18%,rgba(6,182,212,.09),transparent_30%),radial-gradient(circle_at_64%_4%,rgba(99,102,241,.08),transparent_26%)]" />
        <div className="pointer-events-none absolute -left-28 -top-24 -z-10 h-80 w-80 rounded-full bg-[#16A34A]/10 blur-3xl dark:bg-[#22C55E]/10" />
        <div className="pointer-events-none absolute -right-24 top-12 -z-10 h-96 w-96 rounded-full bg-[#0F766E]/10 blur-3xl dark:bg-[#06B6D4]/10" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-400/[.08] blur-3xl dark:bg-[#6366F1]/10" />
        <div className="absolute inset-0 -z-10 opacity-[.04] dark:opacity-[.035]" style={{ backgroundImage: 'radial-gradient(#0F766E 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="mx-auto grid max-w-[1400px] items-center gap-16 lg:grid-cols-[1.02fr_.98fr]">
          <motion.div {...fadeUp} className="premium-reveal max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white/75 px-4 py-2 text-xs font-bold text-[#16A34A] shadow-sm backdrop-blur-xl dark:border-white/[.08] dark:bg-white/[.06] dark:text-[#22C55E]">
              <Zap size={14} fill="currentColor" /> AI-powered food rescue network
            </div>
            <h1 className="mt-7 text-[clamp(3.1rem,5.9vw,6.25rem)] font-bold leading-[.98] tracking-[-.055em] text-[#111827] dark:text-[#F9FAFB]">
              Connecting surplus food with those who <span className="bg-gradient-to-r from-[#16A34A] via-[#0F766E] to-[#F59E0B] bg-clip-text text-transparent dark:from-[#22C55E] dark:via-[#14B8A6] dark:to-[#FBBF24]">need it most.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#6B7280] dark:text-[#9CA3AF] md:text-xl">
              Restaurants, hotels, and individuals donate excess food instantly. NGOs, orphanages, old-age homes, and shelters receive it in real time.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button onClick={onDonate} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#0F766E] px-7 font-bold text-white shadow-[0_14px_40px_rgba(22,163,74,.28)] transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/25 dark:from-[#16A34A] dark:to-[#0F766E] dark:text-white dark:shadow-emerald-950/40">Donate Food <ArrowRight size={18} /></button>
              <button onClick={onReceive} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white/80 px-7 font-bold text-[#111827] shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:border-[#14B8A6] hover:shadow-lg dark:border-white/[.08] dark:bg-[#111827]/75 dark:text-[#F9FAFB]">Request Food <Heart size={18} /></button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF]">
              <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#16A34A] dark:text-[#22C55E]" /> Free for NGOs</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#16A34A] dark:text-[#22C55E]" /> Verified network</span>
              <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#16A34A] dark:text-[#22C55E]" /> Real-time matching</span>
            </div>
          </motion.div>

          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.12 }} className="premium-reveal-delay relative mx-auto w-full max-w-2xl lg:ml-auto">
            <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-tr from-emerald-300/20 via-teal-300/16 to-sky-300/16 blur-3xl dark:from-[#22C55E]/10 dark:via-[#06B6D4]/10 dark:to-[#6366F1]/10" />
            <div className="relative min-h-[500px] rounded-[36px] border border-white/60 bg-white/[.65] p-5 shadow-[0_10px_40px_rgba(15,23,42,.08)] backdrop-blur-[20px] dark:border-white/[.08] dark:bg-[#111827]/60 dark:shadow-[0_20px_50px_rgba(0,0,0,.45)]">
              <div className="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white/90 p-4 shadow-sm dark:border-white/[.08] dark:bg-[#1F2937]/90">
                <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-400/10"><Store size={21} /></span><div><p className="font-bold">Fresh Table Kitchen</p><p className="text-xs text-slate-500 dark:text-slate-400">48 surplus meals ready</p></div></div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">Available</span>
              </div>

              <div className="relative my-5 h-64 overflow-hidden rounded-[26px] bg-gradient-to-br from-emerald-50 via-white to-blue-50 dark:from-emerald-950/40 dark:via-[#10251d] dark:to-blue-950/30">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(#10B98122 1px, transparent 1px),linear-gradient(90deg,#10B98122 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 250" fill="none"><path d="M60 70 C150 25, 210 190, 315 120 S410 110,455 180" stroke="#10B981" strokeWidth="4" strokeDasharray="8 8" strokeLinecap="round" /></svg>
                <span className="absolute left-[8%] top-[18%] flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg"><Utensils size={24} /></span>
                <span className="absolute right-[3%] top-[62%] flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg"><Building2 size={24} /></span>
                <span className="floating-card absolute left-[43%] top-[37%] flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-xl dark:border-[#10251d]"><Bot size={27} /></span>
                <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm dark:bg-[#10251d]/90 dark:text-slate-200">Optimized match</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[[Bot, 'AI matched', '98% fit'], [Clock3, 'Pickup', '24 min'], [Leaf, 'Impact', '48 meals']].map(([Icon, label, value]) => (
                  <div key={label as string} className="rounded-2xl border border-slate-100 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5"><Icon size={17} className="text-emerald-500" /><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label as string}</p><p className="mt-1 text-sm font-bold">{value as string}</p></div>
                ))}
              </div>
            </div>
            <div className="floating-card-delay absolute -bottom-7 -left-5 rounded-2xl border border-white bg-white/90 p-4 shadow-xl backdrop-blur dark:border-white/[.08] dark:bg-[#1F2937]/95 sm:-left-12"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-[#0F766E] dark:bg-[#14B8A6]/10 dark:text-[#14B8A6]"><Truck size={19} /></span><div><p className="text-sm font-bold">Pickup confirmed</p><p className="text-xs text-slate-500 dark:text-slate-400">Volunteer is on the way</p></div></div></div>
          </motion.div>
        </div>
      </section>

      <motion.section {...fadeUp} id="impact" className="border-y border-[#E5E7EB]/80 bg-white px-5 py-8 dark:border-white/[.08] dark:bg-[#0F172A] lg:px-8">
        <div className="mx-auto grid max-w-[1300px] grid-cols-2 gap-y-8 md:grid-cols-4">
          {stats.map(([value, label, Icon], index) => <div key={label} className={`flex items-center gap-4 px-3 md:justify-center ${index ? 'md:border-l md:border-slate-200 md:dark:border-white/10' : ''}`}><Icon size={23} className="shrink-0 text-emerald-500" /><div><p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p></div></div>)}
        </div>
      </motion.section>

      <section id="features" className="bg-[#F9FAFB] px-5 py-24 dark:bg-[#111827] lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[1300px]">
          <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center"><Label>Powerful by design</Label><h2 className="mt-5 text-4xl font-bold tracking-[-.035em] text-[#111827] dark:text-[#F9FAFB] md:text-6xl">Everything needed to rescue food at scale.</h2><p className="mt-5 text-lg leading-8 text-[#6B7280] dark:text-[#9CA3AF]">Intelligent tools make every donation safer, faster, and easier to coordinate.</p></motion.div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, copy, Icon, tone], index) => <motion.article {...fadeUp} transition={{ ...fadeUp.transition, delay: index * 0.04 }} key={title} className="group rounded-[28px] border border-[#E5E7EB] bg-white p-7 shadow-[0_10px_40px_rgba(15,23,42,.08)] transition duration-300 hover:-translate-y-1 hover:border-[#16A34A]/30 hover:shadow-[0_18px_48px_rgba(15,23,42,.10)] dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.45)]"><span className={`flex h-13 w-13 items-center justify-center rounded-2xl ${toneClasses[tone]}`}><Icon size={24} /></span><h3 className="mt-6 text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">{title}</h3><p className="mt-3 leading-7 text-[#6B7280] dark:text-[#9CA3AF]">{copy}</p><ChevronRight className="mt-6 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#16A34A] dark:text-[#9CA3AF] dark:group-hover:text-[#22C55E]" size={19} /></motion.article>)}
          </div>
        </div>
      </section>

      <section id="about" className="relative isolate overflow-hidden bg-[#F0FDF4] px-5 py-24 text-[#111827] dark:bg-[#1E293B] dark:text-[#F9FAFB] lg:px-8 lg:py-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(22,163,74,.10),transparent_30%),radial-gradient(circle_at_88%_26%,rgba(15,118,110,.08),transparent_28%)] dark:bg-[radial-gradient(circle_at_14%_18%,rgba(34,197,94,.10),transparent_32%),radial-gradient(circle_at_88%_28%,rgba(20,184,166,.08),transparent_30%)]" />
        <div className="mx-auto max-w-[1300px]">
          <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <Label>How it works</Label>
              <h2 className="mt-5 text-4xl font-bold tracking-[-.04em] text-slate-950 dark:text-white md:text-6xl">From surplus to served—in six simple steps.</h2>
              <p className="mt-6 max-w-md leading-8 text-slate-600 dark:text-slate-300">FoodBridge handles the intelligence and coordination so people can focus on helping people.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {workflow.map(([title, copy, Icon], index) => (
                <article key={title} className="group relative overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white p-7 text-slate-950 shadow-[0_10px_40px_rgba(15,23,42,.08)] transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:bg-white dark:border-white/[.08] dark:bg-[#111827] dark:text-white dark:shadow-[0_20px_50px_rgba(0,0,0,.45)] dark:hover:border-emerald-400/30">
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold tracking-[.18em] text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20">0{index + 1}</span>
                    {index < 5 && <ArrowRight className="mt-1 hidden text-slate-300 transition group-hover:text-emerald-500 dark:text-white/20 dark:group-hover:text-emerald-300 sm:block" size={18} />}
                  </div>
                  <span className="mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20">
                    <Icon size={24} />
                  </span>
                  <h3 className="mt-5 text-xl font-bold text-slate-950 dark:text-white">{title}</h3>
                  <p className="mt-3 leading-6 text-slate-600 dark:text-slate-300">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-24 dark:bg-[#0F172A] lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-[1300px] items-center gap-14 lg:grid-cols-[.82fr_1.18fr]">
          <div><Label>One command center</Label><h2 className="mt-5 text-4xl font-bold tracking-[-.04em] text-slate-900 dark:text-white md:text-6xl">Impact you can see. Logistics you can trust.</h2><p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">Manage donations and requests, review AI recommendations, follow deliveries, and report outcomes from one beautifully simple dashboard.</p><div className="mt-8 grid gap-3 text-sm font-semibold sm:grid-cols-2">{['Donation management', 'AI recommendations', 'Live delivery status', 'Impact analytics'].map(item => <p key={item} className="flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={17} />{item}</p>)}</div></div>
          <div className="rounded-[32px] border border-[#E5E7EB] bg-white p-3 shadow-[0_10px_40px_rgba(15,23,42,.08)] dark:border-white/[.08] dark:bg-[#111827] dark:shadow-[0_20px_50px_rgba(0,0,0,.45)]"><div className="overflow-hidden rounded-[24px] bg-[#F9FAFB] dark:bg-[#1F2937]"><div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-white/10"><div><p className="text-xs font-semibold text-slate-400">Good morning,</p><p className="font-bold">Green Leaf Restaurant</p></div><div className="flex gap-2"><span className="h-9 w-9 rounded-full bg-emerald-100" /><span className="h-9 w-9 rounded-full bg-blue-100" /></div></div><div className="grid gap-4 p-5 sm:grid-cols-3">{[['Meals saved', '1,250', 'text-emerald-500'], ['Active matches', '18', 'text-blue-500'], ['Waste reduced', '850 kg', 'text-amber-500']].map(([label, value, color]) => <div key={label} className="rounded-2xl bg-white p-4 shadow-sm dark:bg-[#111827]"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></div>)}</div><div className="grid gap-4 px-5 pb-5 sm:grid-cols-[1.2fr_.8fr]"><div className="rounded-2xl bg-white p-5 dark:bg-[#111827]"><div className="flex justify-between"><p className="font-bold">Weekly impact</p><span className="text-xs font-bold text-emerald-500">+24%</span></div><div className="mt-6 flex h-36 items-end gap-3">{[42, 68, 54, 82, 62, 90, 76].map((height, index) => <div key={index} className="flex-1 rounded-t-lg bg-gradient-to-t from-emerald-500 to-emerald-300" style={{ height: `${height}%` }} />)}</div></div><div className="rounded-2xl bg-white p-5 dark:bg-[#111827]"><p className="font-bold">AI match</p><div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-400/10 dark:bg-emerald-400/5"><Bot className="text-emerald-500" size={22} /><p className="mt-3 text-sm font-bold">Hope Care Foundation</p><p className="mt-1 text-xs text-slate-500">2.3 km • 98% match</p><button onClick={onDonate} className="mt-4 w-full rounded-lg bg-emerald-500 py-2 text-xs font-bold text-white">Review match</button></div></div></div></div></div>
        </div>
      </section>

      <section className="bg-[#F0FDF4] px-5 py-24 dark:bg-[#1E293B] lg:px-8">
        <div className="mx-auto max-w-[1300px]"><div className="text-center"><Label>Trusted by good people</Label><h2 className="mt-5 text-4xl font-bold tracking-[-.035em] text-slate-900 dark:text-white md:text-5xl">Built around the people doing the work.</h2></div><div className="mt-12 grid gap-5 md:grid-cols-3">{[
          ['“FoodBridge turned an unpredictable donation process into something our team can manage in minutes.”', 'Aarav Mehta', 'Restaurant partner', Store],
          ['“The real-time matching means our children receive fresh meals when we actually need them.”', 'Nisha Rao', 'NGO director', Building2],
          ['“I always know where to go, who is waiting, and the impact of every delivery I complete.”', 'Kabir Singh', 'Volunteer', Truck],
        ].map(([copy, name, role, Icon]) => <article key={name as string} className="rounded-[28px] border border-white bg-white/80 p-7 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"><Quote size={26} className="text-emerald-400" /><p className="mt-5 text-lg leading-8 text-slate-700 dark:text-slate-200">{copy as string}</p><div className="mt-7 flex items-center gap-3 border-t border-slate-100 pt-5 dark:border-white/10"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"><Icon size={19} /></span><div><p className="text-sm font-bold">{name as string}</p><p className="text-xs text-slate-500 dark:text-slate-400">{role as string}</p></div></div></article>)}</div></div>
      </section>

      <section id="contact" className="px-5 py-24 lg:px-8 lg:py-32"><div className="relative mx-auto max-w-[1300px] overflow-hidden rounded-[36px] bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-16 text-center text-white shadow-[0_25px_80px_rgba(16,185,129,.3)] md:px-16"><div className="absolute -left-20 -top-28 h-72 w-72 rounded-full border-[50px] border-white/10" /><div className="absolute -bottom-28 -right-12 h-72 w-72 rounded-full bg-blue-500/25 blur-xl" /><div className="relative mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-100">Every meal matters</p><h2 className="mt-5 text-4xl font-bold tracking-[-.04em] md:text-6xl">Ready to turn surplus into impact?</h2><p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-emerald-50">Join the people and organizations building a smarter, kinder food system.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><button onClick={onDonate} className="rounded-2xl bg-white px-7 py-4 font-bold text-emerald-700 shadow-lg transition hover:-translate-y-1">Start donating</button><button onClick={onReceive} className="rounded-2xl border border-white/35 bg-white/10 px-7 py-4 font-bold backdrop-blur transition hover:bg-white/20">Request food</button></div></div></div></section>
    </div>
  )
}
