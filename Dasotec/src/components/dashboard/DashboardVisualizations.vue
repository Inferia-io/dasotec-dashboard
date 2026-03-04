<script setup>
import { computed, ref, watch } from 'vue'

import DashboardBetaHeatmaps from './DashboardBetaHeatmaps.vue'
import DashboardCharts from './DashboardCharts.vue'
import DashboardHourlyDistributionMatrix from './DashboardHourlyDistributionMatrix.vue'
import DashboardMaps from './DashboardMaps.vue'
import DashboardPhenologyCircular from './DashboardPhenologyCircular.vue'
import DashboardSpeciesRanking from './DashboardSpeciesRanking.vue'
import DashboardStationSpeciesSankey from './DashboardStationSpeciesSankey.vue'
import DashboardStationRanking from './DashboardStationRanking.vue'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['error'])

const visualizationErrors = ref({
  charts: '',
  maps: '',
  phenology: '',
  sankey: '',
  prioritization: '',
})

const visualizationError = computed(
  () =>
    visualizationErrors.value.charts ||
    visualizationErrors.value.maps ||
    visualizationErrors.value.phenology ||
    visualizationErrors.value.sankey ||
    visualizationErrors.value.prioritization,
)

function setVisualizationError(key, message) {
  if (visualizationErrors.value[key] === message) {
    return
  }

  visualizationErrors.value = {
    ...visualizationErrors.value,
    [key]: message,
  }
}

watch(
  visualizationError,
  (message) => {
    emit('error', message)
  },
  { immediate: true },
)
</script>

<template>
  <section class="grid min-w-0 gap-5">
    <section class="min-w-0 rounded-2xl border border-slate-300/90 bg-slate-50/70 p-4 shadow-sm">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-600">Actividad temporal y composicion</h2>
      <p class="mb-3 mt-1 text-xs text-slate-500">
        Evolucion de detecciones, especies dominantes y distribucion por hora.
      </p>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <DashboardCharts :data="props.data" @error="(message) => setVisualizationError('charts', message)" />
        <DashboardHourlyDistributionMatrix :data="props.data" />
      </div>
    </section>

    <section class="min-w-0 rounded-2xl border border-slate-300/90 bg-slate-50/70 p-4 shadow-sm">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-600">Distribucion espacial</h2>
      <p class="mb-3 mt-1 text-xs text-slate-500">Hotspots de detecciones entre estaciones.</p>
      <div class="grid grid-cols-1 gap-4">
        <DashboardMaps :data="props.data" @error="(message) => setVisualizationError('maps', message)" />
      </div>
    </section>

    <section class="min-w-0 rounded-2xl border border-slate-300/90 bg-slate-50/70 p-4 shadow-sm">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-600">Fenologia y conectividad</h2>
      <p class="mb-3 mt-1 text-xs text-slate-500">
        Estacionalidad de especies y flujo de detecciones entre estaciones y taxones dominantes.
      </p>
      <div class="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <DashboardPhenologyCircular :data="props.data" @error="(message) => setVisualizationError('phenology', message)" />
        <DashboardStationSpeciesSankey :data="props.data" @error="(message) => setVisualizationError('sankey', message)" />
      </div>
    </section>

    <!--<DashboardStationPrioritization :data="props.data" @error="(message) => setVisualizationError('prioritization', message)" />-->

    <section class="grid min-w-0 gap-4 2xl:grid-cols-2">
      <section class="h-full min-w-0 rounded-2xl border border-slate-300/90 bg-slate-50/70 p-4 shadow-sm">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-600">Ranking de especies</h2>
        <p class="mb-3 mt-1 text-xs text-slate-500">
          Comparativa de presencia por especie con apoyo visual y metadata externa.
        </p>
        <DashboardSpeciesRanking :data="props.data" />
      </section>

      <DashboardStationRanking class="h-full" :data="props.data" />
    </section>

    <section class="min-w-0 rounded-2xl border border-slate-300/90 bg-slate-50/70 p-4 shadow-sm">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-600">Diversidad beta entre estaciones</h2>
      <p class="mb-3 mt-1 text-xs text-slate-500">
        Matrices de distancia para comparar recambio de especies por estacion.
      </p>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardBetaHeatmaps :data="props.data" />
      </div>
    </section>
  </section>
</template>
