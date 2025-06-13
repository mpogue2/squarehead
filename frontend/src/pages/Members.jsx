import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Button, 
  Form, 
  InputGroup, 
  Badge, 
  OverlayTrigger, 
  Tooltip,
  Spinner,
  Alert,
  Dropdown,
  ButtonGroup
} from 'react-bootstrap'
import { 
  FaSearch, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaSort, 
  FaSortUp, 
  FaSortDown,
  FaDownload,
  FaUpload,
  FaFilter,
  FaTimes
} from 'react-icons/fa'
import { 
  useMembers, 
  useMemberFilters, 
  useMemberSorting, 
  useMemberSelection,
  useMemberImportExport 
} from '../hooks/useMembers'
import { useAuth } from '../hooks/useAuth'
import { useUI } from '../hooks/useUI'
import { useToast } from '../components/ToastProvider'
import ImportResultsModal from '../components/members/ImportResultsModal'

// Memoized table row component to prevent unnecessary re-renders
const MemberRow = React.memo(({ member, canEdit, canDelete, onEdit, onDelete }) => {
  const getStatusBadge = useCallback((member) => {
    switch (member.status) {
      case 'exempt':
        return <Badge bg="warning">Exempt</Badge>
      case 'booster':
        return <Badge bg="info">Booster</Badge>
      case 'loa':
        return <Badge bg="secondary">LOA</Badge>
      case 'assignable':
      default:
        return <Badge bg="success">Assignable</Badge>
    }
  }, [])
  
  const getRoleBadge = useCallback((member) => {
    if (member.is_admin) {
      return <Badge bg="danger">Admin</Badge>
    }
    return <Badge bg="secondary">Member</Badge>
  }, [])

  return (
    <tr>
      <td>{member.first_name}</td>
      <td>{member.last_name}</td>
      <td>
        <a href={`mailto:${member.email}`} className="text-decoration-none">
          {member.email}
        </a>
      </td>
      <td>
        {member.phone ? (
          <a href={`tel:${member.phone}`} className="text-decoration-none">
            {member.phone}
          </a>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td>
        {member.address ? (
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>{member.address}</Tooltip>}
          >
            <span className="text-truncate d-inline-block" style={{ maxWidth: '150px' }}>
              {member.address}
            </span>
          </OverlayTrigger>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td>
        {member.partner_first_name && member.partner_last_name ? (
          <span className="fw-medium">
            {member.partner_first_name} {member.partner_last_name}
          </span>
        ) : (
          <span className="text-muted">None</span>
        )}
      </td>
      <td>
        {member.friend_first_name && member.friend_last_name ? (
          <span>
            {member.friend_first_name} {member.friend_last_name}
          </span>
        ) : (
          <span className="text-muted">None</span>
        )}
      </td>
      <td>{getStatusBadge(member)}</td>
      <td>{getRoleBadge(member)}</td>
      <td>
        {member.birthday ? member.birthday.replace(/-/g, '/') : <span className="text-muted">-</span>}
      </td>
      <td>
        <div className="d-flex gap-1">
          {canEdit && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>Edit Member</Tooltip>}
            >
              <Button
                variant="outline-primary"
                size="sm"
                onClick={() => onEdit(member)}
              >
                <FaEdit />
              </Button>
            </OverlayTrigger>
          )}
          
          {canDelete && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip>Delete Member</Tooltip>}
            >
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => onDelete(member)}
              >
                <FaTrash />
              </Button>
            </OverlayTrigger>
          )}
        </div>
      </td>
    </tr>
  )
})

MemberRow.displayName = 'MemberRow'

