import { ArrowRight, HeartHandshake, Instagram, Linkedin } from 'lucide-react'

export default function SiteFooter() {
  return (
    <footer className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 text-[#111827] dark:border-white/[.08] dark:bg-[#0F172A] dark:text-[#F9FAFB] lg:px-10">
      <div className="mx-auto max-w-[1360px] py-16 lg:py-20">
        <div className="grid gap-14 lg:grid-cols-[1.3fr_.7fr_.7fr_1.2fr]">
          <div>
            <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#0F766E] text-white shadow-lg shadow-emerald-500/20"><HeartHandshake size={24} /></span><span className="text-2xl font-black text-[#111827] dark:text-[#F9FAFB]">Food<span className="text-[#16A34A] dark:text-[#22C55E]">Bridge</span></span></div>
            <p className="mt-6 max-w-sm leading-7 text-[#6B7280] dark:text-[#9CA3AF]">Rescuing good food, nourishing local communities, and making every shared meal count.</p>
            <div className="mt-8 flex gap-3"><a aria-label="Instagram" href="#home" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#6B7280] shadow-sm transition hover:-translate-y-0.5 hover:border-[#16A34A] hover:text-[#16A34A] hover:shadow-lg dark:border-white/[.08] dark:bg-[#111827] dark:text-[#9CA3AF] dark:hover:border-[#22C55E] dark:hover:text-[#22C55E]"><Instagram size={17} /></a><a aria-label="LinkedIn" href="#home" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-[#6B7280] shadow-sm transition hover:-translate-y-0.5 hover:border-[#16A34A] hover:text-[#16A34A] hover:shadow-lg dark:border-white/[.08] dark:bg-[#111827] dark:text-[#9CA3AF] dark:hover:border-[#22C55E] dark:hover:text-[#22C55E]"><Linkedin size={17} /></a></div>
          </div>

          {[
            ['Explore', ['Donate food', 'Find food', 'Our impact', 'About us']],
            ['Support', ['Food safety', 'Guidelines', 'Help centre', 'Contact']],
          ].map(([title, items]) => (
            <div key={title as string}><p className="text-xs font-bold uppercase tracking-[.2em] text-[#16A34A] dark:text-[#22C55E]">{title as string}</p><div className="mt-6 grid gap-3 text-sm text-[#6B7280] dark:text-[#9CA3AF]">{(items as string[]).map((item) => <a key={item} href="#home" className="transition hover:text-[#16A34A] dark:hover:text-[#22C55E]">{item}</a>)}</div></div>
          ))}

          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#16A34A] dark:text-[#22C55E]">The good news</p>
            <p className="mt-6 leading-7 text-[#6B7280] dark:text-[#9CA3AF]">Monthly stories of rescued meals and the people behind them.</p>
            <div className="mt-5 flex rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm transition focus-within:border-[#16A34A] focus-within:ring-4 focus-within:ring-emerald-500/10 dark:border-white/[.08] dark:bg-[#111827] dark:focus-within:border-[#22C55E]"><input aria-label="Email address" placeholder="Your email address" className="min-w-0 flex-1 bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF] dark:text-[#F9FAFB]" /><button aria-label="Subscribe" className="text-[#16A34A] transition hover:text-[#0F766E] dark:text-[#22C55E] dark:hover:text-[#14B8A6]"><ArrowRight size={20} /></button></div>
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t border-[#E5E7EB] pt-6 text-xs text-[#6B7280] dark:border-white/[.08] dark:text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between"><p>© 2026 FoodBridge. Built for a fuller table.</p><div className="flex gap-6"><a href="#home" className="transition hover:text-[#16A34A] dark:hover:text-[#22C55E]">Privacy</a><a href="#home" className="transition hover:text-[#16A34A] dark:hover:text-[#22C55E]">Terms</a></div></div>
      </div>
    </footer>
  )
}
