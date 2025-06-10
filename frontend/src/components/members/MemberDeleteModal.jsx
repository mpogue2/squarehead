import React from 'react'
import { Modal, Button, Alert } from 'react-bootstrap'
import { FaExclamationTriangle } from 'react-icons/fa'
import { useDeleteMember } from '../../hooks/useMembers'
import { useMemberSelection } from '../../hooks/useMembers'

const MemberDeleteModal = ({ show, onHide }) => {
  const { selectedMember } = useMemberSelection()
  const deleteMember = useDeleteMember()
  
  if (!selectedMember) {
    return null
  }
  
  const handleDelete = async () => {
    try {
      await deleteMember.mutateAsync(selectedMember.id)
      onHide()
    } catch (error) {
      console.error('Error deleting member:', error)
      // Error will be handled by the hook's onError callback
    }
  }
  
  const isProtectedMember = selectedMember.email === 'mpogue@zenstarstudio.com'
  
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title className="text-danger">
          <FaExclamationTriangle className="me-2" />
          Delete Member
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {isProtectedMember ? (
          <Alert variant="warning">
            <Alert.Heading>Cannot Delete Administrator</Alert.Heading>
            <p className="mb-0">
              The main administrator account cannot be deleted for security reasons.
            </p>
          </Alert>
        ) : (
          <>
            <p className="mb-3">
              Are you sure you want to delete{' '}
              <strong>{selectedMember.first_name} {selectedMember.last_name}</strong>?
            </p>
            
            <Alert variant="danger">
              <p className="mb-2">
                <strong>This action cannot be undone.</strong>
              </p>
              <ul className="mb-0">
                <li>The member will be permanently removed from the system</li>
                <li>All schedule assignments will be unaffected</li>
                <li>Historical data will be preserved</li>
              </ul>
            </Alert>
          </>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        {!isProtectedMember && (
          <Button 
            variant="danger" 
            onClick={handleDelete}
            disabled={deleteMember.isLoading}
          >
            {deleteMember.isLoading ? 'Deleting...' : 'Delete Member'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}

export default MemberDeleteModal