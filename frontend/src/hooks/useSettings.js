import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiService } from '../services/api'
import useSettingsStore from '../store/settingsStore'
import { useToast } from '../components/ToastProvider'

// Hook for fetching all settings
export const useSettings = () => {
  const setSettings = useSettingsStore((state) => state.setSettings)
  
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await apiService.getSettings()
      const settings = response.data || response
      setSettings(settings)
      return settings
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      console.error('Failed to fetch settings:', error)
    }
  })
}

// Hook for updating settings
export const useUpdateSettings = () => {
  const queryClient = useQueryClient()
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const markClean = useSettingsStore((state) => state.markClean)
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: apiService.updateSettings,
    onSuccess: (data) => {
      const settings = data.data || data
      updateSettings(settings)
      markClean()
      queryClient.invalidateQueries(['settings'])
      success('Settings updated successfully!')
    },
    onError: (err) => {
      console.error('Failed to update settings:', err)
      error('Failed to update settings. Please try again.')
    }
  })
}

// Hook for updating a single setting
export const useUpdateSetting = () => {
  const queryClient = useQueryClient()
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: ({ key, value }) => apiService.updateSetting(key, value),
    onSuccess: (data, variables) => {
      updateSetting(variables.key, variables.value)
      queryClient.invalidateQueries(['settings'])
      success(`${variables.key} updated successfully!`)
    },
    onError: (err) => {
      console.error('Failed to update setting:', err)
      error('Failed to update setting. Please try again.')
    }
  })
}

// Hook for club theme settings
export const useClubTheme = () => {
  const {
    getClubName,
    getClubSubtitle,
    getClubColor,
    getThemeSettings
  } = useSettingsStore()
  
  return {
    clubName: getClubName(),
    clubSubtitle: getClubSubtitle(),
    clubColor: getClubColor(),
    themeSettings: getThemeSettings()
  }
}

// Hook for club configuration
export const useClubConfig = () => {
  const {
    getClubAddress,
    getClubDayOfWeek,
    getReminderDays,
    getSetting
  } = useSettingsStore()
  
  return {
    clubAddress: getClubAddress(),
    clubDayOfWeek: getClubDayOfWeek(),
    reminderDays: getReminderDays(),
    clubLogo: getSetting('club_logo'),
    timezone: getSetting('timezone', 'America/Los_Angeles')
  }
}

// Hook for email settings
export const useEmailSettings = () => {
  const { getEmailSettings } = useSettingsStore()
  
  return {
    emailSettings: getEmailSettings()
  }
}

// Hook for settings form management
export const useSettingsForm = () => {
  const { 
    settings, 
    isDirty, 
    updateSetting, 
    updateSettings, 
    markClean 
  } = useSettingsStore()
  
  const setValue = (key, value) => {
    updateSetting(key, value)
  }
  
  const setValues = (values) => {
    updateSettings(values)
  }
  
  const resetForm = () => {
    markClean()
  }
  
  return {
    settings,
    isDirty,
    setValue,
    setValues,
    resetForm
  }
}

// Hook for testing email configuration
export const useTestEmail = () => {
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: (emailData) => apiService.testEmail(emailData),
    onSuccess: () => {
      success('Test email sent successfully!')
    },
    onError: (err) => {
      console.error('Failed to send test email:', err)
      error('Failed to send test email. Please check your settings.')
    }
  })
}
