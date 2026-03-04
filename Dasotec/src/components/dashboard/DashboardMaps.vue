<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { numberFormatter, percentFormatter } from '../../utils/dashboardFormatters'
import Leaflet from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['error'])

const sensorsMapRef = ref(null)

let sensorsMapInstance = null
let renderRequestId = 0

function destroyMaps() {
  if (sensorsMapInstance) {
    sensorsMapInstance.remove()
    sensorsMapInstance = null
  }
}

function createBaseMap(container, defaultCenter) {
  const map = Leaflet.map(container, {
    zoomControl: true,
    scrollWheelZoom: false,
  }).setView(defaultCenter, 12)

  Leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(map)

  return map
}

function getSensorAverageConfidence(sensor) {
  if (!sensor.confidenceRows) {
    return 0
  }

  return sensor.confidenceSum / sensor.confidenceRows
}

function normalizeWeight(value, maxValue) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maxValue) || maxValue <= 0) {
    return 0
  }

  return Math.min(value / maxValue, 1)
}

function formatConfidence(rawConfidence) {
  if (!Number.isFinite(rawConfidence) || rawConfidence <= 0) {
    return 'n/d'
  }

  const normalized = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence
  return percentFormatter.format(Math.max(0, Math.min(normalized, 1)))
}

function createSensorPopup(sensor) {
  const averageConfidence = getSensorAverageConfidence(sensor)

  return `<strong>${sensor.name}</strong><br/>Detecciones: ${numberFormatter.format(
    sensor.detections,
  )}<br/>Especies: ${sensor.species.size}<br/>Confianza media: ${formatConfidence(averageConfidence)}`
}

function addSensorPins(mapInstance, sensorPoints) {
  for (const sensor of sensorPoints) {
    Leaflet.circleMarker([sensor.latitude, sensor.longitude], {
      radius: 4,
      color: '#ffffff',
      weight: 1,
      fillColor: '#1f2937',
      fillOpacity: 0.5,
      opacity: 0.9,
    })
      .bindPopup(createSensorPopup(sensor))
      .addTo(mapInstance)
  }
}

function fitMapToSensorBounds(mapInstance, sensorPoints) {
  if (!sensorPoints.length) {
    return
  }

  const bounds = Leaflet.latLngBounds(sensorPoints.map((sensor) => [sensor.latitude, sensor.longitude]))

  if (sensorPoints.length === 1) {
    mapInstance.setView(bounds.getCenter(), 13)
  } else {
    mapInstance.fitBounds(bounds.pad(0.16))
  }
}

function buildMaps(data) {
  destroyMaps()

  if (!sensorsMapRef.value) {
    return
  }

  const defaultCenter = [37.96, -0.88]
  const sensorPoints = data.sensorPoints

  sensorsMapInstance = createBaseMap(sensorsMapRef.value, defaultCenter)

  const maxDetections = Math.max(...sensorPoints.map((sensor) => sensor.detections), 1)

  const detectionHeatData = sensorPoints.map((sensor) => [
    sensor.latitude,
    sensor.longitude,
    normalizeWeight(sensor.detections, maxDetections),
  ])

  Leaflet.heatLayer(detectionHeatData, {
    radius: 34,
    blur: 24,
    maxZoom: 17,
    minOpacity: 0.28,
    gradient: {
      0.2: '#d9f99d',
      0.45: '#a3e635',
      0.7: '#65a30d',
      1.0: '#365314',
    },
  }).addTo(sensorsMapInstance)

  addSensorPins(sensorsMapInstance, sensorPoints)

  fitMapToSensorBounds(sensorsMapInstance, sensorPoints)
}

async function renderMaps() {
  if (!props.data) {
    return
  }

  const requestId = ++renderRequestId

  try {
    await nextTick()
    if (requestId !== renderRequestId) {
      return
    }

    buildMaps(props.data)
    emit('error', '')
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'No se pudieron renderizar los mapas de calor.')
  }
}

watch(
  () => props.data,
  () => {
    renderMaps()
  },
)

onMounted(() => {
  renderMaps()
})

onBeforeUnmount(() => {
  renderRequestId += 1
  destroyMaps()
})
</script>

<template>
  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm">
    <h2 class="mb-3 text-base font-semibold text-slate-800">Mapa de calor de detecciones</h2>
    <div class="rounded-xl border border-slate-200 bg-white p-1">
      <div ref="sensorsMapRef" class="h-[18rem] w-full overflow-hidden rounded-lg sm:h-[21rem] lg:h-[24rem] 2xl:h-[26rem]"></div>
    </div>
  </article>
</template>
