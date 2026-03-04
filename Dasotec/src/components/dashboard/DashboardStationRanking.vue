<script setup>
import { computed, ref } from 'vue'

import { numberFormatter, percentFormatter } from '../../utils/dashboardFormatters'
import { prettifyStationName } from '../../utils/dashboardData'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const rankingRows = computed(() => props.data.stationRanking || [])
const sortKey = ref('detections')
const sortDirection = ref('desc')

const indexFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

function formatConfidence(rawConfidence) {
  if (!Number.isFinite(rawConfidence) || rawConfidence <= 0) {
    return 'n/d'
  }

  const normalized = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence
  return percentFormatter.format(Math.max(0, Math.min(normalized, 1)))
}

function formatIndexValue(value) {
  if (!Number.isFinite(value)) {
    return 'n/d'
  }

  return indexFormatter.format(value)
}

function toggleSort(nextKey) {
  if (sortKey.value === nextKey) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortKey.value = nextKey
  sortDirection.value = nextKey === 'name' ? 'asc' : 'desc'
}

function sortIndicator(columnKey) {
  if (sortKey.value !== columnKey) {
    return '↕'
  }

  return sortDirection.value === 'asc' ? '↑' : '↓'
}

const sortedRows = computed(() => {
  const rows = [...rankingRows.value]
  const directionFactor = sortDirection.value === 'asc' ? 1 : -1

  rows.sort((left, right) => {
    if (sortKey.value === 'name') {
      const result = prettifyStationName(left.name).localeCompare(prettifyStationName(right.name))
      if (result !== 0) {
        return result * directionFactor
      }

      return (right.detections - left.detections) * directionFactor
    }

    const leftValue = Number.isFinite(left[sortKey.value]) ? left[sortKey.value] : Number.NEGATIVE_INFINITY
    const rightValue = Number.isFinite(right[sortKey.value]) ? right[sortKey.value] : Number.NEGATIVE_INFINITY

    if (leftValue !== rightValue) {
      return (leftValue - rightValue) * directionFactor
    }

    return prettifyStationName(left.name).localeCompare(prettifyStationName(right.name))
  })

  return rows
})
</script>

