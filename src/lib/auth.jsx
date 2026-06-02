import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const INACTIVITY_DAYS = 30
  const LAST_ACTIVE_KEY = 'flama_last_active'

  function updateLastActive() {
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString())
  }

  function isInactive() {
    const last = localStorage.getItem(LAST_ACTIVE_KEY)
    if (!last) return false
    const days = (Date.now() - parseInt(last)) / (1000 * 60 * 60 * 24)
    return days > INACTIVITY_DAYS
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && isInactive()) {
        localStorage.removeItem(LAST_ACTIVE_KEY)
        await supabase.auth.signOut()
        setLoading(false)
        return
      }
      setUser(session?.user ?? null)
      if (session?.user) { updateLastActive(); fetchProfile(session.user.id) }
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { updateLastActive(); fetchProfile(session.user.id) }
      else { setProfile(null); setLoading(false) }
    })

    // Actualizar timestamp cada vez que el usuario interactúa
    const handleActivity = () => updateLastActive()
    window.addEventListener('pointerdown', handleActivity)
    window.addEventListener('keydown', handleActivity)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'

  async function marcarAvisosLeidos() {
    const ahora = new Date().toISOString()
    await supabase.from('profiles').update({ avisos_leido_hasta: ahora }).eq('id', profile?.id)
    setProfile(prev => ({ ...prev, avisos_leido_hasta: ahora }))
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signOut, marcarAvisosLeidos }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
