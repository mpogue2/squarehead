import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useSchedulesStore = create(
  persist(
    (set, get) => ({
      // State
      currentSchedule: null,
      nextSchedule: null,
      assignments: [],
      selectedAssignment: null,
      editingAssignment: null,
      
      // Actions
      setCurrentSchedule: (schedule) => set({ currentSchedule: schedule }),
      
      setNextSchedule: (schedule) => set({ nextSchedule: schedule }),
      
      setAssignments: (assignments) => set({ assignments }),
      
      addAssignment: (assignment) => set((state) => ({
        assignments: [...state.assignments, assignment]
      })),
      
      updateAssignment: (assignmentId, updates) => set((state) => ({
        assignments: state.assignments.map(assignment => 
          assignment.id === assignmentId 
            ? { ...assignment, ...updates }
            : assignment
        ),
        selectedAssignment: state.selectedAssignment?.id === assignmentId
          ? { ...state.selectedAssignment, ...updates }
          : state.selectedAssignment,
        editingAssignment: state.editingAssignment?.id === assignmentId
          ? { ...state.editingAssignment, ...updates }
          : state.editingAssignment
      })),
      
      removeAssignment: (assignmentId) => set((state) => ({
        assignments: state.assignments.filter(assignment => assignment.id !== assignmentId),
        selectedAssignment: state.selectedAssignment?.id === assignmentId 
          ? null 
          : state.selectedAssignment,
        editingAssignment: state.editingAssignment?.id === assignmentId 
          ? null 
          : state.editingAssignment
      })),
      
      selectAssignment: (assignment) => set({ selectedAssignment: assignment }),
      
      startEditingAssignment: (assignment) => set({ 
        editingAssignment: { ...assignment },
        selectedAssignment: assignment
      }),
      
      updateEditingAssignment: (updates) => set((state) => ({
        editingAssignment: state.editingAssignment 
          ? { ...state.editingAssignment, ...updates }
          : null
      })),
      
      cancelEditingAssignment: () => set({ 
        editingAssignment: null 
      }),
      
      clearSelection: () => set({ 
        selectedAssignment: null,
        editingAssignment: null
      }),
      
      // Getters
      getCurrentAssignments: () => {
        const { assignments, currentSchedule } = get()
        if (!currentSchedule) return []
        
        return assignments
          .filter(assignment => assignment.schedule_id === currentSchedule.id)
          .sort((a, b) => new Date(a.dance_date) - new Date(b.dance_date))
      },
      
      getNextAssignments: () => {
        const { assignments, nextSchedule } = get()
        if (!nextSchedule) return []
        
        return assignments
          .filter(assignment => assignment.schedule_id === nextSchedule.id)
          .sort((a, b) => new Date(a.dance_date) - new Date(b.dance_date))
      },
      
      getAssignmentById: (id) => {
        const { assignments } = get()
        return assignments.find(assignment => assignment.id === id)
      },
      
      getAssignmentsByMember: (memberId) => {
        const { assignments } = get()
        return assignments.filter(assignment => 
          assignment.squarehead1_id === memberId || 
          assignment.squarehead2_id === memberId
        )
      },
      
      getUpcomingAssignments: (limit = 5) => {
        const { assignments } = get()
        const now = new Date()
        
        return assignments
          .filter(assignment => new Date(assignment.dance_date) >= now)
          .sort((a, b) => new Date(a.dance_date) - new Date(b.dance_date))
          .slice(0, limit)
      },
      
      getAssignmentsByDateRange: (startDate, endDate) => {
        const { assignments } = get()
        const start = new Date(startDate)
        const end = new Date(endDate)
        
        return assignments.filter(assignment => {
          const assignmentDate = new Date(assignment.dance_date)
          return assignmentDate >= start && assignmentDate <= end
        })
      }
    }),
    {
      name: 'schedules-storage',
      getStorage: () => localStorage,
      partialize: (state) => ({
        // Only persist UI state, not data
        selectedAssignment: state.selectedAssignment
      })
    }
  )
)

export default useSchedulesStore
