// Authentication hooks
export * from './useAuth'

// Member management hooks
export * from './useMembers'

// Schedule management hooks
export * from './useSchedules'

// Settings management hooks
export * from './useSettings'

// UI and state management hooks
export * from './useUI'

// Re-export commonly used individual hooks for convenience
export { useCurrentUser, useLogout } from './useAuth'
export { useMembers, useCreateMember, useUpdateMember, useDeleteMember } from './useMembers'
export { useCurrentSchedule, useNextSchedule, useCreateNextSchedule } from './useSchedules'
export { useSettings, useUpdateSettings, useClubTheme } from './useSettings'
export { useLoadingState, useErrorHandler, useModals, useUI } from './useUI'

// Simple stubs for maintenance hooks
export const useClearMembers = () => ({ 
  mutateAsync: async () => ({ data: { deleted_count: 0 } }),
  isLoading: false 
})

export const useClearNextSchedule = () => ({ 
  mutateAsync: async () => ({ data: { deleted_count: 0 } }),
  isLoading: false
})

export const useClearCurrentSchedule = () => ({ 
  mutateAsync: async () => ({ data: { deleted_count: 0 } }),
  isLoading: false
})
