import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useCallback, useEffect, useState, useRef } from 'react'
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
      if (queryClient) {
        queryClient.invalidateQueries(['members'])
      }
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
      if (queryClient) {
        queryClient.invalidateQueries(['members'])
      };
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
      if (queryClient) {
        queryClient.invalidateQueries(['members'])
      }
      
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
      if (queryClient) {
        queryClient.invalidateQueries(['members'])
      }
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
  // Safe initialization of queryClient
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  
  // Reference to track if we're in the middle of geocoding
  const geocodingRef = useRef(false);
  
  // Create the mutation
  const mutation = useMutation({
    mutationFn: apiService.geocodeAllAddresses,
    
    onMutate: () => {
      // Set geocoding flag
      geocodingRef.current = true;
    },
    
    onSuccess: (data) => {
      // Stop geocoding flag
      geocodingRef.current = false;
      
      console.log('Geocoding success response:', data);
      
      // Parse result data properly, supporting different response formats
      const result = data.data || data;
      const geocoded = result.geocoded || 0;
      const total = result.total || 0;
      const errors = result.errors || [];
      
      // Force refresh all member data
      if (queryClient) {
        console.log('Forcing immediate refetch of members data to update map markers');
        
        // First invalidate all member-related queries
        queryClient.invalidateQueries(['members']);
        queryClient.invalidateQueries(['members', 'coordinates']);
        
        // Then force immediate refetch
        queryClient.refetchQueries({
          queryKey: ['members'],
          type: 'active',
          exact: false,
          stale: true
        });
      }
      
      // Determine appropriate message based on results
      let message;
      
      // Always consider some geocoding, some errors a success
      if (geocoded > 0) {
        // At least some addresses were geocoded
        message = `Geocoding completed: ${geocoded} addresses geocoded`;
        if (errors.length > 0) {
          message += `, ${errors.length} errors occurred`;
          
          // Log errors for debugging but don't show error toast
          console.log('Geocoding errors:', errors);
        }
        
        // Show success toast for partial successes
        success(message);
      } else if (errors.length === 0) {
        // No addresses needed geocoding
        message = "No addresses found that need geocoding";
        success(message);
      } else {
        // Complete failure (zero successes, some errors)
        message = `Geocoding failed: ${errors.length} errors occurred`;
        
        // Show error details for complete failures
        let detailedMessage = message + "\n\nCommon causes:";
        detailedMessage += "\n• Incomplete addresses (missing city/state)";
        detailedMessage += "\n• Invalid addresses";
        detailedMessage += "\n• Network connectivity issues";
        
        // Log all errors
        console.error('Geocoding errors:', errors);
        
        // Show error toast with detailed message
        showError(detailedMessage);
      }
    },
    
    onError: (err) => {
      // Stop geocoding flag
      geocodingRef.current = false;
      
      // Clear interval if it exists
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      console.error('Failed to geocode addresses:', err);
      
      let errorMessage = 'Failed to geocode addresses.';
      
      // Check for specific error types
      if (err.response) {
        // Server responded with error status
        const status = err.response.status;
        const data = err.response.data;
        
        console.error('Error response:', status, data);
        
        if (status === 403) {
          errorMessage = 'Admin access required to geocode addresses.';
        } else if (status === 400 && data?.message) {
          // Check for specific known errors
          if (data.message.includes('Google Maps API key not configured')) {
            errorMessage = 'Google Maps API key not configured. Please set it in Settings.';
          } else {
            errorMessage = data.message;
          }
        } else if (data?.message) {
          errorMessage = data.message;
        }
      } else if (err.message && err.message.includes('Network Error')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Show the error
      showError(errorMessage + ' Please try again.');
    }
  });
  
  // Return just the mutation
  return mutation;
}