const Members = () => {
  const { user } = useAuth()
  const { data: members = [], isLoading, error } = useMembers()
  const { success, error: showError } = useToast()
  
  // Add refs to track export state and prevent multiple calls
  const exportingRef = useRef(false)
  const lastExportTimeRef = useRef(0)
  
  // Cleanup any problematic download links on component mount
  React.useEffect(() => {
    console.log('🧹 Cleaning up any existing download links...')
    const existingLinks = document.querySelectorAll('[id^="csv-download-"], a[download*="members"]')
    existingLinks.forEach(link => {
      if (link.href && link.href.startsWith('blob:')) {
        window.URL.revokeObjectURL(link.href)
      }
      link.remove()
    })
  }, [])
  
  const { 
    filters, 
    filteredMembers, 
    setSearch, 
    setStatusFilter, 
    setRoleFilter, 
    clearFilters 
  } = useMemberFilters()
  
  const { sortBy, toggleSort } = useMemberSorting()
  const { selectMember } = useMemberSelection()
  const { exportCSV, exportPDF, importCSV } = useMemberImportExport({
    onImportResults: (results) => {
      setImportResults(results)
      setShowImportResults(true)
    }
  })
  
  // Force re-render when sortBy changes
  const [forceUpdate, setForceUpdate] = useState(0)
  useEffect(() => {
    console.log('Sort state changed in Members component:', sortBy);
    setForceUpdate(prev => prev + 1);
  }, [sortBy.field, sortBy.direction])
  
  // Add a debounced export handler to prevent multiple rapid calls
  const handleExportCSV = useCallback(() => {
    console.log('🖱️ Export CSV button clicked')
    console.log('🔍 Current exportCSV state:', {
      isLoading: exportCSV.isLoading,
      isIdle: exportCSV.isIdle,
      isSuccess: exportCSV.isSuccess,
      isError: exportCSV.isError,
      error: exportCSV.error ? exportCSV.error.toString() : null
    })
    
    // Debug token information
    try {
      const authStore = JSON.parse(localStorage.getItem('auth-storage') || '{}')
      const token = authStore.state?.token
      console.log('🔐 Auth token available:', !!token)
      if (token) {
        console.log('Token prefix:', token.substring(0, 10) + '...')
      }
    } catch (e) {
      console.error('Failed to parse auth token:', e)
    }
    
    const now = Date.now()
    const timeSinceLastExport = now - lastExportTimeRef.current
    
    // Prevent multiple concurrent exports and rapid clicks (within 2 seconds)
    if (exportCSV.isLoading || exportingRef.current) {
      console.log('⚠️ Export already in progress, ignoring click')
      return
    }
    
    if (timeSinceLastExport < 2000) {
      console.log('⚠️ Export clicked too soon after last export, ignoring click')
      return
    }
    
    console.log('📤 Starting CSV export...')
    exportingRef.current = true
    lastExportTimeRef.current = now
    
    // Add a hard timeout to reset the exporting state if the operation takes too long
    const timeoutId = setTimeout(() => {
      console.log('⏱️ Export timeout reached, resetting state')
      exportingRef.current = false
    }, 30000) // 30 second timeout
    
    exportCSV.mutate(undefined, {
      onSuccess: (data) => {
        console.log('✅ Export mutation succeeded with data:', data)
        clearTimeout(timeoutId)
      },
      onError: (err) => {
        console.error('❌ Export mutation failed with error:', err)
        // Display the specific error for debugging
        if (err.response) {
          console.error('Error response:', {
            status: err.response.status,
            statusText: err.response.statusText,
            headers: err.response.headers,
            data: err.response.data
          })
        }
        clearTimeout(timeoutId)
      },
      onSettled: () => {
        console.log('🏁 Export settled, resetting state')
        exportingRef.current = false
        clearTimeout(timeoutId)
      }
    })
  }, [exportCSV])
  
  const handleExportPDF = useCallback(() => {
    console.log('🖱️ Export PDF button clicked')
    
    // Prevent multiple concurrent exports
    if (exportPDF.isLoading) {
      console.log('⚠️ PDF export already in progress, ignoring click')
      return
    }
    
    console.log('📄 Starting PDF export...')
    exportPDF.mutate()
  }, [exportPDF])
  const { open: openModal } = useUI()
  
  const [searchInput, setSearchInput] = useState(filters.search)
  const [showImportResults, setShowImportResults] = useState(false)
  const [importResults, setImportResults] = useState(null)
  
  // Handle search input with debouncing
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, setSearch])
  
  // Memoized event handlers to prevent re-renders
  const handleEdit = useCallback((member) => {
    selectMember(member)
    openModal('editMember')
  }, [selectMember, openModal])
  
  const handleDelete = useCallback((member) => {
    selectMember(member)
    openModal('deleteMember')
  }, [selectMember, openModal])
  
  const handleNewMember = useCallback(() => {
    console.log('Add Member button clicked!')
    console.log('selectMember:', selectMember)
    console.log('openModal:', openModal)
    selectMember(null)
    openModal('editMember')
    console.log('Modal should be opened')
  }, [selectMember, openModal])
  
  const handleImport = useCallback((event) => {
    const file = event.target.files[0]
    if (file) {
      console.log('📤 Starting CSV import with file:', file.name, file.size, file.type)
      
      // Validate file is a CSV
      if (!file.name.toLowerCase().endsWith('.csv')) {
        console.error('Invalid file type. Only CSV files are allowed.')
        showError('Invalid file type. Only CSV files are allowed.')
        event.target.value = '' // Reset input
        return
      }
      
      // More extensive file validation
      if (file.size === 0) {
        console.error('Empty file detected')
        showError('The selected file is empty. Please select a valid CSV file.')
        event.target.value = '' // Reset input
        return
      }
      
      // Log the file object for debugging
      console.log('File details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified).toISOString()
      })
      
      // Read the first few bytes to verify it's a valid file
      const reader = new FileReader()
      reader.onload = function(e) {
        const sample = e.target.result.substr(0, 500) // Get first 500 chars
        console.log('File content sample:', sample)
        
        // Extra validation - check if the file has header row
        if (!sample.includes('Phone') && !sample.includes('Name') && !sample.includes('E-mail')) {
          console.error('CSV file appears to be missing required headers')
          showError('CSV file appears to be missing required headers. Please check your file format.')
          return
        }
        
        // Show loading message
        success('Starting CSV import. This may take a moment...')
        
        // Proceed with import
        importCSV.mutate(file, {
          onSuccess: (data) => {
            console.log('✅ Import completed successfully:', data);
            console.log('✅ Import data structure:', JSON.stringify(data, null, 2));
            
            // Deep log the structure to see exactly what we're getting
            if (data.data) {
              console.log('data.data:', JSON.stringify(data.data, null, 2));
              if (data.data.data) {
                console.log('data.data.data:', JSON.stringify(data.data.data, null, 2));
              }
            }
            
            // Extract statistics for toast message and later use
            // This handles multiple possible nesting patterns
            let importStats = {};
            
            if (data.data && data.data.data) {
              // API response pattern: response.data.data contains our stats
              importStats = data.data.data;
            } else if (data.data) {
              // Simpler nesting: response.data contains our stats
              importStats = data.data;
            } else {
              // Direct: response contains our stats
              importStats = data;
            }
            
            console.log('✅ Extracted import statistics:', importStats);
            
            // Create a clean copy of the import results with just the stats we need
            // This prevents issues with nested references and ensures backward compatibility
            const cleanImportResults = {
              imported: importStats.imported || 0,
              skipped: importStats.skipped || 0,
              duplicates_handled: importStats.duplicates_handled || importStats.skipped || 0,
              auto_partnerships: importStats.auto_partnerships || 0,
              errors: importStats.errors || []
            };
            
            console.log('✅ Clean import results for modal:', cleanImportResults);
            
            // Set the import results state to our clean, simplified object
            setImportResults(cleanImportResults);
            setShowImportResults(true);
            
            // Construct a success message based on the results
            let successMsg = `Import completed with ${cleanImportResults.imported} members imported`;
            
            // Add duplicates handled info if any
            // Prefer duplicates_handled field but fall back to skipped for backward compatibility
            const duplicatesHandled = cleanImportResults.duplicates_handled || cleanImportResults.skipped || 0;
            if (duplicatesHandled > 0) {
              successMsg += `, ${duplicatesHandled} duplicate email${duplicatesHandled > 1 ? 's' : ''} handled`;
            }
            
            // Add partnerships info if any
            const autoPartnerships = cleanImportResults.auto_partnerships || 0;
            if (autoPartnerships > 0) {
              successMsg += `, ${autoPartnerships} automatic partner relationship${autoPartnerships !== 1 ? 's' : ''} created`;
            }
            
            // Show success message
            success(successMsg);
          },
          onError: (err) => {
            console.error('❌ Import failed:', err)
            
            // Log detailed error information
            console.error('Error type:', typeof err)
            console.error('Error properties:', Object.keys(err))
            console.error('Error name:', err.name)
            console.error('Error message:', err.message)
            
            // Try to extract a meaningful error message
            let errorMessage = 'CSV import failed. ';
            
            if (err.message) {
              // Check for network errors
              if (err.isNetworkError || err.message.includes('Network error') || err.message.includes('Failed to fetch')) {
                errorMessage = 'Network error: Cannot connect to the server. Please ensure the backend server is running and refresh the page before trying again.';
              } else if (err.message.includes('Missing required columns')) {
                errorMessage += 'Your CSV file is missing required columns. The file must have either a "Name" column (Last, First format) or separate "First Name" and "Last Name" columns, plus an "Email" column.';
              } else if (err.message.includes('HTML')) {
                errorMessage += 'Server returned an HTML error. Please check the server logs.';
              } else {
                errorMessage += err.message;
              }
            } else {
              errorMessage += 'Please check the file format and try again.';
            }
            
            showError(errorMessage);
          }
        })
      }
      reader.onerror = function(e) {
        console.error('Error reading file:', e)
        showError('Error reading the file. Please try again.')
      }
      reader.readAsText(file.slice(0, 5000)) // Read more of the file for better validation
      
      event.target.value = '' // Reset input
    }
  }, [importCSV, showError, success])
  
  // Memoized utility functions
  // This key will force the icon to re-render when sortBy changes
  const sortKey = `${sortBy.field}-${sortBy.direction}-${forceUpdate}`
  
  const getSortIcon = useCallback((field) => {
    console.log(`Getting sort icon for ${field}, current sort is ${sortBy.field} ${sortBy.direction} (key: ${sortKey})`);
    if (sortBy.field !== field) return <FaSort className="text-muted" />
    return sortBy.direction === 'asc' ? <FaSortUp /> : <FaSortDown />
  }, [sortBy.field, sortBy.direction, sortKey])
  
  const canEditMember = useCallback((member) => {
    return user?.is_admin || user?.id === member.id
  }, [user?.is_admin, user?.id])
  
  const canDeleteMember = useCallback((member) => {
    return user?.is_admin && member.email !== 'mpogue@zenstarstudio.com'
  }, [user?.is_admin])
  
  // Memoized computed values
  const hasActiveFilters = useMemo(() => {
    return filters.search || filters.status !== 'all' || filters.role !== 'all'
  }, [filters.search, filters.status, filters.role])
  
  const summaryStats = useMemo(() => {
    const assignableCount = filteredMembers.filter(m => m.status === 'assignable').length
    const adminCount = filteredMembers.filter(m => m.is_admin).length
    const partneredCount = filteredMembers.filter(m => 
      m.partner_first_name && m.partner_last_name
    ).length
    
    return { assignableCount, adminCount, partneredCount }
  }, [filteredMembers])
  
  if (isLoading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status" size="lg" />
        <p className="mt-3">Loading members...</p>
      </div>
    )
  }
  
  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error Loading Members</Alert.Heading>
        <p>Unable to load member data. Please try again.</p>
        <small className="text-muted">Error: {error.message}</small>
      </Alert>
    )
  }
  
  return (
    <div>
      {/* Header with title and member count */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="mb-1">Members</h1>
              <p className="text-muted mb-0">
                Showing {filteredMembers.length} of {members.length} members
                {hasActiveFilters && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="p-0 ms-2"
                    onClick={clearFilters}
                  >
                    <FaTimes className="me-1" />
                    Clear filters
                  </Button>
                )}
              </p>
            </div>
            <Badge bg="info" className="fs-6">
              {members.length} Total
            </Badge>
          </div>
        </Col>
      </Row>
      
      {/* Controls Section */}
      <Row className="mb-4">
        <Col lg={6}>
          {/* Search */}
          <InputGroup>
            <InputGroup.Text>
              <FaSearch />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search members by name, email, phone, address, or birthday..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </InputGroup>
        </Col>
        
        <Col lg={3}>
          {/* Status Filter */}
          <Form.Select
            value={filters.status}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="assignable">Assignable Only</option>
            <option value="exempt">Exempt Only</option>
            <option value="booster">Booster Only</option>
            <option value="loa">LOA Only</option>
          </Form.Select>
        </Col>
        
        <Col lg={3}>
          {/* Role Filter */}
          <Form.Select
            value={filters.role}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="member">Members Only</option>
            <option value="admin">Admins Only</option>
          </Form.Select>
        </Col>
      </Row>
      
      {/* Action Buttons */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex gap-2 flex-wrap">
            {/* Add Member */}
            <Button variant="primary" onClick={handleNewMember}>
              <FaPlus className="me-2" />
              Add Member
            </Button>
            
            {/* Import/Export */}
            <ButtonGroup>
              <Dropdown>
                <Dropdown.Toggle variant="success" id="dropdown-export">
                  <FaDownload className="me-2" />
                  Export
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item 
                    onClick={handleExportCSV}
                    disabled={exportCSV.isLoading}
                    title="Export members as CSV"
                  >
                    {exportCSV.isLoading ? (
                      <><Spinner size="sm" className="me-2" /> Exporting...</>
                    ) : (
                      <>CSV File</>
                    )}
                  </Dropdown.Item>
                  <Dropdown.Item 
                    onClick={handleExportPDF}
                    disabled={exportPDF.isLoading}
                  >
                    {exportPDF.isLoading ? (
                      <Spinner size="sm" className="me-2" />
                    ) : (
                      <>PDF File</>
                    )}
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              
              <Button 
                variant="outline-success" 
                onClick={() => document.getElementById('csv-upload').click()}
              >
                <FaUpload className="me-2" />
                Import CSV
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleImport}
                  disabled={importCSV.isLoading}
                />
              </Button>
            </ButtonGroup>
          </div>
        </Col>
      </Row>
      
      {/* Members Table */}
      <Card>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th 
                    className="sortable-header" 
                    onClick={() => toggleSort('first_name')}
                    style={{ cursor: 'pointer' }}
                    title="Click to sort by First Name"
                  >
                    <div className="d-flex align-items-center justify-content-between">
                      <span>First Name</span>
                      <span className="ms-2">{getSortIcon('first_name')}</span>
                    </div>
                  </th>
                  <th 
                    className="sortable-header" 
                    onClick={() => toggleSort('last_name')}
                    style={{ cursor: 'pointer' }}
                    title="Click to sort by Last Name"
                  >
                    <div className="d-flex align-items-center justify-content-between">
                      <span>Last Name</span>
                      <span className="ms-2">{getSortIcon('last_name')}</span>
                    </div>
                  </th>
                  <th 
                    className="sortable-header" 
                    onClick={() => toggleSort('email')}
                    style={{ cursor: 'pointer' }}
                    title="Click to sort by Email"
                  >
                    <div className="d-flex align-items-center justify-content-between">
                      <span>Email</span>
                      <span className="ms-2">{getSortIcon('email')}</span>
                    </div>
                  </th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Partner</th>
                  <th>Friend</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th 
                    className="sortable-header" 
                    onClick={() => toggleSort('birthday')}
                    style={{ cursor: 'pointer' }}
                    title="Click to sort by Birthday"
                  >
                    <div className="d-flex align-items-center justify-content-between">
                      <span>Birthday</span>
                      <span className="ms-2">{getSortIcon('birthday')}</span>
                    </div>
                  </th>
                  <th style={{ width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-4 text-muted">
                      {hasActiveFilters ? 'No members match your filters' : 'No members found'}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      canEdit={canEditMember(member)}
                      canDelete={canDeleteMember(member)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
      
      {/* Summary Stats */}
      <Row className="mt-4">
        <Col>
          <div className="d-flex gap-4 text-muted small">
            <span>
              <strong>{summaryStats.assignableCount}</strong> assignable members
            </span>
            <span>
              <strong>{summaryStats.adminCount}</strong> administrators
            </span>
            <span>
              <strong>{summaryStats.partneredCount}</strong> with partners
            </span>
          </div>
        </Col>
      </Row>

      {/* Import Results Modal */}
      <ImportResultsModal
        show={showImportResults}
        onHide={() => setShowImportResults(false)}
        results={importResults}
      />
    </div>
  )
}

export default Members