<template>
  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="text-base font-semibold text-slate-800">Ranking de estaciones</h2>
    <p class="mb-3 mt-1 text-xs text-slate-500">
      Indicadores de biodiversidad por estacion: Shannon-Wiener, dominancia de Simpson, Pielou, IPC, numero efectivo e ICAF.
    </p>

    <div v-if="sortedRows.length" class="space-y-2 lg:hidden">
      <article
        v-for="(row, index) in sortedRows"
        :key="`mobile-${row.name}`"
        class="rounded-xl border border-slate-200 bg-white p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">#{{ index + 1 }}</p>
            <p class="truncate text-sm font-semibold text-slate-800" :title="row.name">{{ prettifyStationName(row.name) }}</p>
          </div>
          <div class="text-right">
            <p class="text-[10px] text-slate-500">Detecciones</p>
            <p class="text-sm font-semibold text-slate-800">{{ numberFormatter.format(row.detections) }}</p>
          </div>
        </div>

        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-3">
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">Riqueza</dt>
            <dd class="font-semibold text-slate-700">{{ numberFormatter.format(row.richness) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">Shannon</dt>
            <dd class="font-semibold text-slate-700">{{ formatIndexValue(row.shannonWienerIndex) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">Domin. Simpson</dt>
            <dd class="font-semibold text-slate-700">{{ formatIndexValue(row.simpsonDominance) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">Pielou</dt>
            <dd class="font-semibold text-slate-700">{{ formatIndexValue(row.pielouEvenness) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">IPC</dt>
            <dd class="font-semibold text-slate-700">{{ formatIndexValue(row.conservationPriorityIndex) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">N efectivo</dt>
            <dd class="font-semibold text-slate-700">{{ formatIndexValue(row.effectiveSpeciesNumber) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">ICAF</dt>
            <dd class="font-semibold text-slate-700">{{ percentFormatter.format(row.commonForestAvifaunaIndex || 0) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-2">
            <dt class="text-slate-500">Confianza</dt>
            <dd class="font-semibold text-slate-700">{{ formatConfidence(row.averageConfidence) }}</dd>
          </div>
        </dl>
      </article>
    </div>

    <div v-if="sortedRows.length" class="hidden overflow-auto rounded-xl border border-slate-200 bg-white lg:block">
      <table class="min-w-[1120px] text-xs">
        <thead class="sticky top-0 z-10 bg-slate-100 text-slate-600">
          <tr>
            <th class="px-3 py-2 text-left font-semibold">#</th>
            <th class="px-3 py-2 text-left font-semibold">
              <button type="button" class="inline-flex items-center gap-1 hover:text-slate-800" @click="toggleSort('name')">
                <span>Estación</span>
                <span class="text-[10px]">{{ sortIndicator('name') }}</span>
              </button>
            </th>
            <th class="px-3 py-2 text-right font-semibold">
              <button
                type="button"
                class="inline-flex w-full items-center justify-end gap-1 hover:text-slate-800"
                @click="toggleSort('detections')"
              >
                <span>Detecciones</span>
                <span class="text-[10px]">{{ sortIndicator('detections') }}</span>
              </button>
            </th>
            <th class="px-3 py-2 text-right font-semibold">
              <button
                type="button"
                class="inline-flex w-full items-center justify-end gap-1 hover:text-slate-800"
                @click="toggleSort('richness')"
              >
                <span>Riqueza</span>
                <span class="text-[10px]">{{ sortIndicator('richness') }}</span>
              </button>
            </th>
            <th class="px-3 py-2 text-right font-semibold">
              <button
                type="button"
                class="inline-flex w-full items-center justify-end gap-1 hover:text-slate-800"
                @click="toggleSort('shannonWienerIndex')"
              >
                <span>Shannon-Wiener</span>
                <span class="text-[10px]">{{ sortIndicator('shannonWienerIndex') }}</span>
              </button>
            </th>
            <th class="px-3 py-2 text-right font-semibold">
              <button
                type="button"
                class="inline-flex w-full items-center justify-end gap-1 hover:text-slate-800"
                @click="toggleSort('simpsonDominance')"
              >
                <span>Domin. Simpson</span>
                <span class="text-[10px]">{{ sortIndicator('simpsonDominance') }}</span>
              </button>
            </th>
            <th class="px-3 py-2 text-right font-semibold">
              <button
                type="button"
                class="inline-flex w-full items-center justify-end gap-1 hover:text-slate-800"
                @click="toggleSort('pielouEvenness')"
              >
                <span>Pielou</span>
                <span class="text-[10px]">{{ sortIndicator('pielouEvenness') }}</span>
              </button>
            </th>
            <th class="px-3 py-2 text-right font-semibold">
              <button
                type="button"
                class="inline-flex w-full items-center justify-end gap-1 hover:text-slate-800"
                @click="toggleSort('conservationPriorityIndex')"
              >
                <span>IPC</span>
                <span class="text-[10px]">{{ sortIndicator('conservationPriorityIndex') }}</span>
              </button>
            </th>
            <th class="px-3 py-2 text-right font-semibold">
              <button
                type="button"
                class="inline-flex w-full items-center justify-end gap-1 hover:text-slate-800"
                @click="toggleSort('effectiveSpeciesNumber')"
              >
                <span>N efectivo</span>
                <span class="text-[10px]">{{ sortIndicator('effectiveSpeciesNumber') }}</span>
              </button>
            </th>
            <th class="px-3 py-2 text-right font-semibold">
              <button
                type="button"
                class="inline-flex w-full items-center justify-end gap-1 hover:text-slate-800"
                @click="toggleSort('commonForestAvifaunaIndex')"
              >
                <span>ICAF</span>
                <span class="text-[10px]">{{ sortIndicator('commonForestAvifaunaIndex') }}</span>
              </button>
            </th>
            <th class="px-3 py-2 text-right font-semibold">
              <button
                type="button"
                class="inline-flex w-full items-center justify-end gap-1 hover:text-slate-800"
                @click="toggleSort('averageConfidence')"
              >
                <span>Confianza media</span>
                <span class="text-[10px]">{{ sortIndicator('averageConfidence') }}</span>
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="(row, index) in sortedRows"
            :key="row.name"
            class="border-t border-slate-100 text-slate-700 even:bg-slate-50/60"
          >
            <td class="px-3 py-2 font-semibold text-slate-600">{{ index + 1 }}</td>
            <td class="max-w-80 px-3 py-2">
              <span class="block truncate" :title="row.name">{{ prettifyStationName(row.name) }}</span>
            </td>
            <td class="px-3 py-2 text-right font-semibold">{{ numberFormatter.format(row.detections) }}</td>
            <td class="px-3 py-2 text-right">{{ numberFormatter.format(row.richness) }}</td>
            <td class="px-3 py-2 text-right">{{ formatIndexValue(row.shannonWienerIndex) }}</td>
            <td class="px-3 py-2 text-right">{{ formatIndexValue(row.simpsonDominance) }}</td>
            <td class="px-3 py-2 text-right">{{ formatIndexValue(row.pielouEvenness) }}</td>
            <td class="px-3 py-2 text-right">{{ formatIndexValue(row.conservationPriorityIndex) }}</td>
            <td class="px-3 py-2 text-right">{{ formatIndexValue(row.effectiveSpeciesNumber) }}</td>
            <td class="px-3 py-2 text-right">{{ percentFormatter.format(row.commonForestAvifaunaIndex || 0) }}</td>
            <td class="px-3 py-2 text-right">{{ formatConfidence(row.averageConfidence) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
      No hay estaciones para mostrar con los filtros actuales.
    </p>

    <p class="mt-2 text-[11px] text-slate-500">
      IPC: abundancia ponderada por rareza global de especies. ICAF: proporcion de detecciones de especies comunes
      (top 30% global) en el filtro actual.
    </p>
  </article>
</template>
