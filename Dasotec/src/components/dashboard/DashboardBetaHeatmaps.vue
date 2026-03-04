<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const stationLabels = computed(() => props.data.betaStationLabels || [])
const jaccardMatrix = computed(() => props.data.betaJaccardMatrix || [])
const sorensenMatrix = computed(() => props.data.betaSorensenMatrix || [])

const hasEnoughStations = computed(() => stationLabels.value.length >= 2)

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return Number.NaN
  }

  return Math.max(0, Math.min(value, 1))
}

function formatDistance(value) {
  const normalized = clamp01(value)
  if (!Number.isFinite(normalized)) {
    return '—'
  }

  return normalized.toFixed(2)
}

function getCellStyle(value) {
  const normalized = clamp01(value)
  if (!Number.isFinite(normalized)) {
    return {
      backgroundColor: '#e2e8f0',
      color: '#64748b',
    }
  }

  const hue = 130 - normalized * 110
  const lightness = 93 - normalized * 52

  return {
    backgroundColor: `hsl(${hue} 75% ${lightness}%)`,
    color: normalized > 0.56 ? '#ffffff' : '#1f2937',
  }
}
</script>

<template>
  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="mb-1 text-base font-semibold text-slate-800">Matriz de distancia beta (Jaccard)</h2>
    <p class="text-xs text-slate-500">Distancia = 1 - (a / (a + b + c)) sobre presencia/ausencia de especies</p>

    <template v-if="hasEnoughStations">
      <div class="mt-3 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 overscroll-x-contain">
        <table class="w-max border-separate border-spacing-1 text-[10px] sm:text-[11px]">
          <thead>
            <tr>
              <th class="sticky left-0 z-20 rounded bg-slate-100 px-2 py-1 text-left text-[10px] font-semibold text-slate-600">
                Estación
              </th>
              <th
                v-for="label in stationLabels"
                :key="`j-head-${label}`"
                class="z-10 rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600"
              >
                <span class="block max-w-20 truncate sm:max-w-24" :title="label">{{ label }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in jaccardMatrix" :key="`j-row-${stationLabels[rowIndex]}`">
              <th class="sticky left-0 z-10 rounded bg-slate-100 px-2 py-1 text-left text-[10px] font-semibold text-slate-700">
                <span class="block max-w-24 truncate sm:max-w-32" :title="stationLabels[rowIndex]">{{ stationLabels[rowIndex] }}</span>
              </th>
              <td v-for="(value, colIndex) in row" :key="`j-cell-${rowIndex}-${colIndex}`" class="px-0.5 py-0.5">
                <div
                  class="flex h-7 min-w-9 items-center justify-center rounded text-[10px] font-semibold sm:h-8 sm:min-w-11"
                  :style="getCellStyle(value)"
                  :title="`Distancia Jaccard: ${formatDistance(value)}`"
                >
                  {{ formatDistance(value) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <p v-else class="mt-3 text-xs text-slate-500">Se necesitan al menos 2 estaciones para calcular la matriz.</p>

    <div class="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
      <span>0 (similar)</span>
      <span class="h-2 w-44 rounded bg-gradient-to-r from-lime-200 via-amber-300 to-orange-600"></span>
      <span>1 (distinta)</span>
    </div>

    <p v-if="data.betaMatrixTruncated" class="mt-2 text-xs text-slate-500">
      Mostrando {{ data.betaMatrixUsedStations }} de {{ data.betaMatrixTotalStations }} estaciones (ordenadas por detecciones).
    </p>
  </article>

  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="mb-1 text-base font-semibold text-slate-800">Matriz de distancia beta (Sørensen)</h2>
    <p class="text-xs text-slate-500">Distancia = 1 - ((2a) / (2a + b + c)) sobre presencia/ausencia de especies</p>

    <template v-if="hasEnoughStations">
      <div class="mt-3 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 overscroll-x-contain">
        <table class="w-max border-separate border-spacing-1 text-[10px] sm:text-[11px]">
          <thead>
            <tr>
              <th class="sticky left-0 z-20 rounded bg-slate-100 px-2 py-1 text-left text-[10px] font-semibold text-slate-600">
                Estación
              </th>
              <th
                v-for="label in stationLabels"
                :key="`s-head-${label}`"
                class="z-10 rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600"
              >
                <span class="block max-w-20 truncate sm:max-w-24" :title="label">{{ label }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in sorensenMatrix" :key="`s-row-${stationLabels[rowIndex]}`">
              <th class="sticky left-0 z-10 rounded bg-slate-100 px-2 py-1 text-left text-[10px] font-semibold text-slate-700">
                <span class="block max-w-24 truncate sm:max-w-32" :title="stationLabels[rowIndex]">{{ stationLabels[rowIndex] }}</span>
              </th>
              <td v-for="(value, colIndex) in row" :key="`s-cell-${rowIndex}-${colIndex}`" class="px-0.5 py-0.5">
                <div
                  class="flex h-7 min-w-9 items-center justify-center rounded text-[10px] font-semibold sm:h-8 sm:min-w-11"
                  :style="getCellStyle(value)"
                  :title="`Distancia Sørensen: ${formatDistance(value)}`"
                >
                  {{ formatDistance(value) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <p v-else class="mt-3 text-xs text-slate-500">Se necesitan al menos 2 estaciones para calcular la matriz.</p>

    <div class="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
      <span>0 (similar)</span>
      <span class="h-2 w-44 rounded bg-gradient-to-r from-lime-200 via-amber-300 to-orange-600"></span>
      <span>1 (distinta)</span>
    </div>

    <p v-if="data.betaMatrixTruncated" class="mt-2 text-xs text-slate-500">
      Mostrando {{ data.betaMatrixUsedStations }} de {{ data.betaMatrixTotalStations }} estaciones (ordenadas por detecciones).
    </p>
  </article>
</template>
