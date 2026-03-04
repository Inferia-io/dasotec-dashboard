import { computed, ref, watch } from 'vue'

import { aggregateRows, fetchCsvRows, getFilteredRows, getTimestampBounds } from '../utils/dashboardData'

export function useDashboardData({
  rawRows,
  selectedSpecies,
  selectedStations,
  selectedStartDate,
  selectedEndDate,
  setAvailableDateBounds,
}) {
  const isLoading = ref(true)
  const dashboardError = ref('')
  const visualizationError = ref('')
  const dashboardData = ref(null)

  const activeError = computed(() => dashboardError.value || visualizationError.value)

  function recalculateDashboardData() {
    const filteredRows = getFilteredRows(rawRows.value, {
      speciesFilter: selectedSpecies.value,
      stationFilter: selectedStations.value,
      startDate: selectedStartDate.value,
      endDate: selectedEndDate.value,
    })

    dashboardData.value = aggregateRows(filteredRows)
  }

  function handleVisualizationError(message) {
    visualizationError.value = message
  }

  async function initializeDashboard() {
    isLoading.value = true
    dashboardError.value = ''
    visualizationError.value = ''

    try {
      rawRows.value = await fetchCsvRows()
      const { minTimestamp, maxTimestamp } = getTimestampBounds(rawRows.value)
      setAvailableDateBounds(minTimestamp, maxTimestamp)
      recalculateDashboardData()
    } catch (error) {
      dashboardData.value = null
      dashboardError.value = error instanceof Error ? error.message : 'No se pudo preparar el dashboard.'
    } finally {
      isLoading.value = false
    }
  }

  watch([selectedSpecies, selectedStations, selectedStartDate, selectedEndDate], () => {
    if (isLoading.value || !rawRows.value.length) {
      return
    }

    dashboardError.value = ''
    visualizationError.value = ''
    recalculateDashboardData()
  })

  return {
    isLoading,
    dashboardData,
    activeError,
    initializeDashboard,
    handleVisualizationError,
  }
}
