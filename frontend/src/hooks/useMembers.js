import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useCallback, useEffect } from 'react'
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
    mutationFn: ({ id, ...updates }) => {
      console.log('Calling API to update user ID:', id, 'with data:', updates);
      return apiService.updateUser(id, updates);
    },
    onSuccess: (data, variables) => {
      console.log('Update member API success:', data);
      const member = data.data || data
      console.log('Member data being stored:', member);
      updateMember(variables.id, member)
      queryClient.invalidateQueries(['members'])
      success('Member updated successfully!')
    },
    onError: (err) => {
      console.error('Failed to update member:', err)
      if (err.response) {
        console.error('API Error Response:', err.response.status, err.response.data);
      } else if (err.request) {
        console.error('No response received', err.request);
      } else {
        console.error('Error creating request', err.message);
      }
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
  const sortBy = useMembersStore((state) => state.sortBy) // Get sortBy to trigger rerenders
  const setFilters = useMembersStore((state) => state.setFilters)
  const clearFilters = useMembersStore((state) => state.clearFilters)
  const getFilteredMembers = useMembersStore((state) => state.getFilteredMembers)
  
  // Log when this hook re-renders
  console.log('useMemberFilters hook running with sortBy:', sortBy);
  
  // Memoize the filtered members based on members, filters, and sortBy
  const filteredMembers = useMemo(() => {
    console.log('Recalculating filteredMembers with sortBy:', sortBy);
    return getFilteredMembers();
  }, [getFilteredMembers, members, filters, sortBy]) // Include sortBy in dependencies
  
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
  const queryClient = useQueryClient()
  
  console.log('useMemberSorting hook running with sortBy:', sortBy);
  
  // Ensure the hook rerenders when sortBy changes
  useEffect(() => {
    console.log('sortBy changed in useMemberSorting:', sortBy);
  }, [sortBy]);
  
  const toggleSort = useCallback((field) => {
    console.log('Toggling sort for field:', field);
    console.log('Current sort state:', sortBy);
    
    // Get fresh state to avoid closure issues
    const currentSortBy = useMembersStore.getState().sortBy;
    const direction = currentSortBy.field === field && currentSortBy.direction === 'asc' ? 'desc' : 'asc';
    console.log('New sort direction:', direction);
    
    // Update state
    useMembersStore.setState({
      sortBy: { field, direction },
      _filteredMembersCache: null,
      _cacheKey: ''
    });
    
    // Force React Query to refetch members to trigger UI updates
    queryClient.invalidateQueries(['members']);
    
    // Double check that the state was updated
    setTimeout(() => {
      const newSortBy = useMembersStore.getState().sortBy;
      console.log('State after update:', newSortBy);
    }, 0);
  }, [queryClient])
  
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

// Hook for geocoding all member addresses
export const useGeocodeAllAddresses = () => {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  
  return useMutation({
    mutationFn: apiService.geocodeAllAddresses,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['members'])
      const result = data.data || data
      const geocoded = result.geocoded || 0
      const errors = result.errors || []
      
      let message = `Geocoding completed: ${geocoded} addresses geocoded`
      if (errors.length > 0) {
        message += `, ${errors.length} errors occurred`
      }
      
      success(message)
    },
    onError: (err) => {
      console.error('Failed to geocode addresses:', err)
      error('Failed to geocode addresses. Please try again.')
    }
  })
}

