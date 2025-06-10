import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      isAuthenticated: false,
      user: null,
      token: null,
      _hasHydrated: false,
      
      // Actions
      login: (token, user) => {
        set({
          isAuthenticated: true,
          user,
          token,
        })
      },
      
      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
        })
      },
      
      updateUser: (userData) => {
        set((state) => ({
          user: { ...state.user, ...userData }
        }))
      },
      
      // Getters
      getToken: () => get().token,
      getUser: () => get().user,
      isAdmin: () => get().user?.is_admin || false,
      
      // Check if token is expired (basic check)
      isTokenValid: () => {
        const token = get().token
        
        // DEVELOPMENT BYPASS DISABLED FOR SECURITY
        // Uncomment for development convenience (allows any token on localhost):
        /*
        if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && token) {
          return true
        }
        */
        
        if (!token) return false
        
        try {
          // Decode JWT payload (basic check without verification)
          const payload = JSON.parse(atob(token.split('.')[1]))
          const now = Math.floor(Date.now() / 1000)
          return payload.exp > now
        } catch (error) {
          return false
        }
      },
      
      // Initialize auth state
      initialize: () => {
        const state = get()
        console.log('Auth store initialize called, current state:', {
          isAuthenticated: state.isAuthenticated,
          hasUser: !!state.user,
          hasToken: !!state.token,
          _hasHydrated: state._hasHydrated
        })
        
        // DEVELOPMENT AUTO-LOGIN ENABLED FOR TESTING
        // Comment this block out when done testing
        if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && 
            (!state.isAuthenticated || !state.user || !state.token)) {
          console.log('Development mode: Auto-logging in as admin')
          set({
            isAuthenticated: true,
            user: {
              id: 1,
              email: "mpogue@zenstarstudio.com",
              first_name: "Mike",
              last_name: "Pogue",
              role: "admin",
              is_admin: true
            },
            token: "dev-token-valid"
          })
          return
        }
        
        if (state.token && !state.isTokenValid()) {
          console.log('Token expired, logging out')
          state.logout()
        } else if (state.token && state.user) {
          console.log('Valid auth state found')
          // Ensure isAuthenticated is true if we have valid token and user
          if (!state.isAuthenticated) {
            set({ isAuthenticated: true })
          }
        }
      },
      
      // Mark as hydrated
      setHasHydrated: (hasHydrated) => {
        set({ _hasHydrated: hasHydrated })
      }
    }),
    {
      name: 'auth-storage',
      getStorage: () => localStorage,
      onRehydrateStorage: () => (state) => {
        console.log('Auth store rehydrated from localStorage:', state)
        state?.setHasHydrated(true)
      }
    }
  )
)

export default useAuthStore
