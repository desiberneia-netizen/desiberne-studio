import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = carregando, null = sem sessao

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = sb.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  async function login(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function logout() {
    await sb.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
