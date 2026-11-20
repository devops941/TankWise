import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tanksApi } from '../services/api'

const TankContext = createContext(null)

export function TankProvider({ children }) {
  const [selectedTankId, setSelectedTankId] = useState(
    () => localStorage.getItem('tw_selected_tank_id') || ''
  )
  const [dateRange, setDateRange] = useState(
    () => localStorage.getItem('tw_date_range') || '30d'
  )

  const { data: tanks = [], isLoading: loadingTanks, refetch: refreshTanks } = useQuery({
    queryKey: ['tanks'],
    queryFn: () => tanksApi.list().then((r) => r.data || []),
  })

  // Whenever tanks change, ensure valid selectedTankId is retained or selected
  useEffect(() => {
    if (tanks.length > 0) {
      const exists = tanks.some((t) => t.id === selectedTankId)
      if (!exists || !selectedTankId) {
        const defaultId = tanks[0].id
        setSelectedTankId(defaultId)
        localStorage.setItem('tw_selected_tank_id', defaultId)
      }
    } else if (!loadingTanks && tanks.length === 0) {
      setSelectedTankId('')
      localStorage.removeItem('tw_selected_tank_id')
    }
  }, [tanks, selectedTankId, loadingTanks])

  const selectTank = (id) => {
    setSelectedTankId(id)
    localStorage.setItem('tw_selected_tank_id', id)
  }

  const changeDateRange = (range) => {
    setDateRange(range)
    localStorage.setItem('tw_date_range', range)
  }

  const effectiveSelectedId = selectedTankId || (tanks.length > 0 ? tanks[0].id : '')
  const selectedTank = tanks.find((t) => t.id === effectiveSelectedId) || null

  return (
    <TankContext.Provider
      value={{
        tanks,
        selectedTankId: effectiveSelectedId,
        selectedTank,
        dateRange,
        loadingTanks,
        selectTank,
        changeDateRange,
        refreshTanks,
      }}
    >
      {children}
    </TankContext.Provider>
  )
}

export const useTank = () => {
  const ctx = useContext(TankContext)
  if (!ctx) throw new Error('useTank must be used within TankProvider')
  return ctx
}
