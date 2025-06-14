import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { apiService } from '../services/api'
import useSchedulesStore from '../store/schedulesStore'
import useUIStore from '../store/uiStore'
import { useToast } from '../components/ToastProvider'

// Hook for fetching current schedule
export const useCurrentSchedule = () => {
  const setCurrentSchedule = useSchedulesStore((state) => state.setCurrentSchedule)
  const setAssignments = useSchedulesStore((state) => state.setAssignments)
  const setLoading = useUIStore((state) => state.setLoading)
  
  return useQuery({
    queryKey: ['schedules', 'current'],
    queryFn: async () => {
      setLoading('schedules', true)
      try {
        const response = await apiService.getCurrentSchedule()
        const data = response.data || response
        
        if (data.schedule) {
          setCurrentSchedule(data.schedule)
        }
        if (data.assignments) {
          setAssignments(data.assignments)
        }
        
        return data
      } finally {
        setLoading('schedules', false)
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      console.error('Failed to fetch current schedule:', error)
    }
  })
}

// Hook for fetching next schedule
export const useNextSchedule = () => {
  const setNextSchedule = useSchedulesStore((state) => state.setNextSchedule)
  const setAssignments = useSchedulesStore((state) => state.setAssignments)
  
  return useQuery({
    queryKey: ['schedules', 'next'],
    queryFn: async () => {
      const response = await apiService.getNextSchedule()
      const data = response.data || response
      
      if (data.schedule) {
        setNextSchedule(data.schedule)
      } else {
        setNextSchedule(null)
      }
      if (data.assignments) {
        setAssignments(data.assignments)
      } else {
        setAssignments([])
      }
      
      return data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    onError: (error) => {
      console.error('Failed to fetch next schedule:', error)
    }
  })
}

// Hook for creating a new next schedule
export const useCreateNextSchedule = () => {
  // Safe initialization of queryClient
  let queryClient = null;
  try {
    queryClient = useQueryClient();
  } catch (e) {
    console.error('Error initializing queryClient in useCreateNextSchedule:', e);
  }
  
  const setNextSchedule = useSchedulesStore((state) => state.setNextSchedule)
  const setAssignments = useSchedulesStore((state) => state.setAssignments)
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: apiService.createNextSchedule,
    onSuccess: (data) => {
      const response = data.data || data
      
      if (response.schedule) {
        setNextSchedule(response.schedule)
      }
      if (response.assignments) {
        setAssignments(response.assignments)
      }
      
      if (queryClient) {
        queryClient.invalidateQueries(['schedules', 'next'])
      }
      success(`Schedule created with ${response.count || 0} assignments!`)
    },
    onError: (err) => {
      console.error('Failed to create schedule:', err)
      error('Failed to create schedule. Please try again.')
    }
  })
}

// Hook for adding dates to existing next schedule
export const useAddDatesToSchedule = () => {
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  
  return useMutation({
    mutationFn: async (scheduleData) => {
      const response = await api.post('/schedules/next/add-dates', scheduleData)
      return response
    },
    onSuccess: (response) => {
      const data = response.data || response
      const addedCount = data.added_count || 0
      success(`Added ${addedCount} new dates to schedule successfully`)
      
      // Invalidate and refetch schedule queries
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedules', 'next'] })
    },
    onError: (error) => {
      console.error('Failed to add dates to schedule:', error)
      showError(error.response?.data?.message || 'Failed to add dates to schedule')
    }
  })
}

// Hook for updating an assignment
export const useUpdateAssignment = () => {
  // Safe initialization of queryClient
  let queryClient = null;
  try {
    queryClient = useQueryClient();
  } catch (e) {
    console.error('Error initializing queryClient in useUpdateAssignment:', e);
  }
  
  const updateAssignment = useSchedulesStore((state) => state.updateAssignment)
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: ({ id, ...updates }) => apiService.updateAssignment(id, updates),
    onSuccess: (data, variables) => {
      const assignment = data.data || data
      updateAssignment(variables.id, assignment)
      if (queryClient) {
        queryClient.invalidateQueries(['schedules'])
      }
      success('Assignment updated successfully!')
    },
    onError: (err) => {
      console.error('Failed to update assignment:', err)
      error('Failed to update assignment. Please try again.')
    }
  })
}

