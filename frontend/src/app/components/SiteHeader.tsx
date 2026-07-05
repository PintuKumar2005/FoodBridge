import { useState } from 'react'
import { ArrowUpRight, HeartHandshake, Menu, Moon, Sun, X } from 'lucide-react'

interface SiteHeaderProps { dark: boolean; onToggleTheme: () => void; onHome: () => void; onLogin: () => void; onSignup: () => void }
const links = [['Features', '#features'], ['How it works', '#about'], ['Our impact', '#impact'], ['Contact', '#contact']]

export default function SiteHeader({ dark, onToggleTheme, onHome, onLogin, onSignup }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="site-header sticky top-0 z-50 border-b border-[#E5E7EB]/80 bg-white/[.65] text-[#111827] shadow-[0_10px_40px_rgba(15,23,42,.08)] backdrop-blur-[20px] dark:border-white/[.08] dark:bg-[#111827]/60 dark:text-[#F9FAFB] dark:shadow-[0_20px_50px_rgba(0,0,0,.45)]">
      <nav className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
        <button onClick={onHome} className="group flex items-center gap-3 text-left"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16A34A] to-[#0F766E] text-white shadow-lg shadow-emerald-500/20 transition group-hover:-rotate-6 group-hover:scale-105"><HeartHandshake size={23} /></span><span className="text-xl font-black tracking-[-.03em]">Food<span className="text-[#16A34A] dark:text-[#22C55E]">Bridge</span></span></button>
        <div className="hidden items-center gap-8 lg:flex">{links.map(([label, href]) => <a key={label} href={href} className="text-[13px] font-bold text-[#6B7280] transition hover:text-[#16A34A] dark:text-[#9CA3AF] dark:hover:text-[#22C55E]">{label}</a>)}</div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={dark} onClick={onToggleTheme} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white/85 text-[#111827] shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#16A34A]/40 hover:text-[#16A34A] hover:shadow-lg dark:border-white/[.08] dark:bg-[#1F2937]/80 dark:text-[#F9FAFB] dark:hover:border-[#22C55E]/40 dark:hover:text-[#22C55E]">
            {dark ? <Moon size={17} /> : <Sun size={17} />}
            <span className="sr-only">{dark ? 'Dark mode enabled' : 'Light mode enabled'}</span>
          </button>
          <button onClick={onLogin} className="hidden rounded-xl border border-transparent bg-white/10 px-5 py-2 text-sm font-bold text-[#111827] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-600 hover:shadow-lg hover:shadow-emerald-500/10 dark:text-[#d0d7de] dark:hover:border-emerald-400/30 dark:hover:text-emerald-300 dark:hover:shadow-emerald-950/30 sm:block">Log in</button>
          <button onClick={onSignup} className="hidden items-center gap-2 rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#0F766E] px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/25 dark:from-[#16A34A] dark:to-[#0F766E] dark:text-white dark:shadow-emerald-950/40 sm:flex">Join the bridge <ArrowUpRight size={16} /></button>
          <button aria-label="Open menu" onClick={() => setMenuOpen(open => !open)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white/70 dark:border-white/[.08] dark:bg-white/[.05] lg:hidden">{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </nav>
      {menuOpen && <div className="border-t border-[#E5E7EB] bg-white/95 px-5 py-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/[.08] dark:bg-[#111827]/95 lg:hidden"><div className="grid">{links.map(([label, href]) => <a key={label} href={href} onClick={() => setMenuOpen(false)} className="border-b border-[#E5E7EB] py-4 text-lg font-bold text-[#111827] dark:border-white/[.08] dark:text-[#F9FAFB]">{label}</a>)}</div><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => { setMenuOpen(false); onLogin() }} className="rounded-2xl border border-[#E5E7EB] px-4 py-3 font-bold text-[#111827] dark:border-white/[.08] dark:text-[#F9FAFB]">Log in</button><button onClick={() => { setMenuOpen(false); onSignup() }} className="rounded-2xl bg-[#16A34A] px-4 py-3 font-bold text-white dark:bg-gradient-to-r dark:from-[#16A34A] dark:to-[#0F766E]">Join now</button></div></div>}
    </header>
  )
}
