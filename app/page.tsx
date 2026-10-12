import Image from "next/image"
import Link from "next/link"
import StripePricingTable from "@/components/StripePricingTable"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f4f2ee] text-[#111111]">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f4f2ee]/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Jbot home">
            <span className="flex h-10 w-10 items-center justify-center bg-black text-xs font-semibold text-white">Jbot</span>
            <span className="text-xl font-semibold tracking-[-0.06em]">Jbot<span className="text-neutral-400">.</span></span>
            <span className="hidden border-l border-black/15 pl-3 text-[10px] font-semibold uppercase leading-4 tracking-[0.18em] text-neutral-500 sm:block">The Insecurity<br />Project</span>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-7">
            <a className="hidden text-sm text-neutral-600 transition hover:text-black sm:inline" href="#about">What Jbot does</a>
            <a className="hidden text-sm text-neutral-600 transition hover:text-black sm:inline" href="#approach">The approach</a>
            <a className="hidden text-sm text-neutral-600 transition hover:text-black sm:inline" href="#pricing">Pricing</a>
            <Link className="bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800" href="/login">Get started <span aria-hidden="true">↗</span></Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#111111] text-white">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-[30rem] w-[30rem] rounded-full border border-white/10 sm:right-12 sm:top-10" />
        <div aria-hidden="true" className="absolute -right-8 top-0 h-72 w-72 rounded-full border border-white/10 sm:right-28 sm:top-24" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 sm:px-10 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:px-14 lg:py-32">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">The Insecurity Project · By Jaemin Frazer</p>
            <h1 className="mt-8 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">Understand the structure of insecurity.</h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/75 sm:text-xl sm:leading-9">AI trained to understand the precise structure of personal insecurity and human aliveness.</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex h-12 items-center bg-white px-6 text-sm font-semibold text-black transition hover:bg-neutral-200">Start with Jbot <span aria-hidden="true" className="ml-3">↗</span></Link>
              <Link href="/login" className="inline-flex h-12 items-center border border-white/30 px-6 text-sm font-semibold text-white transition hover:bg-white/10">Sign in</Link>
            </div>
            <p className="mt-10 text-xs leading-6 text-white/45">A personal experience built around the work of Jaemin Frazer.</p>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-4 border border-white/10" />
            <Image src="/31-Jaemin_Frazer-44.jpg" alt="Jaemin Frazer" width={700} height={900} priority className="relative aspect-[4/5] w-full object-cover object-top grayscale" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">Jaemin Frazer</p>
              <p className="mt-2 text-2xl font-medium tracking-tight">The Insecurity Project</p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
        <div className="grid gap-8 md:grid-cols-[0.7fr_1.3fr] md:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">The work</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">Not another generic AI conversation.</h2>
          </div>
          <div className="max-w-3xl">
            <p className="text-lg leading-8 text-neutral-700">Jbot is designed around a specific way of understanding personal insecurity: the structures, stories and strategies that shape how we see ourselves and move through the world.</p>
            <p className="mt-5 text-lg leading-8 text-neutral-700">The intention isn’t to give you a stream of generic advice. It is to help you examine what is happening with greater precision, so you can recognise the patterns at work and discover what becomes possible beyond them.</p>
          </div>
        </div>
      </section>

      <section id="approach" className="border-y border-black/10 bg-[#eae7e1]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-24 lg:px-14">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Three ideas at the centre</p>
          <div className="mt-10 grid gap-px border border-black/10 bg-black/10 md:grid-cols-3">
            <article className="bg-[#eae7e1] p-7 sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">01</p>
              <h3 className="mt-8 text-2xl font-semibold tracking-tight">Understand the structure</h3>
              <p className="mt-4 text-sm leading-7 text-neutral-700">Look beyond the surface reaction to the assumptions, agreements and strategies underneath it.</p>
            </article>
            <article className="bg-[#eae7e1] p-7 sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">02</p>
              <h3 className="mt-8 text-2xl font-semibold tracking-tight">Explore without judgement</h3>
              <p className="mt-4 text-sm leading-7 text-neutral-700">Bring a real situation and examine it carefully, without reducing yourself to a label or diagnosis.</p>
            </article>
            <article className="bg-[#eae7e1] p-7 sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">03</p>
              <h3 className="mt-8 text-2xl font-semibold tracking-tight">Make room for aliveness</h3>
              <p className="mt-4 text-sm leading-7 text-neutral-700">Notice what becomes available when the old rules about who you must be are open to question.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="map" className="border-y border-black/10 bg-[#f4f2ee]">
        <div className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-24 lg:px-14">
          <div className="mb-10 grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">The architecture</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">J-BOT: A Map for Aliveness.</h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-neutral-600">The map behind Jbot: its posture, conversational method, language model and approach to assessing progress. Explore the structure that informs the conversation.</p>
          </div>
          <a href="/J-BOT_%20A%20Map%20for%20Aliveness.png" target="_blank" rel="noreferrer" aria-label="Open the full J-BOT Map for Aliveness in a new tab" className="group block border border-black/10 bg-white p-2 transition hover:border-black/30 sm:p-4">
            <Image src="/J-BOT_%20A%20Map%20for%20Aliveness.png" alt="J-BOT: A Map for Aliveness — overview of the purpose, posture, eight-step conversational method, language model, assessment engine and resource system." width={1536} height={2048} className="h-auto w-full object-contain" sizes="(max-width: 1280px) 100vw, 1280px" />
            <span className="flex items-center justify-between gap-4 px-3 py-4 text-sm font-medium text-neutral-600 transition group-hover:text-black sm:px-4">
              <span>Open full-size map</span><span aria-hidden="true">↗</span>
            </span>
          </a>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-7xl px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Access Jbot</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Begin where you are.</h2>
          <p className="mt-5 text-base leading-7 text-neutral-600">Choose the access option that fits you. You can return to your conversations and journey from your personal dashboard.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <div className="border border-black/10 bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Monthly access</p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">Jbot subscription</h3>
            <p className="mt-3 text-sm leading-6 text-neutral-600">Ongoing access to Jbot, billed monthly.</p>
            <div className="mt-8 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight">A$500</span>
              <span className="text-sm text-neutral-500">per month</span>
            </div>
            <div className="mt-8"><StripePricingTable /></div>
          </div>
          <div className="flex flex-col border border-black/10 bg-[#111111] p-6 text-white sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Limited beta offer</p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">Jbot six-month unhindered experience</h3>
            <p className="mt-3 text-sm leading-6 text-white/70">A one-time payment for six months of access as part of the beta test.</p>
            <div className="mt-8 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight">A$995</span>
              <span className="text-sm text-white/55">once · six months</span>
            </div>
            <p className="mt-4 text-xs leading-5 text-white/50">Beta access is offered through a private checkout link.</p>
            <a href="https://buy.stripe.com/cNi14n8aW8ML00c1r72oE0v" className="mt-auto inline-flex h-12 items-center justify-center bg-white px-6 text-sm font-semibold text-black transition hover:bg-neutral-200">Get beta access <span aria-hidden="true" className="ml-3">↗</span></a>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/10 bg-[#111111] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-14">
          <div>
            <p className="text-lg font-semibold tracking-tight">Jbot<span className="text-white/45">.</span></p>
            <p className="mt-1 text-xs text-white/55">By Jaemin Frazer · The Insecurity Project</p>
          </div>
          <div className="flex gap-5 text-sm text-white/65">
            <Link href="/login" className="hover:text-white">Sign in</Link>
            <Link href="/signup" className="hover:text-white">Create an account</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
