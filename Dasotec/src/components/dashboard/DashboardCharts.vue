<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['error'])

const speciesChartCanvas = ref(null)
const hourlyChartCanvas = ref(null)
const sensorChartCanvas = ref(null)
const dailyChartCanvas = ref(null)
const speciesHourlyStackedCanvas = ref(null)
const speciesHourlyLineCanvas = ref(null)

const chartInstances = []
let renderRequestId = 0

const speciesColorPalette = [
  { stroke: '#365314', fill: 'rgba(163, 230, 53, 0.56)' },
  { stroke: '#166534', fill: 'rgba(34, 197, 94, 0.48)' },
  { stroke: '#0f766e', fill: 'rgba(45, 212, 191, 0.45)' },
  { stroke: '#1d4ed8', fill: 'rgba(96, 165, 250, 0.44)' },
  { stroke: '#6d28d9', fill: 'rgba(167, 139, 250, 0.46)' },
  { stroke: '#9a3412', fill: 'rgba(251, 146, 60, 0.5)' },
]

function getSpeciesColor(index) {
  return speciesColorPalette[index % speciesColorPalette.length]
}

function chartFont(size, weight) {
  return { family: 'Manrope, Segoe UI, sans-serif', size, weight }
}

function commonTooltip() {
  return {
    backgroundColor: '#1f2933',
    titleColor: '#ffffff',
    bodyColor: '#ffffff',
    padding: 10,
    displayColors: false,
    titleFont: chartFont(12, '700'),
    bodyFont: chartFont(11, '500'),
  }
}

function destroyCharts() {
  for (const chart of chartInstances) {
    chart.destroy()
  }

  chartInstances.length = 0
}

function createCharts(data) {
  if (
    !speciesChartCanvas.value ||
    !hourlyChartCanvas.value ||
    !sensorChartCanvas.value ||
    !dailyChartCanvas.value ||
    !speciesHourlyStackedCanvas.value ||
    !speciesHourlyLineCanvas.value
  ) {
    throw new Error('No se pudieron inicializar los canvas de las graficas.')
  }

  destroyCharts()

  Chart.defaults.font.family = 'Manrope, Segoe UI, sans-serif'
  Chart.defaults.color = '#546170'

  const speciesChart = new Chart(speciesChartCanvas.value, {
    type: 'bar',
    data: {
      labels: data.topSpeciesLabels,
      datasets: [
        {
          data: data.topSpeciesValues,
          backgroundColor: '#81bf3f',
          borderRadius: 999,
          barThickness: 14,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#e8edf2' },
          border: { display: false },
          ticks: { font: chartFont(11, '500') },
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: chartFont(11, '600') },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: commonTooltip(),
      },
    },
  })

  chartInstances.push(speciesChart)

  const hourlyChart = new Chart(hourlyChartCanvas.value, {
    type: 'line',
    data: {
      labels: data.hourlyLabels,
      datasets: [
        {
          data: data.hourlyValues,
          label: 'Detecciones',
          borderColor: '#50a46c',
          backgroundColor: 'rgba(80, 164, 108, 0.18)',
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 4,
          fill: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: chartFont(11, '500'), maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#e8edf2' },
          border: { display: false },
          ticks: { font: chartFont(11, '500') },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: commonTooltip(),
      },
    },
  })

  chartInstances.push(hourlyChart)

  const sensorChart = new Chart(sensorChartCanvas.value, {
    type: 'bar',
    data: {
      labels: data.topSensorsLabels,
      datasets: [
        {
          data: data.topSensorsValues,
          backgroundColor: '#99c952',
          borderRadius: 7,
          maxBarThickness: 24,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            font: chartFont(10, '600'),
            autoSkip: true,
            maxRotation: 0,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#e8edf2' },
          border: { display: false },
          ticks: { font: chartFont(11, '500') },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: commonTooltip(),
      },
    },
  })

  chartInstances.push(sensorChart)

  const dailyChart = new Chart(dailyChartCanvas.value, {
    type: 'line',
    data: {
      labels: data.dailyLabels,
      datasets: [
        {
          data: data.dailyValues,
          label: 'Detecciones diarias',
          borderColor: '#6fab3a',
          backgroundColor: 'rgba(111, 171, 58, 0.18)',
          pointRadius: 1.5,
          pointHoverRadius: 4,
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            font: chartFont(10, '500'),
            autoSkip: true,
            maxTicksLimit: 8,
            maxRotation: 0,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#e8edf2' },
          border: { display: false },
          ticks: { font: chartFont(11, '500') },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: commonTooltip(),
      },
    },
  })

  chartInstances.push(dailyChart)

  const speciesHourlyDatasets = (data.speciesHourlySeries || []).map((series, index) => {
    const color = getSpeciesColor(index)
    return {
      label: series.label,
      data: series.values,
      backgroundColor: color.fill,
      borderColor: color.stroke,
    }
  })

  const speciesHourlyStackedChart = new Chart(speciesHourlyStackedCanvas.value, {
    type: 'bar',
    data: {
      labels: data.hourlyLabels,
      datasets: speciesHourlyDatasets.map((dataset) => ({
        ...dataset,
        borderWidth: 1,
        stack: 'species',
      })),
    },
    options: {
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          border: { display: false },
          ticks: { font: chartFont(10, '500'), maxTicksLimit: 12 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: '#e8edf2' },
          border: { display: false },
          ticks: { font: chartFont(11, '500') },
        },
      },
      plugins: {
        legend: {
          display: speciesHourlyDatasets.length > 0,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: chartFont(10, '600'),
          },
        },
        tooltip: commonTooltip(),
      },
    },
  })

  chartInstances.push(speciesHourlyStackedChart)

  const speciesHourlyLineChart = new Chart(speciesHourlyLineCanvas.value, {
    type: 'line',
    data: {
      labels: data.hourlyLabels,
      datasets: speciesHourlyDatasets.map((dataset) => ({
        ...dataset,
        fill: false,
        borderWidth: 2,
        tension: 0.28,
        pointRadius: 1.5,
        pointHoverRadius: 4,
      })),
    },
    options: {
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: chartFont(10, '500'), maxTicksLimit: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#e8edf2' },
          border: { display: false },
          ticks: { font: chartFont(11, '500') },
        },
      },
      plugins: {
        legend: {
          display: speciesHourlyDatasets.length > 0,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: chartFont(10, '600'),
          },
        },
        tooltip: commonTooltip(),
      },
    },
  })

  chartInstances.push(speciesHourlyLineChart)
}

