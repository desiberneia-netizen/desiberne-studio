import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = carregando, null = sem sessao
  const [papel, setPapel] = useState(undefined) // undefined = carregando, null = sem papel definido

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = sb.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setPapel(session === null ? null : undefined)
      return
    }
    async function resolvePapel() {
      const { data: porAuthId } = await sb.from('sh_usuarios').select('papel').eq('auth_id', session.user.id).maybeSingle()
      if (porAuthId) {
        setPapel(porAuthId.papel)
        return
      }
      // primeiro login com esse e-mail: linka a um papel pre-cadastrado, se existir
      const { data: porEmail } = await sb
        .from('sh_usuarios')
        .select('id, papel')
        .eq('email', session.user.email)
        .is('auth_id', null)
        .maybeSingle()
      if (porEmail) {
        await sb.from('sh_usuarios').update({ auth_id: session.user.id }).eq('id', porEmail.id)
        setPapel(porEmail.papel)
      } else {
        setPapel(null)
      }
    }
    resolvePapel()
  }, [session])

  async function login(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function logout() {
    await sb.auth.signOut()
  }

  const isAdmin = papel === 'sh_admin'
  const isAdminOuGestor = papel === 'sh_admin' || papel === 'sh_gestor'

  return (
    <AuthContext.Provider value={{ session, papel, isAdmin, isAdminOuGestor, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
