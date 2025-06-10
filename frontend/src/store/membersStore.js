import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useMembersStore = create(
  persist(
    (set, get) => ({
      // State
      members: [],
      selectedMember: null,
      filters: {
        search: '',
        status: 'all', // 'all', 'assignable', 'exempt', 'booster', 'loa'
        role: 'all',   // 'all', 'member', 'admin'
      },
      sortBy: {
        field: 'last_name',
        direction: 'asc'
      },
      
      // Cached filtered members to prevent recalculation
      _filteredMembersCache: null,
      _cacheKey: '',
      
      // Actions
      setMembers: (members) => {
        set((state) => ({
          members,
          _filteredMembersCache: null, // Clear cache when members change
          _cacheKey: ''
        }))
      },
      
      addMember: (member) => set((state) => ({
        members: [...state.members, member],
        _filteredMembersCache: null, // Clear cache
        _cacheKey: ''
      })),
      
      updateMember: (memberId, updates) => set((state) => ({
        members: state.members.map(member => 
          member.id === memberId 
            ? { ...member, ...updates }
            : member
        ),
        selectedMember: state.selectedMember?.id === memberId 
          ? { ...state.selectedMember, ...updates }
          : state.selectedMember,
        _filteredMembersCache: null, // Clear cache
        _cacheKey: ''
      })),
      
      removeMember: (memberId) => set((state) => ({
        members: state.members.filter(member => member.id !== memberId),
        selectedMember: state.selectedMember?.id === memberId 
          ? null 
          : state.selectedMember,
        _filteredMembersCache: null, // Clear cache
        _cacheKey: ''
      })),
      
      selectMember: (member) => set({ selectedMember: member }),
      
      clearSelection: () => set({ selectedMember: null }),
      
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters },
        _filteredMembersCache: null, // Clear cache when filters change
        _cacheKey: ''
      })),
      
      setSortBy: (field, direction) => set({
        sortBy: { field, direction },
        _filteredMembersCache: null, // Clear cache when sort changes
        _cacheKey: ''
      }),
      
      clearFilters: () => set({
        filters: {
          search: '',
          status: 'all',
          role: 'all'
        },
        _filteredMembersCache: null, // Clear cache
        _cacheKey: ''
      }),
      
      // Getters with caching
      getFilteredMembers: () => {
        const state = get()
        const { members, filters, sortBy, _filteredMembersCache, _cacheKey } = state
        
        // Create a cache key based on current state
        const currentCacheKey = JSON.stringify({
          membersLength: Array.isArray(members) ? members.length : 0,
          filters,
          sortBy
        })
        
        // Return cached result if available and valid
        if (_filteredMembersCache && _cacheKey === currentCacheKey) {
          return _filteredMembersCache
        }
        
        // Ensure members is an array
        const membersList = Array.isArray(members) ? members : []
        
        let filtered = membersList.filter(member => {
          // Search filter
          if (filters.search) {
            const searchTerm = filters.search.toLowerCase()
            const searchFields = [
              member.first_name,
              member.last_name,
              member.email,
              member.phone,
              member.address
            ].filter(Boolean).join(' ').toLowerCase()
            
            if (!searchFields.includes(searchTerm)) {
              return false
            }
          }
          
          // Status filter
          if (filters.status !== 'all') {
            if (filters.status === 'assignable' && member.status !== 'assignable') {
              return false
            }
            if (filters.status === 'exempt' && member.status !== 'exempt') {
              return false
            }
            if (filters.status === 'booster' && member.status !== 'booster') {
              return false
            }
            if (filters.status === 'loa' && member.status !== 'loa') {
              return false
            }
          }
          
          // Role filter
          if (filters.role !== 'all') {
            if (filters.role === 'admin' && !member.is_admin) {
              return false
            }
            if (filters.role === 'member' && member.is_admin) {
              return false
            }
          }
          
          return true
        })
        
        // Sort
        filtered.sort((a, b) => {
          const aValue = a[sortBy.field] || ''
          const bValue = b[sortBy.field] || ''
          
          const comparison = aValue.toString().localeCompare(bValue.toString())
          return sortBy.direction === 'asc' ? comparison : -comparison
        })
        
        // Cache the result - but do it outside of the render cycle
        setTimeout(() => {
          set({
            _filteredMembersCache: filtered,
            _cacheKey: currentCacheKey
          })
        }, 0)
        
        return filtered
      },
      
      getMemberById: (id) => {
        const { members } = get()
        const membersList = Array.isArray(members) ? members : []
        return membersList.find(member => member.id === id)
      },
      
      getAssignableMembers: () => {
        const { members } = get()
        const membersList = Array.isArray(members) ? members : []
        return membersList.filter(member => member.status === 'assignable')
      },
      
      getAdminMembers: () => {
        const { members } = get()
        const membersList = Array.isArray(members) ? members : []
        return membersList.filter(member => member.is_admin)
      }
    }),
    {
      name: 'members-storage',
      getStorage: () => localStorage,
      partialize: (state) => ({
        filters: state.filters,
        sortBy: state.sortBy
      })
    }
  )
)

export default useMembersStore