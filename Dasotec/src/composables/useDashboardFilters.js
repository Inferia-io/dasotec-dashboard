import { computed, ref, watch } from 'vue'

import {
  getFilteredRows,
  getStationKeyFromRow,
  prettifySpeciesName,
  prettifyStationName,
} from '../utils/dashboardData'
import { formatDate, numberFormatter } from '../utils/dashboardFormatters'

function timestampToInputDate(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return ''
  }

  return new Date(timestamp).toISOString().slice(0, 10)
}

export function useDashboardFilters(rawRows) {
  const selectedSpecies = ref([])
  const selectedStations = ref([])
  const selectedStartDate = ref('')
  const selectedEndDate = ref('')
  const minAvailableDate = ref('')
  const maxAvailableDate = ref('')

  const rowsForSpeciesOptions = computed(() =>
    getFilteredRows(rawRows.value, {
      stationFilter: selectedStations.value,
      speciesFilter: [],
      startDate: selectedStartDate.value,
      endDate: selectedEndDate.value,
    }),
  )

  const rowsForStationOptions = computed(() =>
    getFilteredRows(rawRows.value, {
      speciesFilter: selectedSpecies.value,
      stationFilter: [],
      startDate: selectedStartDate.value,
      endDate: selectedEndDate.value,
    }),
  )

  const speciesOptions = computed(() => {
    const speciesCount = new Map()

    for (const row of rowsForSpeciesOptions.value) {
      const speciesName = row.specie || 'sin-especie'
      speciesCount.set(speciesName, (speciesCount.get(speciesName) || 0) + 1)
    }

    return [...speciesCount.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([value, count]) => ({
        value,
        label: prettifySpeciesName(value),
        countLabel: numberFormatter.format(count),
      }))
  })

  const stationOptions = computed(() => {
    const stationCount = new Map()

    for (const row of rowsForStationOptions.value) {
      const stationName = getStationKeyFromRow(row)
      stationCount.set(stationName, (stationCount.get(stationName) || 0) + 1)
    }

    return [...stationCount.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([value, count]) => ({
        value,
        label: prettifyStationName(value),
        countLabel: numberFormatter.format(count),
      }))
  })

  const selectedRangeLabel = computed(() => {
    if (!selectedStartDate.value || !selectedEndDate.value) {
      return 'Todo el rango'
    }

    const startDate = Date.parse(`${selectedStartDate.value}T00:00:00.000Z`)
    const endDate = Date.parse(`${selectedEndDate.value}T00:00:00.000Z`)
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  })

  const hasDateRangeFilter = computed(() => {
    if (!selectedStartDate.value || !selectedEndDate.value || !minAvailableDate.value || !maxAvailableDate.value) {
      return false
    }

    return selectedStartDate.value !== minAvailableDate.value || selectedEndDate.value !== maxAvailableDate.value
  })

  const activeFilterChips = computed(() => {
    const chips = []

    for (const speciesName of selectedSpecies.value) {
      chips.push({
        key: `species-${speciesName}`,
        type: 'species',
        value: speciesName,
        label: `Especie: ${prettifySpeciesName(speciesName)}`,
      })
    }

    for (const stationName of selectedStations.value) {
      chips.push({
        key: `station-${stationName}`,
        type: 'station',
        value: stationName,
        label: `Estacion: ${prettifyStationName(stationName)}`,
      })
    }

    if (hasDateRangeFilter.value) {
      chips.push({
        key: 'range',
        type: 'range',
        label: `Rango: ${selectedRangeLabel.value}`,
      })
    }

    return chips
  })

  const hasActiveFilters = computed(() => activeFilterChips.value.length > 0)

  function resetDateRangeToAvailable() {
    if (!minAvailableDate.value || !maxAvailableDate.value) {
      return
    }

    selectedStartDate.value = minAvailableDate.value
    selectedEndDate.value = maxAvailableDate.value
  }

  function clearAllFilters() {
    selectedSpecies.value = []
    selectedStations.value = []
    resetDateRangeToAvailable()
  }

  function removeFilterChip(chip) {
    if (chip.type === 'species') {
      selectedSpecies.value = selectedSpecies.value.filter((speciesName) => speciesName !== chip.value)
      return
    }

    if (chip.type === 'station') {
      selectedStations.value = selectedStations.value.filter((stationName) => stationName !== chip.value)
      return
    }

    if (chip.type === 'range') {
      resetDateRangeToAvailable()
    }
  }

  function setAvailableDateBounds(minTimestamp, maxTimestamp) {
    minAvailableDate.value = timestampToInputDate(minTimestamp)
    maxAvailableDate.value = timestampToInputDate(maxTimestamp)
    resetDateRangeToAvailable()
  }

  watch(selectedStartDate, (value) => {
    if (selectedEndDate.value && value && value > selectedEndDate.value) {
      selectedEndDate.value = value
    }
  })

  watch(selectedEndDate, (value) => {
    if (selectedStartDate.value && value && value < selectedStartDate.value) {
      selectedStartDate.value = value
    }
  })

  watch(speciesOptions, (options) => {
    const availableSpecies = new Set(options.map((option) => option.value))
    const normalizedSelected = selectedSpecies.value.filter((speciesName) => availableSpecies.has(speciesName))

    if (normalizedSelected.length !== selectedSpecies.value.length) {
      selectedSpecies.value = normalizedSelected
    }
  })

  watch(stationOptions, (options) => {
    const availableStations = new Set(options.map((option) => option.value))
    const normalizedSelected = selectedStations.value.filter((stationName) => availableStations.has(stationName))

    if (normalizedSelected.length !== selectedStations.value.length) {
      selectedStations.value = normalizedSelected
    }
  })

  return {
    selectedSpecies,
    selectedStations,
    selectedStartDate,
    selectedEndDate,
    minAvailableDate,
    maxAvailableDate,
    speciesOptions,
    stationOptions,
    activeFilterChips,
    hasActiveFilters,
    setAvailableDateBounds,
    clearAllFilters,
    removeFilterChip,
  }
}
