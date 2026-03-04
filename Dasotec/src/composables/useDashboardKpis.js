import { computed } from 'vue'

import { numberFormatter, percentFormatter } from '../utils/dashboardFormatters'

const diversityFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

export function useDashboardKpis(dashboardData, icons) {
  const { Database, BarChart3, MapPin, Gauge } = icons

  const kpiOverviewCards = computed(() => {
    if (!dashboardData.value) {
      return []
    }

    return [
      {
        label: 'Detecciones',
        value: numberFormatter.format(dashboardData.value.totalDetections),
        icon: Database,
        accent: '#6fab3a',
      },
      {
        label: 'Especies',
        value: numberFormatter.format(dashboardData.value.uniqueSpecies),
        icon: BarChart3,
        accent: '#81bf3f',
      },
      {
        label: 'Sensores',
        value: numberFormatter.format(dashboardData.value.uniqueSensors),
        icon: MapPin,
        accent: '#99c952',
      },
      {
        label: 'Confianza media',
        value: percentFormatter.format(dashboardData.value.averageConfidence),
        icon: Gauge,
        accent: '#50a46c',
      },
    ]
  })

  const kpiDiversityCards = computed(() => {
    if (!dashboardData.value) {
      return []
    }

    return [
      {
        label: "Indice Shannon (H')",
        value: diversityFormatter.format(dashboardData.value.shannonIndex),
        icon: BarChart3,
        accent: '#3f8a4c',
        hint: "Mayor H' indica mayor diversidad y equilibrio entre especies.",
      },
      {
        label: 'Indice Simpson (1-D)',
        value: diversityFormatter.format(dashboardData.value.simpsonIndex),
        icon: Gauge,
        accent: '#2f7a6a',
        hint: 'Mayor 1-D indica menor dominancia y mayor diversidad.',
      },
    ]
  })

  return {
    kpiOverviewCards,
    kpiDiversityCards,
  }
}
