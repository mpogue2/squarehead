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
      
      setSortBy: (field, direction) => {
        console.log('Store setSortBy called with:', field, direction);
        set(state => {
          console.log('Previous state:', state.sortBy);
          return {
            sortBy: { field, direction },
            _filteredMembersCache: null, // Clear cache when sort changes
            _cacheKey: ''
          };
        });
        // Log the state after update
        setTimeout(() => {
          console.log('New sortBy state:', get().sortBy);
        }, 0);
      },
      
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
        
        console.log('getFilteredMembers called with sortBy:', sortBy);
        
        // Create a cache key based on current state
        const currentCacheKey = JSON.stringify({
          membersLength: Array.isArray(members) ? members.length : 0,
          filters,
          sortBy
        })
        
        // Return cached result if available and valid
        if (_filteredMembersCache && _cacheKey === currentCacheKey) {
          console.log('Using cached filtered members');
          return _filteredMembersCache
        }
        
        console.log('Recalculating filtered and sorted members');
        
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
              member.address,
              member.birthday
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
        
        console.log('Sorting filtered members by:', sortBy.field, sortBy.direction);
        
        // Create a new array with the filtered results for sorting
        const sortedFiltered = [...filtered];
        
        // Sort function
        sortedFiltered.sort((a, b) => {
          // Get values, defaulting to empty string if not present
          const aValue = a[sortBy.field] !== undefined ? a[sortBy.field] : '';
          const bValue = b[sortBy.field] !== undefined ? b[sortBy.field] : '';
          
          // Special handling for birthday field in MM/DD format
          if (sortBy.field === 'birthday') {
            // Handle empty values - empty values should be at the end
            if (!aValue && !bValue) return 0;
            if (!aValue) return 1; // Push empty values to the end
            if (!bValue) return -1;
            
            // Try to parse MM/DD format
            try {
              const [aMonth, aDay] = aValue.split('/').map(Number);
              const [bMonth, bDay] = bValue.split('/').map(Number);
              
              // Check if we have valid numbers
              if (!isNaN(aMonth) && !isNaN(aDay) && !isNaN(bMonth) && !isNaN(bDay)) {
                // First compare months
                if (aMonth !== bMonth) {
                  return sortBy.direction === 'asc' ? aMonth - bMonth : bMonth - aMonth;
                }
                
                // If months are equal, compare days
                return sortBy.direction === 'asc' ? aDay - bDay : bDay - aDay;
              }
            } catch (e) {
              console.error('Error sorting birthdays:', e);
            }
          }
          
          // Default string comparison for all other fields
          let comparison;
          
          // Handle special cases like numbers stored as strings
          if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
          } else {
            // Convert to strings and compare
            comparison = String(aValue).localeCompare(String(bValue));
          }
          
          // Apply sort direction
          return sortBy.direction === 'asc' ? comparison : -comparison;
        });
        
        // Replace the filtered array with our sorted array
        filtered = sortedFiltered;
        
        // Cache the result - but do it outside of the render cycle
        // Log the sort results
        console.log('Sorted members by:', sortBy.field, sortBy.direction);
        console.log('First few sorted items:', filtered.slice(0, 3).map(m => ({
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          [sortBy.field]: m[sortBy.field]
        })));
        
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