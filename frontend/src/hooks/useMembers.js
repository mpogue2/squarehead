import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useCallback, useEffect } from 'react'
import { apiService } from '../services/api'
import useMembersStore from '../store/membersStore'
import useSettingsStore from '../store/settingsStore'
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
  
  // Add an event listener for manual refetching
  useEffect(() => {
    const handleRefetch = () => {
      console.log('Manually refetching members from event');
      queryClient.invalidateQueries(['members']);
    };
    
    window.addEventListener('refetch-members', handleRefetch);
    
    return () => {
      window.removeEventListener('refetch-members', handleRefetch);
    };
  }, [queryClient]);
  
  return useMutation({
    mutationFn: ({ id, ...updates }) => {
      console.log('Calling API to update user ID:', id, 'with data:', updates);
      
      // Log the specific partner_id and friend_id values for debugging
      console.log('Partner ID in API request:', updates.partner_id);
      console.log('Friend ID in API request:', updates.friend_id);
      
      return apiService.updateUser(id, updates);
    },
    onSuccess: (data, variables) => {
      console.log('Update member API success:', data);
      const member = data.data || data
      console.log('Member data being stored:', member);
      
      // Update the store
      updateMember(variables.id, member)
      
      // Force a full refetch to make sure UI is updated with fresh data
      queryClient.invalidateQueries(['members'])
      
      // Show success message
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
    mutationFn: async () => {
      console.log('🚀 exportPDF mutation starting...')
      
      try {
        // Get all members with filters applied
        const members = useMembersStore.getState().getFilteredMembers()
        console.log(`📊 Generating PDF for ${members.length} members`)
        
        // Get club name from settings
        const clubName = useSettingsStore.getState().getClubName()
        console.log(`🏢 Using club name: ${clubName}`)
        
        // Create a new PDF document
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'in',
          format: 'letter' // 8.5 x 11 inches
        })
        
        // Set up document metadata
        doc.setProperties({
          title: `${clubName} Members Directory`,
          subject: 'Square Dance Club Members',
          creator: 'Squarehead',
          keywords: 'members, directory, export'
        })
        
        // Page dimensions
        const pageWidth = 8.5
        const pageHeight = 11
        const margin = 0.5
        const usableWidth = pageWidth - (margin * 2)
        
        // Add title
        doc.setFontSize(18)
        doc.text(`${clubName} Members Directory`, pageWidth / 2, margin, { align: 'center' })
        
        // Add current date
        const today = new Date().toLocaleDateString()
        doc.setFontSize(10)
        doc.text(`Generated: ${today}`, pageWidth / 2, margin + 0.3, { align: 'center' })
        
        // Set up table
        doc.setFontSize(9)
        doc.setLineWidth(0.01)
        
        // Define columns with widths that fill the page
        const columns = [
          { header: 'First Name', width: usableWidth * 0.15 },
          { header: 'Last Name', width: usableWidth * 0.15 },
          { header: 'Email', width: usableWidth * 0.25 },
          { header: 'Phone', width: usableWidth * 0.15 },
          { header: 'Status', width: usableWidth * 0.1 },
          { header: 'Role', width: usableWidth * 0.1 },
          { header: 'Birthday', width: usableWidth * 0.1 }
        ]
        
        // Starting position
        let y = margin + 0.7
        const rowHeight = 0.25
        
        // Draw header row
        let x = margin
        // Header background
        doc.setFillColor(240, 240, 240)
        doc.rect(margin, y, usableWidth, rowHeight, 'F')
        
        // Header text
        doc.setFont(undefined, 'bold')
        columns.forEach(column => {
          doc.text(column.header, x + 0.1, y + (rowHeight / 2) + 0.03)
          x += column.width
        })
        doc.setFont(undefined, 'normal')
        
        y += rowHeight
        
        // Draw rows for each member
        let pageCount = 1
        
        for (let i = 0; i < members.length; i++) {
          const member = members[i]
          
          // Check if we need a new page
          if (y > pageHeight - margin) {
            // Add page number
            doc.setFontSize(8)
            doc.text(`Page ${pageCount}`, pageWidth / 2, pageHeight - 0.3, { align: 'center' })
            
            // Add new page
            doc.addPage()
            pageCount++
            y = margin
            
            // Redraw header on new page
            x = margin
            doc.setFillColor(240, 240, 240)
            doc.rect(margin, y, usableWidth, rowHeight, 'F')
            
            doc.setFontSize(9)
            doc.setFont(undefined, 'bold')
            columns.forEach(column => {
              doc.text(column.header, x + 0.1, y + (rowHeight / 2) + 0.03)
              x += column.width
            })
            doc.setFont(undefined, 'normal')
            
            y += rowHeight
          }
          
          // Draw row
          x = margin
          
          // Alternate row background for readability
          if (i % 2 === 0) {
            doc.setFillColor(252, 252, 252)
            doc.rect(margin, y, usableWidth, rowHeight, 'F')
          }
          
          // Add member data
          // For 'loa' status, use all uppercase "LOA", otherwise capitalize first letter
          const statusText = member.status === 'loa' ? 'LOA' : 
                             member.status.charAt(0).toUpperCase() + member.status.slice(1)
          const roleText = member.is_admin ? 'Admin' : 'Member'
          
          // First Name
          doc.text(member.first_name || '', x + 0.1, y + (rowHeight / 2) + 0.03)
          x += columns[0].width
          
          // Last Name
          doc.text(member.last_name || '', x + 0.1, y + (rowHeight / 2) + 0.03)
          x += columns[1].width
          
          // Email
          doc.text(member.email || '', x + 0.1, y + (rowHeight / 2) + 0.03)
          x += columns[2].width
          
          // Phone
          doc.text(member.phone || '', x + 0.1, y + (rowHeight / 2) + 0.03)
          x += columns[3].width
          
          // Status
          doc.text(statusText, x + 0.1, y + (rowHeight / 2) + 0.03)
          x += columns[4].width
          
          // Role
          doc.text(roleText, x + 0.1, y + (rowHeight / 2) + 0.03)
          x += columns[5].width
          
          // Birthday
          doc.text(member.birthday || '', x + 0.1, y + (rowHeight / 2) + 0.03)
          
          y += rowHeight
        }
        
        // Add page number to the last page
        doc.setFontSize(8)
        doc.text(`Page ${pageCount}`, pageWidth / 2, pageHeight - 0.3, { align: 'center' })
        
        // Generate the PDF
        const pdfBlob = doc.output('blob')
        
        return {
          blob: pdfBlob,
          filename: `members-directory-${new Date().toISOString().split('T')[0]}.pdf`
        }
      } catch (error) {
        console.error('❌ PDF generation failed:', error)
        throw error
      }
    },
    retry: false, // Never retry export mutations
    onMutate: () => {
      console.log('⏳ exportPDF onMutate - Starting export...')
    },
    onSuccess: (result) => {
      console.log('✅ exportPDF onSuccess - Export completed:', result)
      
      try {
        console.log('🔍 Processing successful PDF export with result:', result)
        
        // Only trigger download on successful mutation
        const { blob, filename } = result
        
        if (!blob) {
          throw new Error('No blob received from PDF generation')
        }
        
        console.log('📊 Blob details:', {
          size: blob.size,
          type: blob.type,
          filename: filename
        })
        
        if (blob.size === 0) {
          throw new Error('Received empty blob from PDF generation')
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
          const downloadId = 'pdf-download-' + Date.now()
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
        
        showSuccess(`PDF exported successfully: ${filename}`)
      } catch (error) {
        console.error('Download handling error:', error)
        showError('Failed to process the PDF export. See console for details.')
      }
    },
    onError: (err) => {
      console.error('❌ Failed to export PDF:', err)
      showError('Failed to generate PDF. Please try again.')
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