// Hook for CSV import/export
export const useMemberImportExport = ({ onImportResults } = {}) => {
  const { success: showSuccess, error: showError } = useToast()
  
  // Safe initialization of queryClient (wrapped in try/catch)
  let queryClient = null;
  try {
    queryClient = useQueryClient();
  } catch (e) {
    console.error('Error initializing queryClient in useMemberImportExport:', e);
  }
  
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
        
        // Create a new PDF document - LANDSCAPE orientation
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'in',
          format: 'letter' // 11 x 8.5 inches in landscape mode
        })
        
        // Set up document metadata
        doc.setProperties({
          title: `${clubName} Members Directory`,
          subject: 'Square Dance Club Members',
          creator: 'Squarehead',
          keywords: 'members, directory, export'
        })
        
        // Page dimensions (landscape format)
        const pageWidth = 11
        const pageHeight = 8.5
        const margin = 0.25 // Reduced margins by half
        const usableWidth = pageWidth - (margin * 2)
        
        // Add club logo if available
        let logoData = useSettingsStore.getState().getSetting('club_logo_data', null);
        const logoSize = 0.8; // Logo size in inches
        
        // Add title at the left
        doc.setFontSize(18)
        doc.setFont(undefined, 'bold')
        doc.text(`${clubName} Membership Roster`, margin, margin + 0.25)
        doc.setFont(undefined, 'normal')
        
        // Add current date in MM/DD/YYYY format just below the title
        const today = new Date();
        const formattedDate = `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`;
        doc.setFontSize(10)
        doc.text(`${formattedDate}`, margin, margin + 0.5)
        
        // Add logo to the upper right corner if available
        if (logoData) {
          try {
            // Create image from base64 data
            const imgData = `data:image/jpeg;base64,${logoData}`;
            doc.addImage(imgData, 'JPEG', pageWidth - margin - logoSize, margin, logoSize, logoSize);
          } catch (e) {
            console.error('Failed to add logo to PDF:', e);
          }
        }
        
        // Set up table
        doc.setFontSize(9)
        doc.setLineWidth(0.01)
        
        // Define columns with widths that fill the page - new column order
        const columns = [
          { header: 'Phone', width: usableWidth * 0.15 },
          { header: 'Name (last, first)', width: usableWidth * 0.22 },
          { header: 'Address', width: usableWidth * 0.33 },
          { header: 'E-mail', width: usableWidth * 0.3 }
        ]
        
        // Starting position - lower to accommodate the header with logo
        let y = margin + 1.2
        const rowHeight = 0.225 // Reduced by 25% from 0.30
        
        // Draw header row
        let x = margin
        // Header background
        doc.setFillColor(240, 240, 240)
        doc.rect(margin, y, usableWidth, rowHeight, 'F')
        
        // Draw header borders
        doc.setDrawColor(0, 0, 0) // Black color for borders
        doc.rect(margin, y, usableWidth, rowHeight, 'S') // Outer border
        
        // Draw vertical borders between columns
        let columnX = margin
        columns.forEach(column => {
          columnX += column.width
          if (columnX < margin + usableWidth) { // Don't draw after last column
            doc.line(columnX, y, columnX, y + rowHeight)
          }
        })
        
        // Header text
        doc.setFont(undefined, 'bold')
        x = margin
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
          if (y > pageHeight - margin - 0.5) { // Save space for footer
            // Add page footer with page count and privacy message
            // Add 5 more rows to account for summary section (4 items plus heading)
            const summaryRows = 5;
            doc.setFontSize(8)
            doc.text(`Page ${pageCount} of ${Math.ceil((members.length + summaryRows) / Math.floor((pageHeight - margin * 2 - 1.2) / rowHeight))}`, margin, pageHeight - 0.3)
            doc.text("Please shred when disposing this roster. If you have corrections please contact the Roster Manager or the President.", pageWidth / 2, pageHeight - 0.3, { align: 'center' })
            
            // Add new page
            doc.addPage()
            pageCount++
            y = margin
            
            // Redraw header on new page
            x = margin
            doc.setFillColor(240, 240, 240)
            doc.rect(margin, y, usableWidth, rowHeight, 'F')
            
            // Draw header borders
            doc.setDrawColor(0, 0, 0) // Black color for borders
            doc.rect(margin, y, usableWidth, rowHeight, 'S') // Outer border
            
            // Draw vertical borders between columns
            let columnX = margin
            columns.forEach(column => {
              columnX += column.width
              if (columnX < margin + usableWidth) { // Don't draw after last column
                doc.line(columnX, y, columnX, y + rowHeight)
              }
            })
            
            // Header text
            doc.setFontSize(9)
            doc.setFont(undefined, 'bold')
            x = margin
            columns.forEach(column => {
              doc.text(column.header, x + 0.1, y + (rowHeight / 2) + 0.03)
              x += column.width
            })
            doc.setFont(undefined, 'normal')
            
            y += rowHeight
          }
          
          // Draw row
          x = margin
          
          // Set row background color
          // Light yellow for second row and every third row after that
          if (i === 1 || (i > 1 && (i - 1) % 3 === 0)) {
            doc.setFillColor(255, 252, 220) // Light yellow
            doc.rect(margin, y, usableWidth, rowHeight, 'F')
          } else if (i % 2 === 0) {
            // Alternate white/very light grey for other rows
            doc.setFillColor(252, 252, 252)
            doc.rect(margin, y, usableWidth, rowHeight, 'F')
          }
          
          // Draw cell borders
          doc.setDrawColor(0, 0, 0) // Black color for borders
          doc.rect(margin, y, usableWidth, rowHeight, 'S') // Outer border
          
          // Draw vertical borders between columns
          let columnX = margin
          columns.forEach(column => {
            columnX += column.width
            if (columnX < margin + usableWidth) { // Don't draw after last column
              doc.line(columnX, y, columnX, y + rowHeight)
            }
          })
          
          // Add member data in the new column order
          
          // Phone
          doc.text(member.phone || '', x + 0.1, y + (rowHeight / 2) + 0.03)
          x += columns[0].width
          
          // Name (last, first)
          const fullName = `${member.last_name || ''}, ${member.first_name || ''}`
          doc.text(fullName, x + 0.1, y + (rowHeight / 2) + 0.03)
          x += columns[1].width
          
          // Address
          doc.text(member.address || '', x + 0.1, y + (rowHeight / 2) + 0.03)
          x += columns[2].width
          
          // Email
          doc.text(member.email || '', x + 0.1, y + (rowHeight / 2) + 0.03)
          
          y += rowHeight
        }
        
        // Calculate statistics for summary section
        const onTheRosterCount = members.length;
        const loaCount = members.filter(m => m.status === 'loa').length;
        const boosterCount = members.filter(m => m.status === 'booster').length;
        const currentMembersCount = onTheRosterCount - loaCount - boosterCount;
        
        // Add summary statistics section at the bottom
        y += rowHeight * 0.5; // Add some space before the summary
        
        // Draw heading for the summary section
        doc.setFont(undefined, 'bold');
        doc.text("Summary Statistics:", margin, y + rowHeight / 2);
        doc.setFont(undefined, 'normal');
        
        // Draw summary rows
        const summaryItems = [
          { label: "OnTheRoster", value: onTheRosterCount },
          { label: "Current Members", value: currentMembersCount },
          { label: "LOA", value: loaCount },
          { label: "Booster", value: boosterCount }
        ];
        
        summaryItems.forEach((item, i) => {
          y += rowHeight;
          
          // Label under Name column (left-justified)
          doc.text(item.label, margin + columns[0].width, y + rowHeight / 2);
          
          // Value under Phone column (right-justified)
          const valueText = item.value.toString();
          const valueWidth = doc.getStringUnitWidth(valueText) * doc.getFontSize() / 72; // Convert to inches
          doc.text(valueText, margin + columns[0].width - 0.1 - valueWidth, y + rowHeight / 2);
        });
        
        // Add footer to the last page with page count and privacy message
        doc.setFontSize(8)
        const totalPages = Math.ceil((members.length + summaryItems.length + 1) / Math.floor((pageHeight - margin * 2 - 1.2) / rowHeight));
        doc.text(`Page ${pageCount} of ${totalPages}`, margin, pageHeight - 0.3)
        doc.text("Please shred when disposing this roster. If you have corrections please contact the Roster Manager or the President.", pageWidth / 2, pageHeight - 0.3, { align: 'center' })
        
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
      if (queryClient) {
        queryClient.invalidateQueries(['members'])
      }
      console.log('Import CSV response:', response);
      console.log('Import CSV response type:', typeof response);
      console.log('Import CSV response keys:', Object.keys(response || {}));
      
      // Pass the entire response to the callback
      // Let the UI components handle the different response formats
      console.log('Import CSV raw response:', response);
      
      // If callback provided, use it (for modal display) and skip showing toasts
      // This is important to prevent duplicate toasts since the callback component
      // will handle its own toast messages
      if (onImportResults) {
        // Pass response to the callback but don't show any toasts here
        // The callback component (Members.jsx) will handle showing toasts
        onImportResults(response)
        return
      }
      
      // If we reach here, there's no callback, so we need to show our own toast
      // Extract statistics for toast notifications, handling both formats
      // This could be data.data (nested API response), data (first level), or direct properties
      const stats = response?.data?.data || response?.data || response || {};
      console.log('Extracted import statistics for notifications:', stats);
      
      const imported = stats.imported || 0
      const skipped = stats.skipped || 0
      const errors = stats.errors || []
      
      console.log('Parsed values:', { imported, skipped, errors });
      
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
        // Only show a success toast here if we don't have a callback
        showSuccess(message)
      }
    },
    onError: (err) => {
      console.error('Failed to import members:', err)
      console.error('Error type:', typeof err)
      console.error('Error properties:', Object.keys(err))
      console.error('Error name:', err.name)
      console.error('Error message:', err.message)
      
      // Try to extract any response data
      if (err.response) {
        console.error('Error response:', err.response)
      }
      
      // If there's an originalError property (from our enhanced error)
      if (err.originalError) {
        console.error('Original error:', err.originalError)
      }
      
      // Check if the "error" message actually contains a success message
      // This happens when the backend returns a success response but the frontend misinterprets it
      const isSuccessMessage = err.message && (
          err.message.includes('Import completed') || 
          err.message.includes('users imported') ||
          err.message.includes('records updated') ||
          err.message.includes('geocoded addresses')
      );
      
      if (isSuccessMessage) {
        console.log('Detected success message in error response (in hook), treating as success');
        
        // Try to extract the message (simplified version)
        let successMessage = 'Import completed successfully';
        
        // Try to extract from JSON format
        try {
          const messageMatch = err.message.match(/message":"([^"]+)"/);
          if (messageMatch && messageMatch[1]) {
            successMessage = messageMatch[1];
          }
          // Or extract from error message directly
          else if (err.message.includes('Import completed')) {
            const directMatch = err.message.match(/Import completed:?\s*(.*?)(?:\.|\n|$)/);
            if (directMatch && directMatch[1]) {
              successMessage = `Import completed: ${directMatch[1]}`;
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse success message from error:', parseErr);
        }
        
        // Refresh data
        if (queryClient) {
          queryClient.invalidateQueries(['members']);
        }
        
        // Only show success message if we don't have a callback (to prevent duplicate toasts)
        if (!onImportResults) {
          showSuccess(successMessage);
        }
        
        // Exit early - don't show error toast
        return;
      }
      
      // If we're here, it's a genuine error
      let errorMessage = 'Failed to import members. Please check your file format and try again.'
      
      // Add more detail if available
      if (err.message && err.message !== 'Failed to import members') {
        errorMessage += ' Error: ' + err.message
      }
      
      // Only show error toast if we don't have a callback (to prevent duplicate toasts)
      if (!onImportResults) {
        showError(errorMessage);
      }
    }
  })
  
  return {
    exportCSV,
    exportPDF,
    importCSV
  }
}