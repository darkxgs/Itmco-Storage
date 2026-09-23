import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { type User } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { getSessionUser, signOut } from "@/lib/auth"

export function useAuth(requireAuth = true) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    getSessionUser().then((sessionUser) => {
      if (cancelled) return
      if (sessionUser) {
        setUser(sessionUser)
      } else if (requireAuth) {
        router.push("/login")
        return
      }
      setLoading(false)
    })

    // Session expired, or signed out in another tab
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null)
        if (requireAuth) router.push("/login")
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [router, requireAuth])

  const logout = async () => {
    await signOut()
    setUser(null)
    router.push("/login")
  }

  const updateUser = (newUser: User) => {
    setUser(newUser)
  }

  return {
    user,
    loading,
    logout,
    updateUser,
    isAuthenticated: !!user,
  }
}
