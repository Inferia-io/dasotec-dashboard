<script setup>
import { onMounted, ref } from 'vue'
import { BarChart3, Database, Gauge, MapPin } from 'lucide-vue-next'

import DashboardHeader from './components/dashboard/DashboardHeader.vue'
import DashboardKpiGrid from './components/dashboard/DashboardKpiGrid.vue'
import DashboardLoading from './components/dashboard/DashboardLoading.vue'
import DashboardVisualizations from './components/dashboard/DashboardVisualizations.vue'
import { useDashboardData } from './composables/useDashboardData'
import { useDashboardFilters } from './composables/useDashboardFilters'
import { useDashboardKpis } from './composables/useDashboardKpis'

const rawRows = ref([])

const {
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
} = useDashboardFilters(rawRows)

const {
  isLoading,
  dashboardData,
  activeError,
  initializeDashboard,
  handleVisualizationError,
} = useDashboardData({
  rawRows,
  selectedSpecies,
  selectedStations,
  selectedStartDate,
  selectedEndDate,
  setAvailableDateBounds,
})

const { kpiOverviewCards, kpiDiversityCards } = useDashboardKpis(dashboardData, {
  Database,
  BarChart3,
  MapPin,
  Gauge,
})

onMounted(() => {
  initializeDashboard()
})
</script>

<template>
  <div class="min-h-screen overflow-x-hidden bg-gradient-to-br from-lime-50 via-emerald-50 to-stone-100 text-slate-800 antialiased">
    <div class="mx-auto grid w-full max-w-[2200px] gap-4 px-3 pb-6 pt-3 sm:px-4 md:px-6 xl:px-8 2xl:px-10">
      <div class="z-[2100] md:sticky md:top-3">
        <DashboardHeader
          v-model:selectedSpecies="selectedSpecies"
          v-model:selectedStations="selectedStations"
          v-model:startDate="selectedStartDate"
          v-model:endDate="selectedEndDate"
          :min-date="minAvailableDate"
          :max-date="maxAvailableDate"
          :species-options="speciesOptions"
          :station-options="stationOptions"
        />
      </div>

      <section
        v-if="dashboardData"
        class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-300/80 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-600">Filtros activos</p>

        <template v-if="hasActiveFilters">
          <button
            v-for="chip in activeFilterChips"
            :key="chip.key"
            type="button"
            class="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            @click="removeFilterChip(chip)"
          >
            <span class="max-w-[68vw] truncate sm:max-w-none">{{ chip.label }}</span>
            <span class="text-slate-400">x</span>
          </button>

          <button
            type="button"
            class="rounded-full border border-lime-300 bg-lime-50 px-2 py-1 text-[11px] font-semibold text-lime-800 hover:bg-lime-100"
            @click="clearAllFilters"
          >
            Limpiar todo
          </button>
        </template>

        <p v-else class="text-xs text-slate-500">Sin filtros aplicados.</p>
      </section>

      <p v-if="activeError" class="-mt-1 mb-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
        {{ activeError }}
      </p>

      <DashboardLoading v-if="isLoading" />

      <main v-else-if="dashboardData" class="grid min-w-0 gap-5">
        <section class="grid gap-4 lg:grid-cols-12">
          <section class="rounded-2xl border border-slate-300/90 bg-slate-50/70 p-4 shadow-sm lg:col-span-8">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-600">Resumen general</h2>
            <p class="mb-3 mt-1 text-xs text-slate-500">Volumen total y cobertura de sensores en el periodo filtrado.</p>
            <DashboardKpiGrid :items="kpiOverviewCards" />
          </section>

          <section class="rounded-2xl border border-slate-300/90 bg-slate-50/70 p-4 shadow-sm lg:col-span-4">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-600">Diversidad alfa</h2>
            <p class="mb-3 mt-1 text-xs text-slate-500">
              Indices de diversidad para interpretar riqueza y dominancia de especies.
            </p>
            <DashboardKpiGrid :items="kpiDiversityCards" />
          </section>
        </section>

        <DashboardVisualizations :data="dashboardData" @error="handleVisualizationError" />
      </main>
    </div>
  </div>
</template>