async function renderCharts() {
  if (!props.data) {
    return
  }

  const requestId = ++renderRequestId

  try {
    await nextTick()

    if (requestId !== renderRequestId) {
      return
    }

    createCharts(props.data)
    emit('error', '')
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'No se pudieron renderizar las graficas.')
  }
}

watch(
  () => props.data,
  () => {
    renderCharts()
  },
)

onMounted(() => {
  renderCharts()
})

onBeforeUnmount(() => {
  renderRequestId += 1
  destroyCharts()
})
</script>

<template>
  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold text-slate-800">Top especies detectadas</h2>
    <div class="h-56 w-full sm:h-64 lg:h-72">
      <canvas ref="speciesChartCanvas" class="h-full w-full"></canvas>
    </div>
  </article>

  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold text-slate-800">Detecciones por hora (UTC)</h2>
    <div class="h-56 w-full sm:h-64 lg:h-72">
      <canvas ref="hourlyChartCanvas" class="h-full w-full"></canvas>
    </div>
  </article>

  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold text-slate-800">Detecciones por sensor</h2>
    <div class="h-56 w-full sm:h-64 lg:h-72">
      <canvas ref="sensorChartCanvas" class="h-full w-full"></canvas>
    </div>
  </article>

  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold text-slate-800">Tendencia diaria</h2>
    <div class="h-56 w-full sm:h-64 lg:h-72">
      <canvas ref="dailyChartCanvas" class="h-full w-full"></canvas>
    </div>
  </article>

  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="mb-1 text-base font-semibold text-slate-800">Distribucion horaria por especie (apilada)</h2>
    <p class="mb-2 text-xs text-slate-500">Top especies del filtro activo por franja horaria UTC</p>
    <div class="h-56 w-full sm:h-64 lg:h-72">
      <canvas ref="speciesHourlyStackedCanvas" class="h-full w-full"></canvas>
    </div>
  </article>

  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="mb-1 text-base font-semibold text-slate-800">Curvas horarias por especie</h2>
    <p class="mb-2 text-xs text-slate-500">Comparativa de actividad por especie y hora UTC</p>
    <div class="h-56 w-full sm:h-64 lg:h-72">
      <canvas ref="speciesHourlyLineCanvas" class="h-full w-full"></canvas>
    </div>
  </article>
</template>
