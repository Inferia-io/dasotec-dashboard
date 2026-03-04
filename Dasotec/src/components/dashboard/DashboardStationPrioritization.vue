<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { numberFormatter } from '../../utils/dashboardFormatters'
import { prettifyStationName } from '../../utils/dashboardData'
import Chart from 'chart.js/auto'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['error'])

const chartCanvasRef = ref(null)
let chartInstance = null
let renderRequestId = 0

const trendStyleByKey = {
  up: {
    label: 'Sube',
    fill: 'rgba(34, 197, 94, 0.75)',
    border: '#15803d',
  },
  stable: {
    label: 'Estable',
    fill: 'rgba(100, 116, 139, 0.72)',
    border: '#475569',
  },
  down: {
    label: 'Baja',
    fill: 'rgba(239, 68, 68, 0.74)',
    border: '#b91c1c',
  },
}

const trendLegendItems = ['up', 'stable', 'down']

const stationRows = computed(() => {
  const rows = props.data.stationPrioritization || []
  return rows.filter(
    (row) =>
      Number.isFinite(row.conservationPriorityIndex) &&
      Number.isFinite(row.betaTurnoverIndex) &&
      Number.isFinite(row.effectiveSpeciesNumber) &&
      row.detections > 0,
  )
})

function getTrendStyle(trendKey) {
  return trendStyleByKey[trendKey] || trendStyleByKey.stable
}

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
}

function scaleBubbleRadius(rawValue, maxValue) {
  if (!Number.isFinite(rawValue) || rawValue <= 0 || !Number.isFinite(maxValue) || maxValue <= 0) {
    return 6
  }

  return 6 + (Math.sqrt(rawValue) / Math.sqrt(maxValue)) * 11
}

function formatIndexValue(value) {
  if (!Number.isFinite(value)) {
    return 'n/d'
  }

  return value.toFixed(3)
}

function formatTrendScore(trendScore) {
  if (!Number.isFinite(trendScore)) {
    return '0.0%'
  }

  const signedValue = trendScore * 100
  const signPrefix = signedValue > 0 ? '+' : ''
  return `${signPrefix}${signedValue.toFixed(1)}%`
}