// Hook for CSV import/export
export const useMemberImportExport = ({ onImportResults } = {}) => {
  const { success: showSuccess, error: showError } = useToast()
  const queryClient = useQueryClient()
  
  const exportCSV = useMutation({
    mutationFn: async () => {
      console.log('🚀 exportCSV mutation starting...')
      console.trace('Export CSV call stack')
      
      // All authenticated users can export CSV now
      
      try {
        const result = await apiService.exportMembersCSV()
        console.log('🔍 Export mutation received result:', result)
        
        // Validate that we got a proper blob back
        if (!result || !result.blob || !(result.blob instanceof Blob)) {
          console.error('❌ Invalid result from API:', result)
          throw new Error('Invalid response from server')
        }
        
        return result
      } catch (error) {
        console.error('❌ Export mutation failed:', error)
        throw error
      }
    },
    retry: false, // Never retry export mutations to prevent duplicates
    onMutate: () => {
      console.log('⏳ exportCSV onMutate - Starting export...')
    },
    onSuccess: (result) => {
      console.log('✅ exportCSV onSuccess - Export completed:', result)
      
      try {
        console.log('🔍 Processing successful export with result:', result)
        
        // Only trigger download on successful mutation
        const { blob, filename } = result
        
        if (!blob) {
          throw new Error('No blob received from server')
        }
        
        console.log('📊 Blob details:', {
          size: blob.size,
          type: blob.type,
          filename: filename
        })
        
        if (blob.size === 0) {
          throw new Error('Received empty blob from server')
        }
        
        // Create download URL
        const downloadUrl = window.URL.createObjectURL(blob)
        console.log('🔗 Download URL created:', downloadUrl)
        
        // Check for Safari browser - it needs special handling
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
        console.log('Browser detection - Safari:', isSafari)
        
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
          // For IE
          window.navigator.msSaveOrOpenBlob(blob, filename)
          console.log('📥 Using msSaveOrOpenBlob for download (IE)')
        } else if (isSafari) {
          // Safari-specific approach
          console.log('📱 Using Safari-specific download approach')
          
          // Create a unique ID for this download link to ensure we can find it later
          const downloadId = 'csv-download-' + Date.now()
          const downloadLink = document.createElement('a')
          downloadLink.id = downloadId
          downloadLink.style.display = 'none'
          downloadLink.href = downloadUrl
          downloadLink.download = filename
          
          // For Safari, we need to make the link visible and use a timeout
          document.body.appendChild(downloadLink)
          
          // Give Safari time to register the blob URL
          setTimeout(() => {
            console.log('🖱️ Triggering click on Safari download link')
            // Set location directly as an alternative approach for Safari
            if (window.location.origin === 'file://') {
              // For file:// protocol, fallback to direct navigation
              window.location.href = downloadUrl
            } else {
              // For http/https
              downloadLink.click()
            }
            
            // Clean up after a longer delay for Safari
            setTimeout(() => {
              console.log('🧹 Cleaning up Safari download resources')
              if (document.body.contains(downloadLink)) {
                document.body.removeChild(downloadLink)
              }
              window.URL.revokeObjectURL(downloadUrl)
            }, 10000) // Much longer timeout for Safari
          }, 100)
        } else {
          // For other modern browsers
          // Create an invisible link
          const downloadLink = document.createElement('a')
          downloadLink.style.display = 'none'
          downloadLink.href = downloadUrl
          downloadLink.download = filename
          
          // Add to document, click, then remove
          console.log('📎 Adding download link to document')
          document.body.appendChild(downloadLink)
          
          console.log('🖱️ Triggering click on download link')
          downloadLink.click()
          
          // Remove link after a short delay
          setTimeout(() => {
            console.log('🧹 Cleaning up download resources')
            if (document.body.contains(downloadLink)) {
              document.body.removeChild(downloadLink)
            }
            window.URL.revokeObjectURL(downloadUrl)
          }, 5000) // Longer timeout for slower browsers
        }
        
        showSuccess(`CSV exported successfully: ${filename}`)
      } catch (error) {
        console.error('Download handling error:', error)
        showError('Failed to process the export. See console for details.')
      }
    },
    onError: (err) => {
      console.error('❌ Failed to export members:', err)
      
      // More specific error messages based on the error
      if (err.response && err.response.status === 401) {
        showError('Export failed: Authentication required. Please log in again.')
      } else {
        showError('Failed to export members. Please try again.')
      }
    }
  })
  
  const exportPDF = useMutation({
    mutationFn: () => {
      throw new Error('PDF export feature is coming soon!')
    },
    retry: false, // Never retry export mutations
    onError: (err) => {
      console.error('PDF export not available:', err)
      showError('PDF export feature is coming soon! Please use CSV export for now.')
    }
  })
  
  const importCSV = useMutation({
    mutationFn: (file) => apiService.importMembersCSV(file),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['members'])
      console.log('Import CSV response:', response);
      
      // For our fetch implementation, the data is directly available or in response.data
      let result = response;
      if (response.data) {
        // Handle both formats - the fetch API response is wrapped to match axios format
        // response.data could be the response or could contain a data property
        result = response.data.data || response.data;
      }
      
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
        showError(message, { delay: 10000 }) // Longer delay for errors
      } else {
        showSuccess(message)
      }
    },
    onError: (err) => {
      console.error('Failed to import members:', err)
      showError('Failed to import members. Please check your file format and try again.')
    }
  })
  
  return {
    exportCSV,
    exportPDF,
    importCSV
  }
}