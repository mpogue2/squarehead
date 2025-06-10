import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

/**
 * Hook for clearing members list
 */
export const useClearMembers = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/maintenance/clear-members')
      return response
    },
    onSuccess: () => {
      // Invalidate members queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      
      // Log successful completion for debugging
      console.log('Successfully cleared members, invalidated queries')
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
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/maintenance/clear-next-schedule')
      return response
    },
    onSuccess: () => {
      // Invalidate schedule queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedule', 'next'] })
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
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const response = await api.post('/maintenance/clear-current-schedule')
      return response
    },
    onSuccess: () => {
      // Invalidate schedule queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedule', 'current'] })
    },
    onError: (error) => {
      console.error('Clear current schedule failed:', error)
    }
  })
}
