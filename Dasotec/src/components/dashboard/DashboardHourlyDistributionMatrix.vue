<script setup>
import { computed } from 'vue'

import { numberFormatter } from '../../utils/dashboardFormatters'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const hourLabels = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))

const rows = computed(() => {
  const series = props.data.speciesHourlyHeatmapSeries || props.data.speciesHourlySeries || []

  return series.map((item) => {
    const values = Array.isArray(item.values) ? item.values : Array(24).fill(0)
    const total = Number.isFinite(item.total) ? item.total : values.reduce((sum, value) => sum + (value || 0), 0)

    return {
      speciesName: item.speciesName || item.label || 'sin-especie',
      label: item.label || item.speciesName || 'Sin especie',
      total,
      values,
    }
  })
})

const hasRows = computed(() => rows.value.length > 0)
const maxTotal = computed(() => Math.max(1, ...rows.value.map((row) => row.total)))
const maxCellValue = computed(() =>
  Math.max(
    1,
    ...rows.value.flatMap((row) => row.values).map((value) => (Number.isFinite(value) ? value : 0)),
  ),
)

function getBarWidth(total) {
  if (!Number.isFinite(total) || total <= 0) {
    return '0%'
  }

  return `${Math.max(3, (total / maxTotal.value) * 100)}%`
}

function getCellStyle(rawValue) {
  const value = Number(rawValue)
  if (!Number.isFinite(value) || value <= 0) {
    return {
      backgroundColor: '#f8fafc',
      color: '#94a3b8',
      borderColor: '#e2e8f0',
    }
  }

  const normalized = Math.min(Math.max(value / maxCellValue.value, 0), 1)
  const contrasted = normalized ** 0.65
  const lightness = 96 - contrasted * 58

  return {
    backgroundColor: `hsl(138 44% ${lightness}%)`,
    color: contrasted > 0.6 ? '#ffffff' : '#1f2937',
    borderColor: contrasted > 0.72 ? 'rgba(20, 83, 45, 0.45)' : 'rgba(148, 163, 184, 0.35)',
  }
}

function formatCellValue(rawValue) {
  const value = Number(rawValue)
  if (!Number.isFinite(value) || value <= 0) {
    return ''
  }

  return numberFormatter.format(value)
}
</script>

<template>
  <article class="min-w-0 rounded-2xl border border-slate-300 bg-slate-50 p-4 shadow-sm lg:col-span-2 2xl:col-span-3">
    <h2 class="mb-1 text-base font-semibold text-slate-800">Distribucion horaria por especie</h2>
    <p class="text-xs text-slate-500">Top 10 especies del filtro activo: detecciones totales y actividad por hora UTC.</p>

    <div v-if="hasRows" class="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
      <div class="min-w-[980px]">
        <div class="grid grid-cols-[240px_repeat(24,minmax(24px,1fr))] gap-1">
          <div class="rounded bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-700">Especie / Total</div>
          <div
            v-for="hourLabel in hourLabels"
            :key="`hour-header-${hourLabel}`"
            class="rounded bg-slate-100 py-1.5 text-center text-[10px] font-semibold text-slate-600"
          >
            {{ hourLabel }}
          </div>

          <template v-for="row in rows" :key="row.speciesName">
            <div class="rounded border border-slate-200 bg-slate-50 px-2 py-1">
              <div class="mb-1 flex items-center justify-between gap-2">
                <span class="truncate text-[11px] font-semibold text-slate-700" :title="row.label">{{ row.label }}</span>
                <span class="shrink-0 text-[10px] font-semibold text-slate-500">{{ numberFormatter.format(row.total) }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-200/80">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-lime-400 via-emerald-500 to-emerald-700"
                  :style="{ width: getBarWidth(row.total) }"
                ></div>
              </div>
            </div>

            <div
              v-for="(value, hourIndex) in row.values"
              :key="`cell-${row.speciesName}-${hourIndex}`"
              class="flex h-8 items-center justify-center rounded border text-[10px] font-semibold"
              :style="getCellStyle(value)"
              :title="`${row.label} · ${hourLabels[hourIndex]}:00 UTC · ${numberFormatter.format(value || 0)} detecciones`"
            >
              {{ formatCellValue(value) }}
            </div>
          </template>
        </div>
      </div>
    </div>

    <p v-else class="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
      No hay datos suficientes para construir la distribucion horaria por especie.
    </p>

    <div class="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
      <span>Baja actividad</span>
      <span class="h-2 w-44 rounded border border-slate-300 bg-gradient-to-r from-emerald-50 to-emerald-800"></span>
      <span>Alta actividad</span>
    </div>
  </article>
</template>
