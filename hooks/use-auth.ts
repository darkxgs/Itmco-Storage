import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { loadUserFromStorage, clearUserFromStorage, type User } from "@/lib/utils"

export function useAuth(requireAuth = true) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const loadUser = () => {
      const userData = loadUserFromStorage()
      
      if (userData) {
        setUser(userData)
      } else if (requireAuth) {
        router.push("/login")
        return
      }
      
      setLoading(false)
    }

    loadUser()
  }, [router, requireAuth])

  const logout = () => {
    clearUserFromStorage()
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