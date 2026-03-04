<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { prettifyStationName } from '../../utils/dashboardData'
import { numberFormatter } from '../../utils/dashboardFormatters'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['error'])

const sankeyContainerRef = ref(null)
let renderRequestId = 0
let plotlyPromise = null
let plotlyLib = null

function loadPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js-dist').then((module) => module.default || module)
  }

  return plotlyPromise
}

const stationLabels = computed(() => (props.data.sankeyStationLabels || []).map((label) => prettifyStationName(label)))
const speciesLabels = computed(() => props.data.sankeySpeciesLabels || [])
const sankeyLinks = computed(() => props.data.sankeyLinks || [])
const hasSankeyData = computed(
  () => stationLabels.value.length > 0 && speciesLabels.value.length > 0 && sankeyLinks.value.length > 0,
)

function destroyPlot() {
  if (!sankeyContainerRef.value || !plotlyLib?.purge) {
    return
  }

  plotlyLib.purge(sankeyContainerRef.value)
}

function buildNodeColors(stationCount, speciesCount) {
  return [
    ...Array.from({ length: stationCount }, () => 'rgba(101, 163, 13, 0.84)'),
    ...Array.from({ length: speciesCount }, () => 'rgba(30, 136, 229, 0.82)'),
  ]
}

function buildLinkColors(linkCount) {
  return Array.from({ length: linkCount }, () => 'rgba(148, 163, 184, 0.34)')
}

async function createSankeyPlot(PlotlyLib) {
  if (!sankeyContainerRef.value) {
    throw new Error('No se encontro el contenedor del diagrama de flujo.')
  }

  destroyPlot()

  const totalStations = stationLabels.value.length
  const totalSpecies = speciesLabels.value.length
  const nodeLabels = [...stationLabels.value, ...speciesLabels.value]

  const sources = []
  const targets = []
  const values = []

  for (const link of sankeyLinks.value) {
    const stationIndex = Number(link.stationIndex)
    const speciesIndex = Number(link.speciesIndex)
    const value = Number(link.value)

    if (
      !Number.isInteger(stationIndex) ||
      !Number.isInteger(speciesIndex) ||
      !Number.isFinite(value) ||
      value <= 0 ||
      stationIndex < 0 ||
      stationIndex >= totalStations ||
      speciesIndex < 0 ||
      speciesIndex >= totalSpecies
    ) {
      continue
    }

    sources.push(stationIndex)
    targets.push(totalStations + speciesIndex)
    values.push(value)
  }

  if (!values.length) {
    throw new Error('No hay enlaces suficientes para construir el Sankey.')
  }

  const trace = {
    type: 'sankey',
    arrangement: 'snap',
    node: {
      pad: 10,
      thickness: 15,
      label: nodeLabels,
      color: buildNodeColors(totalStations, totalSpecies),
      line: {
        color: 'rgba(71, 85, 105, 0.42)',
        width: 0.8,
      },
      hovertemplate: '%{label}<extra></extra>',
    },
    link: {
      source: sources,
      target: targets,
      value: values,
      color: buildLinkColors(values.length),
      hovertemplate: '%{source.label} -> %{target.label}<br>Detecciones: %{value}<extra></extra>',
    },
  }

  const layout = {
    autosize: true,
    margin: { l: 8, r: 8, t: 8, b: 8 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
      family: 'Manrope, Segoe UI, sans-serif',
      size: 10,
      color: '#475569',
    },
  }

  await PlotlyLib.newPlot(sankeyContainerRef.value, [trace], layout, {
    responsive: true,
    displayModeBar: false,
  })
}

async function renderSankey() {
  if (!hasSankeyData.value) {
    destroyPlot()
    emit('error', '')
    return
  }

  const requestId = ++renderRequestId

  try {
    await nextTick()
    if (requestId !== renderRequestId) {
      return
    }

    const PlotlyLib = await loadPlotly()

    if (requestId !== renderRequestId) {
      return
    }

    plotlyLib = PlotlyLib
    await createSankeyPlot(PlotlyLib)
    emit('error', '')
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'No se pudo renderizar el diagrama Sankey.')
  }
}

watch(
  () => props.data,
  () => {
    renderSankey()
  },
)

onMounted(() => {
  renderSankey()
})

onBeforeUnmount(() => {
  renderRequestId += 1
  destroyPlot()
})
</script>

<template>
  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h3 class="text-base font-semibold text-slate-800">Flujo estacion-especie</h3>
    <p class="mb-3 mt-1 text-xs text-slate-500">Relacion entre estaciones y especies mas detectadas del filtro activo.</p>

    <div v-if="hasSankeyData" class="h-[18rem] rounded-xl border border-slate-200 bg-white p-2 sm:h-[20rem] lg:h-[22rem]">
      <div ref="sankeyContainerRef" class="h-full w-full"></div>
    </div>

    <p v-else class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
      No hay suficientes datos para construir el flujo estacion-especie.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
      <span class="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2 py-1">
        <span class="h-2.5 w-2.5 rounded-full bg-lime-600"></span>
        <span>Estaciones</span>
      </span>
      <span class="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2 py-1">
        <span class="h-2.5 w-2.5 rounded-full bg-sky-600"></span>
        <span>Especies</span>
      </span>
      <span class="text-slate-500 sm:ml-auto">Peso de enlace: {{ numberFormatter.format(sankeyLinks.length) }} conexiones</span>
    </div>

    <p
      v-if="data.sankeyStationsTruncated || data.sankeySpeciesTruncated"
      class="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500"
    >
      <span v-if="data.sankeyStationsTruncated">Mostrando {{ stationLabels.length }} estaciones con mas detecciones.</span>
      <span v-if="data.sankeySpeciesTruncated" class="ml-1">
        Mostrando {{ speciesLabels.length }} especies con mas detecciones.
      </span>
    </p>
  </article>
</template>
