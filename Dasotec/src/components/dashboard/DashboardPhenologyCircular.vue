<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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

const monthlyLabels = computed(() => props.data.monthlyLabels || [])
const monthlySeries = computed(() => props.data.speciesMonthlySeries || [])

const speciesPalette = [
  { border: '#365314', fill: 'rgba(163, 230, 53, 0.22)' },
  { border: '#166534', fill: 'rgba(34, 197, 94, 0.20)' },
  { border: '#0f766e', fill: 'rgba(45, 212, 191, 0.19)' },
  { border: '#1d4ed8', fill: 'rgba(96, 165, 250, 0.19)' },
  { border: '#7c3aed', fill: 'rgba(196, 181, 253, 0.20)' },
  { border: '#c2410c', fill: 'rgba(251, 146, 60, 0.20)' },
]

function getSpeciesStyle(index) {
  return speciesPalette[index % speciesPalette.length]
}

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
}

function createChart(labels, series) {
  if (!chartCanvasRef.value) {
    throw new Error('No se encontro el canvas de fenologia circular.')
  }

  destroyChart()

  const datasets = series.map((item, index) => {
    const style = getSpeciesStyle(index)
    return {
      label: item.label,
      data: item.values,
      borderColor: style.border,
      backgroundColor: style.fill,
      pointRadius: 2,
      pointHoverRadius: 4,
      borderWidth: 2,
      fill: true,
    }
  })

  chartInstance = new Chart(chartCanvasRef.value, {
    type: 'radar',
    data: {
      labels,
      datasets,
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          angleLines: { color: '#dbe3ea' },
          grid: { color: '#e5edf3' },
          pointLabels: {
            color: '#526074',
            font: {
              family: 'Manrope, Segoe UI, sans-serif',
              size: 10,
              weight: '600',
            },
          },
          ticks: {
            backdropColor: 'transparent',
            color: '#768499',
            maxTicksLimit: 5,
            showLabelBackdrop: false,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            color: '#546170',
            font: {
              family: 'Manrope, Segoe UI, sans-serif',
              size: 10,
              weight: '600',
            },
          },
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
        },
      },
    },
  })
}

async function renderChart() {
  const labels = monthlyLabels.value
  const series = monthlySeries.value

  if (!labels.length || !series.length) {
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

    createChart(labels, series)
    emit('error', '')
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'No se pudo renderizar la fenologia circular.')
  }
}

watch(
  () => props.data,
  () => {
    renderChart()
  },
)

onMounted(() => {
  renderChart()
})

onBeforeUnmount(() => {
  renderRequestId += 1
  destroyChart()
})
</script>

<template>
  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h3 class="text-base font-semibold text-slate-800">Fenologia circular por especie</h3>
    <p class="mb-3 mt-1 text-xs text-slate-500">Patron mensual de detecciones para las especies mas frecuentes.</p>

    <div v-if="monthlySeries.length" class="h-[18rem] rounded-xl border border-slate-200 bg-white p-2 sm:h-[20rem] lg:h-[22rem]">
      <canvas ref="chartCanvasRef"></canvas>
    </div>

    <p v-else class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
      No hay suficientes datos para construir la fenologia circular.
    </p>
  </article>
</template>
