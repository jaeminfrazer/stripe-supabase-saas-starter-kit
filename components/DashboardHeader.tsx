import Link from "next/link"
import DashboardHeaderProfileDropdown from "./DashboardHeaderProfileDropdown"

export default function DashboardHeader() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-black/10 bg-[#f8f7f4]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f8f7f4]/80">
            <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
                <Link href="/dashboard" className="group flex items-center gap-3" aria-label="Jbot home">
                    <span className="text-2xl font-semibold tracking-[-0.06em] text-[#111111]">Jbot<span className="text-neutral-400">.</span></span>
                    <span className="hidden h-7 border-l border-black/15 sm:block" />
                    <span className="hidden text-[10px] font-semibold uppercase leading-4 tracking-[0.18em] text-neutral-500 sm:block">The Insecurity<br />Project</span>
                </Link>
                <nav className="flex items-center gap-3 sm:gap-6">
                    <Link className="hidden text-sm font-medium text-neutral-600 transition hover:text-black sm:inline-flex" href="/dashboard">Your journey</Link>
                    <Link className="inline-flex items-center border border-black bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800" href="/chat">Open Jbot <span aria-hidden="true" className="ml-2">↗</span></Link>
                    <DashboardHeaderProfileDropdown />
                </nav>
            </div>
        </header>
    )
}
