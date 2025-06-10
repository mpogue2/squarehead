import React from 'react'
import { Badge, Button, Dropdown } from 'react-bootstrap'
import { useQuery } from '@tanstack/react-query'
import { apiService } from '../services/api'
import { useCurrentUser } from '../hooks/useAuth'

const PageHeader = ({ 
  title, 
  subtitle, 
  icon, 
  actions, 
  breadcrumbs,
  showUserInfo = true 
}) => {
  const { user, isAdmin } = useCurrentUser()
  
  // Fetch club settings for theme color
  const { data: settingsResponse } = useQuery({
    queryKey: ['settings'],
    queryFn: apiService.getSettings,
    staleTime: 5 * 60 * 1000,
  })
  
  const clubColor = settingsResponse?.data?.club_color || '#0d6efd'
  
  return (
    <div className="mb-4">
      <div className="d-flex justify-content-between align-items-start">
        <div className="flex-grow-1">
          {/* Title Section */}
          <div className="d-flex align-items-center mb-2">
            {icon && (
              <div 
                className="rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{ 
                  width: '45px', 
                  height: '45px', 
                  backgroundColor: clubColor,
                  opacity: 0.9
                }}
              >
                <i 
                  className={`bi bi-${icon} text-white`}
                  style={{ fontSize: '1.2rem' }}
                ></i>
              </div>
            )}
            <div>
              <h1 className="mb-0" style={{ color: clubColor, fontSize: '1.75rem' }}>
                {title}
              </h1>
              {subtitle && (
                <p className="text-muted mb-0 mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          
          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-0">
                {breadcrumbs.map((crumb, index) => (
                  <li 
                    key={index}
                    className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? 'active' : ''}`}
                    aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                  >
                    {crumb.href && index !== breadcrumbs.length - 1 ? (
                      <a href={crumb.href} className="text-decoration-none">
                        {crumb.icon && <i className={`bi bi-${crumb.icon} me-1`}></i>}
                        {crumb.label}
                      </a>
                    ) : (
                      <>
                        {crumb.icon && <i className={`bi bi-${crumb.icon} me-1`}></i>}
                        {crumb.label}
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </div>
        
        {/* Actions and User Info */}
        <div className="d-flex align-items-center">
          {/* Page Actions */}
          {actions && actions.length > 0 && (
            <div className="me-3">
              {actions.map((action, index) => {
                if (action.type === 'dropdown') {
                  return (
                    <Dropdown key={index} className="me-2">
                      <Dropdown.Toggle 
                        variant={action.variant || 'outline-primary'}
                        size={action.size || 'sm'}
                      >
                        {action.icon && <i className={`bi bi-${action.icon} me-1`}></i>}
                        {action.label}
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        {action.items.map((item, itemIndex) => (
                          <Dropdown.Item 
                            key={itemIndex}
                            onClick={item.onClick}
                            disabled={item.disabled}
                          >
                            {item.icon && <i className={`bi bi-${item.icon} me-2`}></i>}
                            {item.label}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                  )
                } else {
                  return (
                    <Button
                      key={index}
                      variant={action.variant || 'primary'}
                      size={action.size || 'sm'}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="me-2"
                    >
                      {action.icon && <i className={`bi bi-${action.icon} me-1`}></i>}
                      {action.label}
                    </Button>
                  )
                }
              })}
            </div>
          )}
          
          {/* User Info */}
          {showUserInfo && (
            <div className="text-end">
              <div className="d-flex align-items-center">
                <div className="me-3">
                  <div className="text-muted small">Welcome back,</div>
                  <div className="fw-bold">{user?.first_name}!</div>
                </div>
                {isAdmin && (
                  <Badge 
                    style={{ backgroundColor: clubColor }}
                    className="d-flex align-items-center"
                  >
                    <i className="bi bi-shield-check me-1"></i>
                    Admin
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PageHeader
