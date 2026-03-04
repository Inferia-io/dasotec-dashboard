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
const COLOR_STOPS = [
  { value: 0, color: '#86efac' },
  { value: 1, color: '#f87171' },
]

const jaccardStats = computed(() => buildMatrixStats(jaccardMatrix.value))
const sorensenStats = computed(() => buildMatrixStats(sorensenMatrix.value))

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

function quantile(sortedValues, percentile) {
  if (!sortedValues.length) {
    return 0
  }

  const clamped = Math.max(0, Math.min(percentile, 1))
  const rawIndex = (sortedValues.length - 1) * clamped
  const lowerIndex = Math.floor(rawIndex)
  const upperIndex = Math.ceil(rawIndex)

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex]
  }

  const ratio = rawIndex - lowerIndex
  return sortedValues[lowerIndex] + (sortedValues[upperIndex] - sortedValues[lowerIndex]) * ratio
}

function buildMatrixStats(matrix) {
  const values = []

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || []

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      if (rowIndex === colIndex) {
        continue
      }

      const normalized = clamp01(row[colIndex])
      if (Number.isFinite(normalized)) {
        values.push(normalized)
      }
    }
  }

  if (!values.length) {
    return { low: 0, high: 1 }
  }

  values.sort((left, right) => left - right)

  let low = quantile(values, 0.08)
  let high = quantile(values, 0.92)
  if (high - low < 0.02) {
    low = values[0]
    high = values[values.length - 1]
  }

  if (high - low < 0.01) {
    low = Math.max(0, low - 0.005)
    high = Math.min(1, high + 0.005)
  }

  return { low, high }
}

function hexToRgb(hexColor) {
  const normalized = hexColor.replace('#', '')
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex(red, green, blue) {
  const toHex = (value) => Math.round(value).toString(16).padStart(2, '0')
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function interpolateColor(leftHex, rightHex, t) {
  const left = hexToRgb(leftHex)
  const right = hexToRgb(rightHex)
  return rgbToHex(
    left.r + (right.r - left.r) * t,
    left.g + (right.g - left.g) * t,
    left.b + (right.b - left.b) * t,
  )
}

function getColorFromScale(normalizedValue) {
  const clampedValue = Math.max(0, Math.min(normalizedValue, 1))

  for (let index = 1; index < COLOR_STOPS.length; index += 1) {
    const leftStop = COLOR_STOPS[index - 1]
    const rightStop = COLOR_STOPS[index]
    if (clampedValue > rightStop.value) {
      continue
    }

    const segmentRange = rightStop.value - leftStop.value || Number.EPSILON
    const segmentT = (clampedValue - leftStop.value) / segmentRange
    return interpolateColor(leftStop.color, rightStop.color, segmentT)
  }

  return COLOR_STOPS[COLOR_STOPS.length - 1].color
}

function getCellStyle(value, rowIndex, colIndex, stats) {
  const normalized = clamp01(value)
  if (rowIndex === colIndex) {
    return {
      backgroundColor: '#e2e8f0',
      color: '#475569',
      border: '1px solid #cbd5e1',
    }
  }

  if (!Number.isFinite(normalized)) {
    return {
      backgroundColor: '#e2e8f0',
      color: '#64748b',
      border: '1px solid #cbd5e1',
    }
  }

  const adaptiveRange = Math.max(stats.high - stats.low, Number.EPSILON)
  const adaptiveNormalized = Math.max(0, Math.min((normalized - stats.low) / adaptiveRange, 1))
  const contrasted = adaptiveNormalized ** 1.15
  const backgroundColor = getColorFromScale(contrasted)

  return {
    backgroundColor,
    color: contrasted > 0.78 ? '#ffffff' : '#1e293b',
    border: '1px solid rgba(148, 163, 184, 0.35)',
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
                  :style="getCellStyle(value, rowIndex, colIndex, jaccardStats)"
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
      <span>Menor valor</span>
      <span
        class="h-2 w-44 rounded border border-slate-300"
        style="background: linear-gradient(90deg, #86efac 0%, #f87171 100%)"
      ></span>
      <span>Mayor valor</span>
    </div>
    <p class="mt-1 text-[11px] text-slate-500">Escala de color adaptada al rango observado para mejorar contraste visual.</p>

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
                  :style="getCellStyle(value, rowIndex, colIndex, sorensenStats)"
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
      <span>Menor valor</span>
      <span
        class="h-2 w-44 rounded border border-slate-300"
        style="background: linear-gradient(90deg, #86efac 0%, #f87171 100%)"
      ></span>
      <span>Mayor valor</span>
    </div>
    <p class="mt-1 text-[11px] text-slate-500">Escala de color adaptada al rango observado para mejorar contraste visual.</p>

    <p v-if="data.betaMatrixTruncated" class="mt-2 text-xs text-slate-500">
      Mostrando {{ data.betaMatrixUsedStations }} de {{ data.betaMatrixTotalStations }} estaciones (ordenadas por detecciones).
    </p>
  </article>
</template>
