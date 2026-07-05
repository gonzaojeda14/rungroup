import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Config por defecto del club — coincide EXACTAMENTE con los valores que estaban
// hardcodeados, para que wirear club_settings no cambie nada visible (fallback).
export const CLUB_SETTINGS_DEFAULT = {
  branding:     { nombre: 'Flama', accent: '#ff2d2d' },
  terminologia: { puntos_singular: 'Flamita', puntos_plural: 'Flamitas', estado_apoyo: 'Stand Flama' },
  puntos:       { inscripto: 2, stand_flama: 1, bonus_perfil: 5 },
  ventanas:     { plazo_reclamo_dias: 7 },
  locale:       { timezone: 'America/Argentina/Buenos_Aires' },
  modulos:      { carreras: true, tiempos: true, fotos: true, puntos: true, metas: true, cumpleanos: true, certificados: true, tienda: true, reventa: true, alianzas: true, clima: true },
}

// Mezcla los settings cargados por encima de los defaults, sección por sección.
function mergeClubSettings(loaded) {
  if (!loaded) return CLUB_SETTINGS_DEFAULT
  const out = {}
  for (const k of Object.keys(CLUB_SETTINGS_DEFAULT)) {
    out[k] = { ...CLUB_SETTINGS_DEFAULT[k], ...(loaded[k] || {}) }
  }
  return out
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clubSettings, setClubSettings] = useState(CLUB_SETTINGS_DEFAULT)
  const [clubId, setClubId] = useState(null)
  const [clubRole, setClubRole] = useState(null)

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
    if (data?.activo === false) {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setLoading(false)
      return
    }
    // Auto-acreditar bonus de perfil completo si califica y no está seteado aún
    if (data && !data.bonus_perfil_otorgado && data.certificado_url) {
      const { count } = await supabase
        .from('records_personales')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      if ((count || 0) > 0) {
        await supabase.from('profiles').update({ bonus_perfil_otorgado: true }).eq('id', userId)
        data.bonus_perfil_otorgado = true
      }
    }
    setProfile(data)
    await loadClubContext(userId)
    setLoading(false)
  }

  // Carga la membresía del usuario y los settings de su club (con fallback a defaults).
  async function loadClubContext(userId) {
    const { data: mem } = await supabase.from('club_members')
      .select('club_id, role').eq('user_id', userId).eq('estado', 'activo').limit(1).maybeSingle()
    if (!mem) { setClubId(null); setClubRole(null); setClubSettings(CLUB_SETTINGS_DEFAULT); return }
    setClubId(mem.club_id)
    setClubRole(mem.role)
    const { data: cs } = await supabase.from('club_settings')
      .select('*').eq('club_id', mem.club_id).maybeSingle()
    setClubSettings(mergeClubSettings(cs))
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const [vistaCorredor, setVistaCorredor] = useState(false)
  const isAdmin = !vistaCorredor && profile?.role === 'admin'
  const esRealmenteAdmin = profile?.role === 'admin'
  const esSuperAdmin = !!profile?.is_platform_admin

  async function marcarAvisosLeidos() {
    const ahora = new Date().toISOString()
    await supabase.from('profiles').update({ avisos_leido_hasta: ahora }).eq('id', profile?.id)
    setProfile(prev => ({ ...prev, avisos_leido_hasta: ahora }))
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, esRealmenteAdmin, esSuperAdmin, clubSettings, clubId, clubRole, vistaCorredor, setVistaCorredor, signIn, signOut, marcarAvisosLeidos, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
