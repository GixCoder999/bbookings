import { useEffect, useMemo, useState } from 'react'
import { hasSupabaseEnv, supabase } from '../utils/supabaseClient'
import { getCurrentSessionUser, loginUser, logoutUser, signupUser } from '../utils/api'
import { AuthContext } from './authContextObject.js'

function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      setCurrentUser(null)
      setLoading(false)
      return undefined
    }

    let ignore = false

    async function syncCurrentUser() {
      try {
        const user = await getCurrentSessionUser()
        if (!ignore) {
          setCurrentUser(user)
        }
      } catch (error) {
        console.error('Failed to sync current user:', error)
        if (!ignore) {
          setCurrentUser(null)
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    void syncCurrentUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncCurrentUser()
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: Boolean(currentUser),
      loading,
      async login(credentials) {
        const user = await loginUser(credentials)
        setCurrentUser(user)
        return user
      },
      async signup(input) {
        const user = await signupUser(input)
        setCurrentUser(user)
        return user
      },
      async logout() {
        await logoutUser()
        setCurrentUser(null)
      },
      hasSupabaseEnv,
    }),
    [currentUser, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
