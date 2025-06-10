import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { apiService } from '../services/api'
import useMembersStore from '../store/membersStore'
import useUIStore from '../store/uiStore'
import { useToast } from '../components/ToastProvider'

// Hook for fetching all members
export const useMembers = () => {
  const setMembers = useMembersStore((state) => state.setMembers)
  const setLoading = useUIStore((state) => state.setLoading)
  
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      setLoading('members', true)
      try {
        console.log('useMembers: Making API call to getUsers()')
        const response = await apiService.getUsers()
        console.log('useMembers: Raw API response:', response)
        
        // The API returns: { status: 'success', data: { users: [], count: N }, message: '...' }
        // We need to extract the users array from response.data.users
        let members
        if (response.data && Array.isArray(response.data.users)) {
          members = response.data.users
        } else if (Array.isArray(response.data)) {
          members = response.data
        } else if (Array.isArray(response)) {
          members = response
        } else {
          console.warn('useMembers: Unexpected API response format, using empty array')
          members = []
        }
        
        console.log('useMembers: Processed members data:', members)
        console.log('useMembers: Members array length:', Array.isArray(members) ? members.length : 'Not an array')
        
        setMembers(members)
        return members
      } catch (error) {
        console.error('useMembers: API call failed:', error)
        throw error
      } finally {
        setLoading('members', false)
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    onError: (error) => {
      console.error('Failed to fetch members:', error)
    }
  })
}

// Hook for fetching assignable members only
export const useAssignableMembers = () => {
  return useQuery({
    queryKey: ['members', 'assignable'],
    queryFn: apiService.getAssignableUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Hook for creating a new member
export const useCreateMember = () => {
  const queryClient = useQueryClient()
  const addMember = useMembersStore((state) => state.addMember)
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: apiService.createUser,
    onSuccess: (data) => {
      const member = data.data || data
      addMember(member)
      queryClient.invalidateQueries(['members'])
      success('Member created successfully!')
    },
    onError: (err) => {
      console.error('Failed to create member:', err)
      error('Failed to create member. Please try again.')
    }
  })
}

// Hook for updating a member
export const useUpdateMember = () => {
  const queryClient = useQueryClient()
  const updateMember = useMembersStore((state) => state.updateMember)
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: ({ id, ...updates }) => apiService.updateUser(id, updates),
    onSuccess: (data, variables) => {
      const member = data.data || data
      updateMember(variables.id, member)
      queryClient.invalidateQueries(['members'])
      success('Member updated successfully!')
    },
    onError: (err) => {
      console.error('Failed to update member:', err)
      error('Failed to update member. Please try again.')
    }
  })
}

// Hook for deleting a member
export const useDeleteMember = () => {
  const queryClient = useQueryClient()
  const removeMember = useMembersStore((state) => state.removeMember)
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: apiService.deleteUser,
    onSuccess: (_, memberId) => {
      removeMember(memberId)
      queryClient.invalidateQueries(['members'])
      success('Member deleted successfully!')
    },
    onError: (err) => {
      console.error('Failed to delete member:', err)
      error('Failed to delete member. Please try again.')
    }
  })
}

// Hook for member search and filtering with memoization
export const useMemberFilters = () => {
  const filters = useMembersStore((state) => state.filters)
  const members = useMembersStore((state) => state.members)
  const setFilters = useMembersStore((state) => state.setFilters)
  const clearFilters = useMembersStore((state) => state.clearFilters)
  const getFilteredMembers = useMembersStore((state) => state.getFilteredMembers)
  
  // Memoize the filtered members based on members and filters
  const filteredMembers = useMemo(() => {
    return getFilteredMembers()
  }, [getFilteredMembers, members, filters])
  
  const setSearch = useMemo(() => (search) => setFilters({ search }), [setFilters])
  const setStatusFilter = useMemo(() => (status) => setFilters({ status }), [setFilters])
  const setRoleFilter = useMemo(() => (role) => setFilters({ role }), [setFilters])
  
  return {
    filters,
    setSearch,
    setStatusFilter,
    setRoleFilter,
    setFilters,
    clearFilters,
    filteredMembers
  }
}

// Hook for member sorting
export const useMemberSorting = () => {
  const sortBy = useMembersStore((state) => state.sortBy)
  const setSortBy = useMembersStore((state) => state.setSortBy)
  
  const toggleSort = useMemo(() => (field) => {
    const currentSortBy = useMembersStore.getState().sortBy
    const direction = currentSortBy.field === field && currentSortBy.direction === 'asc' ? 'desc' : 'asc'
    setSortBy(field, direction)
  }, [setSortBy])
  
  return {
    sortBy,
    setSortBy,
    toggleSort
  }
}

// Hook for member selection
export const useMemberSelection = () => {
  const selectedMember = useMembersStore((state) => state.selectedMember)
  const selectMember = useMembersStore((state) => state.selectMember)
  const clearSelection = useMembersStore((state) => state.clearSelection)
  const getMemberById = useMembersStore((state) => state.getMemberById)
  
  return {
    selectedMember,
    selectMember,
    clearSelection,
    getMemberById
  }
}

// Hook for CSV import/export
export const useMemberImportExport = ({ onImportResults } = {}) => {
  const { success, error } = useToast()
  const queryClient = useQueryClient()
  
  const exportCSV = useMutation({
    mutationFn: () => apiService.exportMembersCSV(),
    onSuccess: (data) => {
      // Create download link
      const blob = new Blob([data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `members-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
      success('Members exported successfully!')
    },
    onError: (err) => {
      console.error('Failed to export members:', err)
      error('Failed to export members. Please try again.')
    }
  })
  
  const exportPDF = useMutation({
    mutationFn: () => {
      throw new Error('PDF export feature is coming soon!')
    },
    onError: (err) => {
      console.error('PDF export not available:', err)
      error('PDF export feature is coming soon! Please use CSV export for now.')
    }
  })
  
  const importCSV = useMutation({
    mutationFn: (file) => apiService.importMembersCSV(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['members'])
      const result = data.data || data
      
      // If callback provided, use it (for modal display)
      if (onImportResults) {
        onImportResults(result)
        return
      }
      
      // Fallback to toast notifications
      const imported = result.imported || 0
      const skipped = result.skipped || 0
      const errors = result.errors || []
      
      let message = `Import completed: ${imported} members imported`
      if (skipped > 0) {
        message += `, ${skipped} skipped (already exist)`
      }
      
      if (errors.length > 0) {
        message += `, ${errors.length} errors occurred`
        
        // Show detailed errors
        const errorDetails = errors.slice(0, 3).join('\n') // Show first 3 errors
        if (errors.length > 3) {
          message += `\n\nFirst 3 errors:\n${errorDetails}\n... and ${errors.length - 3} more errors`
        } else {
          message += `\n\nErrors:\n${errorDetails}`
        }
        
        // Log all errors to console for debugging
        console.warn('CSV Import errors:', errors)
        
        // Use error toast for better visibility when there are errors
        error(message, { delay: 10000 }) // Longer delay for errors
      } else {
        success(message)
      }
    },
    onError: (err) => {
      console.error('Failed to import members:', err)
      error('Failed to import members. Please check your file format and try again.')
    }
  })
  
  return {
    exportCSV,
    exportPDF,
    importCSV
  }
}