// Hook for deleting an assignment
export const useDeleteAssignment = () => {
  const queryClient = useQueryClient()
  const { success, error: showError } = useToast()
  
  return useMutation({
    mutationFn: async (assignmentId) => {
      const response = await api.delete(`/schedules/assignments/${assignmentId}`)
      return response
    },
    onSuccess: () => {
      success('Assignment deleted successfully')
      
      // Invalidate and refetch schedule queries
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['schedules', 'next'] })
    },
    onError: (error) => {
      console.error('Failed to delete assignment:', error)
      showError(error.response?.data?.message || 'Failed to delete assignment')
    }
  })
}

// Hook for promoting next schedule to current
export const usePromoteSchedule = () => {
  // Safe initialization of queryClient
  let queryClient = null;
  try {
    queryClient = useQueryClient();
  } catch (e) {
    console.error('Error initializing queryClient in usePromoteSchedule:', e);
  }
  
  const setCurrentSchedule = useSchedulesStore((state) => state.setCurrentSchedule)
  const setNextSchedule = useSchedulesStore((state) => state.setNextSchedule)
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: apiService.promoteSchedule,
    onSuccess: (data) => {
      const response = data.data || data
      
      if (response.schedule) {
        setCurrentSchedule(response.schedule)
        setNextSchedule(null) // Clear next schedule after promotion
      }
      
      if (queryClient) {
        queryClient.invalidateQueries(['schedules'])
      }
      success('Schedule promoted to current successfully!')
    },
    onError: (err) => {
      console.error('Failed to promote schedule:', err)
      error('Failed to promote schedule. Please try again.')
    }
  })
}

// Hook for assignment management
export const useAssignmentManagement = () => {
  const {
    selectedAssignment,
    editingAssignment,
    selectAssignment,
    startEditingAssignment,
    updateEditingAssignment,
    cancelEditingAssignment,
    clearSelection,
    getCurrentAssignments,
    getNextAssignments,
    getUpcomingAssignments
  } = useSchedulesStore()
  
  return {
    selectedAssignment,
    editingAssignment,
    selectAssignment,
    startEditingAssignment,
    updateEditingAssignment,
    cancelEditingAssignment,
    clearSelection,
    currentAssignments: getCurrentAssignments(),
    nextAssignments: getNextAssignments(),
    upcomingAssignments: getUpcomingAssignments()
  }
}

// Hook for assignment filtering and search
export const useAssignmentFilters = () => {
  const { getAssignmentsByMember, getAssignmentsByDateRange } = useSchedulesStore()
  
  const getAssignmentsForMember = (memberId) => {
    return getAssignmentsByMember(memberId)
  }
  
  const getAssignmentsInRange = (startDate, endDate) => {
    return getAssignmentsByDateRange(startDate, endDate)
  }
  
  return {
    getAssignmentsForMember,
    getAssignmentsInRange
  }
}

// Hook for schedule statistics
export const useScheduleStats = () => {
  const { assignments } = useSchedulesStore()
  
  const getAssignmentCount = () => assignments.length
  
  const getMemberAssignmentCounts = () => {
    const counts = {}
    
    assignments.forEach(assignment => {
      if (assignment.squarehead1_id) {
        counts[assignment.squarehead1_id] = (counts[assignment.squarehead1_id] || 0) + 1
      }
      if (assignment.squarehead2_id) {
        counts[assignment.squarehead2_id] = (counts[assignment.squarehead2_id] || 0) + 1
      }
    })
    
    return counts
  }
  
  const getUnassignedDates = () => {
    return assignments.filter(assignment => 
      !assignment.squarehead1_id || !assignment.squarehead2_id
    )
  }
  
  const getFullyAssignedDates = () => {
    return assignments.filter(assignment => 
      assignment.squarehead1_id && assignment.squarehead2_id
    )
  }
  
  return {
    assignmentCount: getAssignmentCount(),
    memberAssignmentCounts: getMemberAssignmentCounts(),
    unassignedDates: getUnassignedDates(),
    fullyAssignedDates: getFullyAssignedDates()
  }
}
