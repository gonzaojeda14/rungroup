import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [avisosNuevos, setAvisosNuevos] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
    fetchAvisosNuevos(data?.avisos_leido_hasta)
  }

  async function fetchAvisosNuevos(leidoHasta) {
    let query = supabase.from('avisos').select('id', { count: 'exact', head: true })
    if (leidoHasta) query = query.gt('created_at', leidoHasta)
    const { count } = await query
    setAvisosNuevos(count || 0)
  }

  async function marcarAvisosLeidos() {
    if (!user) return
    const ahora = new Date().toISOString()
    await supabase.from('profiles').update({ avisos_leido_hasta: ahora }).eq('id', user.id)
    setAvisosNuevos(0)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signOut, avisosNuevos, marcarAvisosLeidos }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
