import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useUIStore = create(
  persist(
    (set, get) => ({
      // State
      sidebarOpen: false,
      theme: 'light',
      loading: {
        global: false,
        members: false,
        schedules: false,
        settings: false
      },
      errors: [],
      notifications: [],
      modals: {
        editMember: false,
        deleteMember: false,
        editAssignment: false,
        createSchedule: false,
        importMembers: false,
        exportData: false
      },
      
      // Actions
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      
      toggleSidebar: () => set((state) => ({ 
        sidebarOpen: !state.sidebarOpen 
      })),
      
      setTheme: (theme) => set({ theme }),
      
      setLoading: (key, isLoading) => set((state) => ({
        loading: { ...state.loading, [key]: isLoading }
      })),
      
      setGlobalLoading: (isLoading) => set((state) => ({
        loading: { ...state.loading, global: isLoading }
      })),
      
      addError: (error) => set((state) => ({
        errors: [...state.errors, {
          id: Date.now() + Math.random(),
          message: error.message || error,
          timestamp: new Date(),
          type: 'error'
        }]
      })),
      
      removeError: (id) => set((state) => ({
        errors: state.errors.filter(error => error.id !== id)
      })),
      
      clearErrors: () => set({ errors: [] }),
      
      addNotification: (notification) => set((state) => ({
        notifications: [...state.notifications, {
          id: Date.now() + Math.random(),
          ...notification,
          timestamp: new Date()
        }]
      })),
      
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(notif => notif.id !== id)
      })),
      
      clearNotifications: () => set({ notifications: [] }),
      
      openModal: (modalName) => set((state) => ({
        modals: { ...state.modals, [modalName]: true }
      })),
      
      closeModal: (modalName) => set((state) => ({
        modals: { ...state.modals, [modalName]: false }
      })),
      
      closeAllModals: () => set((state) => ({
        modals: Object.keys(state.modals).reduce((acc, key) => {
          acc[key] = false
          return acc
        }, {})
      })),
      
      // Getters
      isLoading: (key) => {
        const { loading } = get()
        return loading[key] || loading.global
      },
      
      hasErrors: () => {
        const { errors } = get()
        return errors.length > 0
      },
      
      getRecentErrors: (limit = 5) => {
        const { errors } = get()
        return errors
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit)
      },
      
      isModalOpen: (modalName) => {
        const { modals } = get()
        return modals[modalName] || false
      },
      
      getActiveModals: () => {
        const { modals } = get()
        return Object.entries(modals)
          .filter(([_, isOpen]) => isOpen)
          .map(([name, _]) => name)
      }
    }),
    {
      name: 'ui-storage',
      getStorage: () => localStorage,
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen
      })
    }
  )
)

export default useUIStore
