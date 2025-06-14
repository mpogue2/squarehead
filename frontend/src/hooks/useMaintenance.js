import { useMutation, useQueryClient } from '@tanstack/react-query'
import api, { apiService } from '../services/api'
import { useToast } from '../components/ToastProvider'

/**
 * Hook for clearing members list
 */
export const useClearMembers = () => {
  // Safe initialization of queryClient
  let queryClient = null;
  try {
    queryClient = useQueryClient();
  } catch (e) {
    console.error('Error initializing queryClient in useClearMembers:', e);
  }
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/maintenance/clear-members')
      return response
    },
    onSuccess: () => {
      // Invalidate members queries to refresh the UI if queryClient is available
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['members'] })
        queryClient.invalidateQueries({ queryKey: ['users'] })
        
        // Log successful completion for debugging
        console.log('Successfully cleared members, invalidated queries')
      } else {
        console.log('Successfully cleared members, but queryClient is not available for invalidation')
      }
    },
    onError: (error) => {
      console.error('Clear members failed:', error)
    }
  })
}

/**
 * Hook for clearing next schedule
 */
export const useClearNextSchedule = () => {
  // Safe initialization of queryClient
  let queryClient = null;
  try {
    queryClient = useQueryClient();
  } catch (e) {
    console.error('Error initializing queryClient in useClearNextSchedule:', e);
  }
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/maintenance/clear-next-schedule')
      return response
    },
    onSuccess: () => {
      // Invalidate schedule queries to refresh the UI if queryClient is available
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['schedules'] })
        queryClient.invalidateQueries({ queryKey: ['schedules', 'next'] })
      }
    },
    onError: (error) => {
      console.error('Clear next schedule failed:', error)
    }
  })
}

/**
 * Hook for clearing current schedule
 */
export const useClearCurrentSchedule = () => {
  // Safe initialization of queryClient
  let queryClient = null;
  try {
    queryClient = useQueryClient();
  } catch (e) {
    console.error('Error initializing queryClient in useClearCurrentSchedule:', e);
  }
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/maintenance/clear-current-schedule')
      return response
    },
    onSuccess: () => {
      // Invalidate schedule queries to refresh the UI if queryClient is available
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['schedules'] })
        queryClient.invalidateQueries({ queryKey: ['schedules', 'current'] })
      }
    },
    onError: (error) => {
      console.error('Clear current schedule failed:', error)
    }
  })
}

/**
 * Hook for clearing import logs
 */
export const useClearImportLogs = () => {
  // Safe initialization of queryClient
  let queryClient = null;
  try {
    queryClient = useQueryClient();
  } catch (e) {
    console.error('Error initializing queryClient in useClearImportLogs:', e);
  }
  
  const { success, error: showError } = useToast()
  
  return useMutation({
    mutationFn: async () => {
      return await apiService.clearMaintenanceImportLogs()
    },
    onSuccess: (response) => {
      // Show success message
      success('Import logs cleared successfully')
      
      // Return the response so it can be used by the component
      return response
    },
    onError: (error) => {
      console.error('Failed to clear import logs:', error)
      showError('Failed to clear import logs. Please try again.')
    }
  })
}
