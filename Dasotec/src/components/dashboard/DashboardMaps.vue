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
const HEATMAP_PRESET = {
  gamma: 0.72,
  minWeight: 0.1,
  clipLowPercentile: 0.15,
  clipHighPercentile: 0.88,
  rankGamma: 0.9,
  rawWeight: 0.45,
  rankWeight: 0.55,
  baseBoost: 0.12,
  radius: 28,
  blur: 14,
}
const MIN_MARKER_RADIUS = 8
const MAX_MARKER_RADIUS = 14
const COLOR_STOPS = [
  { value: 0, color: '#2563eb' },
  { value: 0.25, color: '#06b6d4' },
  { value: 0.5, color: '#84cc16' },
  { value: 0.75, color: '#f59e0b' },
  { value: 1, color: '#b91c1c' },
]

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

function normalizeWeight(value, minValue, maxValue, preset) {
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isFinite(minValue) ||
    minValue <= 0 ||
    !Number.isFinite(maxValue) ||
    maxValue <= 0
  ) {
    return 0
  }

  if (maxValue === minValue) {
    return 0.7
  }

  const logMin = Math.log(minValue)
  const logMax = Math.log(maxValue)
  const logValue = Math.log(value)
  const normalizedLog = (logValue - logMin) / Math.max(logMax - logMin, Number.EPSILON)

  return Math.max(preset.minWeight, Math.min(normalizedLog ** preset.gamma, 1))
}

function normalizeByRank(value, sortedValues, preset) {
  if (!sortedValues.length) {
    return 0
  }

  if (sortedValues.length === 1) {
    return 1
  }

  let rankIndex = 0
  for (let index = 0; index < sortedValues.length; index += 1) {
    if (value >= sortedValues[index]) {
      rankIndex = index
    } else {
      break
    }
  }

  const rankRatio = rankIndex / (sortedValues.length - 1)
  return Math.max(0, Math.min(rankRatio ** preset.rankGamma, 1))
}

function toIntensity(value, minValue, maxValue, sortedValues, preset) {
  const rawIntensity = normalizeWeight(value, minValue, maxValue, preset)
  const rankIntensity = normalizeByRank(value, sortedValues, preset)

  return Math.max(
    preset.minWeight,
    Math.min(preset.baseBoost + rawIntensity * preset.rawWeight + rankIntensity * preset.rankWeight, 1),
  )
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

function getColorFromIntensity(intensity) {
  const clampedIntensity = Math.max(0, Math.min(intensity, 1))

  for (let index = 1; index < COLOR_STOPS.length; index += 1) {
    const leftStop = COLOR_STOPS[index - 1]
    const rightStop = COLOR_STOPS[index]

    if (clampedIntensity > rightStop.value) {
      continue
    }

    const segmentRange = rightStop.value - leftStop.value || Number.EPSILON
    const segmentT = (clampedIntensity - leftStop.value) / segmentRange
    return interpolateColor(leftStop.color, rightStop.color, segmentT)
  }

  return COLOR_STOPS[COLOR_STOPS.length - 1].color
}

function getSensorAverageConfidence(sensor) {
  if (!sensor.confidenceRows) {
    return 0
  }

  return sensor.confidenceSum / sensor.confidenceRows
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

function scaleMarkerRadius(intensity) {
  const clampedIntensity = Math.max(0, Math.min(intensity, 1))
  return MIN_MARKER_RADIUS + clampedIntensity * (MAX_MARKER_RADIUS - MIN_MARKER_RADIUS)
}

function buildMarkerIntensityMap(sensorPoints) {
  if (sensorPoints.length <= 1) {
    return new Map(sensorPoints.map((sensor) => [sensor.name, 1]))
  }

  const ordered = [...sensorPoints].sort(
    (left, right) => left.detections - right.detections || left.name.localeCompare(right.name),
  )
  const intensityBySensorName = new Map()

  for (let index = 0; index < ordered.length; index += 1) {
    const sensor = ordered[index]
    const rankNormalized = index / (ordered.length - 1)
    intensityBySensorName.set(sensor.name, rankNormalized)
  }

  return intensityBySensorName
}

function addSensorPins(mapInstance, sensorPoints, intensityBySensorName) {
  for (const sensor of sensorPoints) {
    const intensity = intensityBySensorName.get(sensor.name) ?? 0
    const fillColor = getColorFromIntensity(intensity)
    const popupContent = createSensorPopup(sensor)

    Leaflet.circleMarker([sensor.latitude, sensor.longitude], {
      radius: scaleMarkerRadius(intensity),
      color: '#ffffff',
      weight: 1.7,
      fillColor,
      fillOpacity: 0.86,
      opacity: 1,
    })
      .bindPopup(popupContent)
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
  const preset = HEATMAP_PRESET

  sensorsMapInstance = createBaseMap(sensorsMapRef.value, defaultCenter)

  const validDetections = sensorPoints
    .map((sensor) => sensor.detections)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right)
  const minDetections = Math.max(1, quantile(validDetections, preset.clipLowPercentile))
  const maxDetections = Math.max(minDetections + 1, quantile(validDetections, preset.clipHighPercentile))
  const markerIntensityBySensorName = buildMarkerIntensityMap(sensorPoints)

  const detectionHeatData = sensorPoints.map((sensor) => [
    sensor.latitude,
    sensor.longitude,
    toIntensity(sensor.detections, minDetections, maxDetections, validDetections, preset),
  ])

  Leaflet.heatLayer(detectionHeatData, {
    radius: preset.radius,
    blur: preset.blur,
    max: 0.55,
    maxZoom: 20,
    minOpacity: 0.42,
    gradient: {
      0.1: '#2563eb',
      0.24: '#06b6d4',
      0.42: '#84cc16',
      0.6: '#facc15',
      0.76: '#f97316',
      1.0: '#b91c1c',
    },
  }).addTo(sensorsMapInstance)

  addSensorPins(sensorsMapInstance, sensorPoints, markerIntensityBySensorName)
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
    <div class="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
      <span>Bajo</span>
      <div
        class="h-2 w-40 rounded-full border border-slate-300"
        style="background: linear-gradient(90deg, #2563eb 0%, #06b6d4 25%, #84cc16 50%, #f59e0b 75%, #b91c1c 100%)"
      ></div>
      <span>Alto</span>
    </div>
    <p class="mt-1 text-[11px] text-slate-500">Las bolitas marcan estaciones reales; la mancha es interpolación espacial.</p>
  </article>
</template>
