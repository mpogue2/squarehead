import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useSettingsStore = create(
  persist(
    (set, get) => ({
      // State
      settings: {},
      isDirty: false,
      lastUpdated: null,
      
      // Actions
      setSettings: (settings) => set({ 
        settings,
        lastUpdated: new Date().toISOString()
      }),
      
      updateSetting: (key, value) => set((state) => ({
        settings: { ...state.settings, [key]: value },
        isDirty: true,
        lastUpdated: new Date().toISOString()
      })),
      
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates },
        isDirty: true,
        lastUpdated: new Date().toISOString()
      })),
      
      markClean: () => set({ isDirty: false }),
      
      resetSettings: () => set({
        settings: {},
        isDirty: false,
        lastUpdated: null
      }),
      
      // Getters
      getSetting: (key, defaultValue = null) => {
        const { settings } = get()
        return settings[key] ?? defaultValue
      },
      
      getClubName: () => {
        const { settings } = get()
        return settings.club_name || 'Square Dance Club'
      },
      
      getClubSubtitle: () => {
        const { settings } = get()
        return settings.club_subtitle || 'Dance Management System'
      },
      
      getClubColor: () => {
        const { settings } = get()
        return settings.club_color || '#0d6efd'
      },
      
      getClubAddress: () => {
        const { settings } = get()
        return settings.club_address || ''
      },
      
      getClubDayOfWeek: () => {
        const { settings } = get()
        return settings.club_day_of_week || 'Wednesday'
      },
      
      getReminderDays: () => {
        const { settings } = get()
        const reminderDays = settings.reminder_days || '14,7,3,1'
        return reminderDays.split(',').map(day => parseInt(day.trim())).filter(day => !isNaN(day))
      },
      
      getEmailSettings: () => {
        const { settings } = get()
        return {
          smtp_host: settings.smtp_host || '',
          smtp_port: settings.smtp_port || 587,
          smtp_username: settings.smtp_username || '',
          smtp_password: settings.smtp_password || '',
          smtp_encryption: settings.smtp_encryption || 'tls',
          from_email: settings.from_email || '',
          from_name: settings.from_name || get().getClubName()
        }
      },
      
      getThemeSettings: () => {
        const { settings } = get()
        return {
          club_name: get().getClubName(),
          club_subtitle: get().getClubSubtitle(),
          club_color: get().getClubColor(),
          club_logo: settings.club_logo || null
        }
      }
    }),
    {
      name: 'settings-storage',
      getStorage: () => localStorage,
      partialize: (state) => ({
        settings: state.settings,
        lastUpdated: state.lastUpdated
      })
    }
  )
)

export default useSettingsStore
