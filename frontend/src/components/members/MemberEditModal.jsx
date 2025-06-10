import React, { useState, useEffect } from 'react'
import { 
  Modal, 
  Form, 
  Button, 
  Row, 
  Col, 
  Alert,
  Spinner
} from 'react-bootstrap'
import { 
  useCreateMember, 
  useUpdateMember, 
  useMembers 
} from '../../hooks/useMembers'
import { useMemberSelection } from '../../hooks/useMembers'
import { useAuth } from '../../hooks/useAuth'
import { useUI } from '../../hooks/useUI'

const MemberEditModal = ({ show, onHide }) => {
  const { user } = useAuth()
  const { data: allMembers = [] } = useMembers()
  const { selectedMember } = useMemberSelection()
  const createMember = useCreateMember()
  const updateMember = useUpdateMember()
  
  const isEditing = !!selectedMember
  const isNewMember = !isEditing
  
  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    partner_id: '',
    friend_id: '',
    status: 'assignable',
    is_admin: false,
    birthday: ''
  })
  
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Initialize form data when modal opens or selectedMember changes
  useEffect(() => {
    if (selectedMember) {
      setFormData({
        first_name: selectedMember.first_name || '',
        last_name: selectedMember.last_name || '',
        email: selectedMember.email || '',
        phone: selectedMember.phone || '',
        address: selectedMember.address || '',
        partner_id: selectedMember.partner_id || '',
        friend_id: selectedMember.friend_id || '',
        status: selectedMember.status || 'assignable',
        is_admin: selectedMember.is_admin || false,
        birthday: selectedMember.birthday || ''
      })
    } else {
      // Reset form for new member
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: '',
        partner_id: '',
        friend_id: '',
        status: 'assignable',
        is_admin: false,
        birthday: ''
      })
    }
    setErrors({})
  }, [selectedMember, show])  
  // Get available partners and friends (exclude current member and admin user)
  const availableMembers = (Array.isArray(allMembers) ? allMembers : []).filter(member => 
    member.id !== selectedMember?.id && 
    member.email !== 'mpogue@zenstarstudio.com'
  )
  
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }
  
  const validateForm = () => {
    const newErrors = {}
    
    // Required fields
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required'
    }
    
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    } else {
      // Check for duplicate email (exclude current member if editing)
      const existingMember = allMembers.find(member => 
        member.email === formData.email && 
        member.id !== selectedMember?.id
      )
      if (existingMember) {
        newErrors.email = 'This email address is already in use'
      }
    }    
    // Phone validation (optional but if provided, should be valid)
    if (formData.phone && !/^[\d\s\-\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number'
    }
    
    // Birthday validation (optional but if provided, should be valid MM/DD format)
    if (formData.birthday && !/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/.test(formData.birthday)) {
      newErrors.birthday = 'Please enter a valid date in MM/DD format'
    }
    
    // Partner/friend validation
    if (formData.partner_id === formData.friend_id && formData.partner_id) {
      newErrors.friend_id = 'Partner and friend cannot be the same person'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const submitData = {
        ...formData,
        // Convert empty strings to null for optional fields
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        partner_id: formData.partner_id || null,
        friend_id: formData.friend_id || null,
        birthday: formData.birthday.trim() || null
      }
      
      if (isEditing) {
        console.log('Updating member with data:', {
          id: selectedMember.id,
          ...submitData
        });
        try {
          await updateMember.mutateAsync({
            id: selectedMember.id,
            ...submitData
          });
          console.log('Member updated successfully');
        } catch (err) {
          console.error('Error updating member:', err);
          if (err.response) {
            console.error('Response data:', err.response.data);
          }
          throw err; // Re-throw to let the outer catch handler deal with it
        }
      } else {
        console.log('Creating new member with data:', submitData);
        try {
          await createMember.mutateAsync(submitData);
          console.log('Member created successfully');
        } catch (err) {
          console.error('Error creating member:', err);
          if (err.response) {
            console.error('Response data:', err.response.data);
          }
          throw err; // Re-throw to let the outer catch handler deal with it
        }
      }
      
      onHide()
    } catch (error) {
      console.error('Error saving member:', error)
      // Error will be handled by the hook's onError callback
    } finally {
      setIsSubmitting(false)
    }
  }  
  const handleClose = () => {
    if (!isSubmitting) {
      onHide()
    }
  }
  
  const canEditAdminField = user?.is_admin && formData.email !== 'mpogue@zenstarstudio.com'
  const canEditThisMember = user?.is_admin || user?.id === selectedMember?.id
  
  if (!canEditThisMember && isEditing) {
    return (
      <Modal show={show} onHide={handleClose} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Access Denied</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            You don't have permission to edit this member.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    )
  }
  
  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Form onSubmit={handleSubmit}>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? 'Edit Member' : 'Add New Member'}
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <Row>
            {/* Basic Information */}
            <Col md={6}>
              <h6 className="text-muted mb-3">Basic Information</h6>              
              <Form.Group className="mb-3">
                <Form.Label>First Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  isInvalid={!!errors.first_name}
                  placeholder="Enter first name"
                />
                <Form.Control.Feedback type="invalid">
                  {errors.first_name}
                </Form.Control.Feedback>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Last Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  isInvalid={!!errors.last_name}
                  placeholder="Enter last name"
                />
                <Form.Control.Feedback type="invalid">
                  {errors.last_name}
                </Form.Control.Feedback>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Email Address *</Form.Label>
                <Form.Control
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  isInvalid={!!errors.email}
                  placeholder="Enter email address"
                />
                <Form.Control.Feedback type="invalid">
                  {errors.email}
                </Form.Control.Feedback>
              </Form.Group>              
              <Form.Group className="mb-3">
                <Form.Label>Phone Number</Form.Label>
                <Form.Control
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  isInvalid={!!errors.phone}
                  placeholder="Enter phone number"
                />
                <Form.Control.Feedback type="invalid">
                  {errors.phone}
                </Form.Control.Feedback>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Address</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter address"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Birthday (MM/DD)</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.birthday}
                  onChange={(e) => handleInputChange('birthday', e.target.value)}
                  isInvalid={!!errors.birthday}
                  placeholder="Enter birthday (e.g., 01/15)"
                  maxLength={5}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.birthday}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  Optional. Format: MM/DD (e.g., 01/15 for January 15th)
                </Form.Text>
              </Form.Group>
            </Col>
            
            {/* Relationships and Settings */}
            <Col md={6}>
              <h6 className="text-muted mb-3">Relationships & Settings</h6>
              
              <Form.Group className="mb-3">
                <Form.Label>Partner</Form.Label>
                <Form.Select
                  value={formData.partner_id}
                  onChange={(e) => handleInputChange('partner_id', e.target.value)}
                >
                  <option value="">No partner</option>
                  {availableMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Partners are always assigned together
                </Form.Text>
              </Form.Group>              
              <Form.Group className="mb-3">
                <Form.Label>Friend</Form.Label>
                <Form.Select
                  value={formData.friend_id}
                  onChange={(e) => handleInputChange('friend_id', e.target.value)}
                  isInvalid={!!errors.friend_id}
                >
                  <option value="">No friend preference</option>
                  {availableMembers
                    .filter(member => member.id !== formData.partner_id)
                    .map(member => (
                      <option key={member.id} value={member.id}>
                        {member.first_name} {member.last_name}
                      </option>
                    ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {errors.friend_id}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  Preferred to be assigned with (when possible)
                </Form.Text>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                >
                  <option value="assignable">Assignable</option>
                  <option value="exempt">Exempt</option>
                  <option value="booster">Booster</option>
                  <option value="loa">LOA (Leave of Absence)</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  Assignable members can be given squarehead duties. Exempt, Booster, and LOA members are not assigned duties.
                </Form.Text>
              </Form.Group>              
              {canEditAdminField && (
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Administrator privileges"
                    checked={formData.is_admin}
                    onChange={(e) => handleInputChange('is_admin', e.target.checked)}
                  />
                  <Form.Text className="text-muted">
                    Administrators can manage all members and settings
                  </Form.Text>
                </Form.Group>
              )}
            </Col>
          </Row>
        </Modal.Body>
        
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="me-2" />
                {isEditing ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              isEditing ? 'Update Member' : 'Create Member'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}

export default MemberEditModal