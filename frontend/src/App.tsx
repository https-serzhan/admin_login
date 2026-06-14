import type { AuthResponse, AuthResponseUser } from './types'
import {useState} from "react";
import AuthPage from './components/AuthPage'
import AdminPage from './components/AdminPage'

function App() {
    const [user, setUser] = useState<AuthResponseUser | null>(() => {
        const savedUser = localStorage.getItem('user')

        if (!savedUser) {
            return null
        }

        try {
            return JSON.parse(savedUser) as AuthResponseUser
        } catch {
            localStorage.removeItem('user')
            localStorage.removeItem('token')
            return null
        }
    })
    const [verificationLink, setVerificationLink] = useState<string | null>(() => {
        return localStorage.getItem('verificationLink')
    })
    function handleAuthSuccess(response: AuthResponse) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        if (response.verificationLink) {
            localStorage.setItem('verificationLink', response.verificationLink)
            setVerificationLink(response.verificationLink)
        } else if (response.user.status === 'active') {
            localStorage.removeItem('verificationLink')
            setVerificationLink(null)
        }
        setUser(response.user);
    }
    function handleLogout() {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('verificationLink')
        setVerificationLink(null)
        setUser(null)
    }
  return (
      <div className="min-h-screen bg-slate-100 text-slate-950">
          {!user && <AuthPage onAuthSuccess = {handleAuthSuccess} />}
          {user && <AdminPage user={user} verificationLink={verificationLink} onLogout={handleLogout} />}
      </div>
  )
}

export default App