function createPriorityChart(rows) {
  if (!chartCanvasRef.value) {
    throw new Error('No se encontro el canvas de priorizacion de estaciones.')
  }

  destroyChart()

  const maxEffectiveSpecies = Math.max(...rows.map((row) => row.effectiveSpeciesNumber), 1)
  const averageIpc = rows.reduce((sum, row) => sum + row.conservationPriorityIndex, 0) / rows.length
  const averageBeta = rows.reduce((sum, row) => sum + row.betaTurnoverIndex, 0) / rows.length

  const bubbleRows = rows.map((row) => ({
    x: row.conservationPriorityIndex,
    y: row.betaTurnoverIndex,
    r: scaleBubbleRadius(row.effectiveSpeciesNumber, maxEffectiveSpecies),
  }))

  const pointBackgroundColors = rows.map((row) => getTrendStyle(row.trendLabel).fill)
  const pointBorderColors = rows.map((row) => getTrendStyle(row.trendLabel).border)

  const quadrantGuidesPlugin = {
    id: 'station-priority-guides',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart
      if (!chartArea || !scales?.x || !scales?.y) {
        return
      }

      const xGuide = scales.x.getPixelForValue(averageIpc)
      const yGuide = scales.y.getPixelForValue(averageBeta)

      ctx.save()
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 1

      ctx.beginPath()
      ctx.moveTo(xGuide, chartArea.top)
      ctx.lineTo(xGuide, chartArea.bottom)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(chartArea.left, yGuide)
      ctx.lineTo(chartArea.right, yGuide)
      ctx.stroke()

      ctx.setLineDash([])
      ctx.fillStyle = '#64748b'
      ctx.font = '10px Manrope, Segoe UI, sans-serif'
      ctx.fillText('Media IPC', Math.min(xGuide + 6, chartArea.right - 58), chartArea.top + 12)
      ctx.fillText('Media beta', chartArea.left + 6, Math.max(chartArea.top + 12, yGuide - 6))
      ctx.restore()
    },
  }

  chartInstance = new Chart(chartCanvasRef.value, {
    type: 'bubble',
    data: {
      datasets: [
        {
          label: 'Estaciones',
          data: bubbleRows,
          backgroundColor: pointBackgroundColors,
          borderColor: pointBorderColors,
          borderWidth: 1.4,
          hoverBorderWidth: 2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0,
          max: 1,
          title: {
            display: true,
            text: 'IPC (prioridad de conservacion)',
          },
          grid: {
            color: '#e7edf3',
          },
          ticks: {
            callback: (value) => Number(value).toFixed(1),
          },
        },
        y: {
          min: 0,
          max: 1,
          title: {
            display: true,
            text: 'Recambio beta medio',
          },
          grid: {
            color: '#e7edf3',
          },
          ticks: {
            callback: (value) => Number(value).toFixed(1),
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: '#1f2933',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          padding: 10,
          titleFont: {
            family: 'Manrope, Segoe UI, sans-serif',
            size: 12,
            weight: '700',
          },
          bodyFont: {
            family: 'Manrope, Segoe UI, sans-serif',
            size: 11,
            weight: '500',
          },
          callbacks: {
            title(tooltipItems) {
              const row = rows[tooltipItems[0].dataIndex]
              return prettifyStationName(row.name)
            },
            label(tooltipItem) {
              const row = rows[tooltipItem.dataIndex]
              return [
                `Detecciones: ${numberFormatter.format(row.detections)}`,
                `IPC: ${formatIndexValue(row.conservationPriorityIndex)}`,
                `Beta media: ${formatIndexValue(row.betaTurnoverIndex)}`,
                `N efectivo: ${formatIndexValue(row.effectiveSpeciesNumber)}`,
                `Tendencia: ${getTrendStyle(row.trendLabel).label} (${formatTrendScore(row.trendScore)})`,
              ]
            },
          },
        },
      },
    },
    plugins: [quadrantGuidesPlugin],
  })
}

async function renderPriorityChart() {
  const rows = stationRows.value
  if (!rows.length) {
    destroyChart()
    emit('error', '')
    return
  }

  const requestId = ++renderRequestId

  try {
    await nextTick()
    if (requestId !== renderRequestId) {
      return
    }

    createPriorityChart(rows)
    emit('error', '')
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'No se pudo renderizar la priorizacion por estaciones.')
  }
}

watch(
  () => props.data,
  () => {
    renderPriorityChart()
  },
)

onMounted(() => {
  renderPriorityChart()
})

onBeforeUnmount(() => {
  renderRequestId += 1
  destroyChart()
})
</script>

<template>
  <section class="min-w-0 rounded-2xl border border-slate-300/90 bg-slate-50/70 p-4 shadow-sm">
    <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-600">Priorizacion de estaciones</h2>
    <p class="mb-3 mt-1 text-xs text-slate-500">
      Cuadrantes para identificar estaciones con mayor prioridad de conservacion segun IPC, recambio beta y tendencia temporal.
    </p>

    <div v-if="stationRows.length" class="h-[18rem] rounded-xl border border-slate-200 bg-white p-2 sm:h-[20rem] lg:h-[22rem]">
      <canvas ref="chartCanvasRef"></canvas>
    </div>

    <p v-else class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
      No hay estaciones suficientes para construir el cuadrante de priorizacion.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
      <span class="font-semibold">Tendencia:</span>
      <span
        v-for="trendKey in trendLegendItems"
        :key="trendKey"
        class="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2 py-1"
      >
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: getTrendStyle(trendKey).fill }"></span>
        <span>{{ getTrendStyle(trendKey).label }}</span>
      </span>
    </div>
  </section>
</template>
