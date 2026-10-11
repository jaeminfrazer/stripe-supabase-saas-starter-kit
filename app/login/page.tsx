import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from 'next/link'
import Image from 'next/image'
import ProviderSigninBlock from '@/components/ProviderSigninBlock'
import LoginForm from "@/components/LoginForm"

export default function Login() {
    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f2ee] px-4 py-12 text-[#111111]">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#f4f2ee] to-[#e8e5df]" />
            <div className="relative z-10 grid w-full max-w-5xl overflow-hidden border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.10)] md:grid-cols-[1fr_420px]">
                <section className="hidden flex-col justify-between bg-[#111111] p-10 text-white md:flex lg:p-14">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/55">The Insecurity Project</p>
                        <h1 className="mt-20 max-w-lg text-5xl font-semibold leading-[1.05] tracking-[-0.04em] lg:text-6xl">Jbot<span className="text-white/45">.</span></h1>
                        <p className="mt-7 max-w-md text-lg leading-8 text-white/80">AI trained to understand the precise structure of personal insecurity and human aliveness.</p>
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/55">By Jaemin Frazer</p>
                </section>
                <Card className="w-full rounded-none border-0 bg-white shadow-none">
                    <CardHeader className="space-y-3 px-7 pt-10 sm:px-10">
                        <Link href="/" className="inline-flex w-fit items-center gap-3">
                            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center bg-[#111111] text-[11px] font-semibold tracking-[-0.04em] text-white">Jbot</span>
                            <span className="text-lg font-semibold tracking-[0.18em]">JBOT</span>
                        </Link>
                        <div className="pt-7">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Welcome back</p>
                            <CardTitle className="mt-3 text-3xl font-semibold tracking-tight">Sign in to Jbot</CardTitle>
                            <CardDescription className="mt-2 text-sm leading-6 text-neutral-600">Return to your conversation and continue where you left off.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-5 px-7 sm:px-10">
                        <LoginForm />
                        <div className="relative py-1">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-neutral-200" /></div>
                            <div className="relative flex justify-center text-xs uppercase tracking-widest"><span className="bg-white px-3 text-neutral-400">Or continue with</span></div>
                        </div>
                        <ProviderSigninBlock />
                    </CardContent>
                    <CardFooter className="flex-col gap-4 px-7 pb-10 text-center sm:px-10">
                        <Link className="text-sm text-neutral-500 transition hover:text-black" href="/forgot-password">Forgot password?</Link>
                        <p className="text-sm text-neutral-500">New to Jbot? <Link className="font-semibold text-black underline underline-offset-4" href="/signup">Create an account</Link></p>
                        <p className="pt-4 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">Jaemin Frazer · The Insecurity Project</p>
                    </CardFooter>
                </Card>
            </div>
        </main>
    )
}
