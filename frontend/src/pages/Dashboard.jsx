import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Row, Col, Badge, Spinner, Alert } from 'react-bootstrap'
import { apiService } from '../services/api'
import { useMembers } from '../hooks/useMembers'
import { useSettings } from '../hooks/useSettings'

const Dashboard = () => {
  const { data: apiStatus, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['apiStatus'],
    queryFn: apiService.getStatus,
  })

  const { data: members, isLoading: membersLoading, error: membersError } = useMembers()
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useSettings()

  const isLoading = statusLoading || membersLoading || settingsLoading
  const error = statusError || membersError || settingsError

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status" />
        <p className="mt-2">Loading dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Connection Error</Alert.Heading>
        <p>Unable to connect to the API. Please ensure the backend server is running.</p>
        <small>Error: {error.message}</small>
      </Alert>
    )
  }

  const clubName = settings?.club_name || 'Square Dance Club'
  const userCount = Array.isArray(members) ? members.length : 0
  const adminCount = Array.isArray(members) ? members.filter(user => user.is_admin)?.length : 0

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Dashboard</h1>
        <Badge bg="success">System Online</Badge>
      </div>

      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Club Members</Card.Title>
              <h2 className="text-primary">{userCount}</h2>
              <small className="text-muted">{adminCount} admin(s)</small>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Database</Card.Title>
              <h2 className="text-success">{apiStatus?.database?.database_type || 'Database'}</h2>
              <small className="text-muted">Connected</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        <Col md={6}>
          <Card>
            <Card.Header>
              <Card.Title className="mb-0">Club Information</Card.Title>
            </Card.Header>
            <Card.Body>
              <p><strong>Name:</strong> {clubName}</p>
              <p><strong>Subtitle:</strong> {settings?.club_subtitle}</p>
              <p><strong>Address:</strong> {settings?.club_address}</p>
              <p><strong>Dance Day:</strong> {settings?.club_day_of_week}</p>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card>
            <Card.Header>
              <Card.Title className="mb-0">System Status</Card.Title>
            </Card.Header>
            <Card.Body>
              <p><strong>API Version:</strong> {apiStatus?.version}</p>
              <p><strong>Database:</strong> {apiStatus?.database?.database_type}</p>
              <p><strong>Status:</strong> <Badge bg="success">{apiStatus?.status}</Badge></p>
              <p><strong>Last Updated:</strong> {new Date().toLocaleString()}</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
