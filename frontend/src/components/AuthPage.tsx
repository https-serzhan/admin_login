import { useState } from 'react'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import type {AuthResponse} from "../types.ts";

type ModeType = 'login' | 'register'
type AuthPageProps = {
    onAuthSuccess: (response: AuthResponse) => void
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
    const [mode, setMode] = useState<ModeType>('login');

    return (
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_32%),linear-gradient(135deg,#f8fafc,#e2e8f0)] px-4 py-10">
            <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
                <div className="mb-6">
                    <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Admin access</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-950">Hello, potential Admin!</h2>
                    <p className="mt-2 text-sm text-slate-500">Sign in to manage users and account status.</p>
                </div>
                <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
                    <button className={`rounded-md px-4 py-2 text-sm font-medium transition ${mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`} onClick={() => setMode('login')}>Login</button>
                    <button className={`rounded-md px-4 py-2 text-sm font-medium transition ${mode === 'register' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`} onClick={() => setMode('register')}>Register</button>
                </div>
                {mode === 'register' && <RegisterForm onAuthSuccess={onAuthSuccess} />}
                {mode === 'login' && <LoginForm onAuthSuccess={onAuthSuccess} />}
            </section>
        </div>
    )
}
