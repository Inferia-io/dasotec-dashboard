<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  selectedSpecies: {
    type: Array,
    default: () => [],
  },
  selectedStations: {
    type: Array,
    default: () => [],
  },
  startDate: {
    type: String,
    default: '',
  },
  endDate: {
    type: String,
    default: '',
  },
  minDate: {
    type: String,
    default: '',
  },
  maxDate: {
    type: String,
    default: '',
  },
  speciesOptions: {
    type: Array,
    default: () => [],
  },
  stationOptions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'update:selectedSpecies',
  'update:selectedStations',
  'update:startDate',
  'update:endDate',
])

const speciesDropdownRef = ref(null)
const stationDropdownRef = ref(null)
const isSpeciesDropdownOpen = ref(false)
const isStationDropdownOpen = ref(false)
const speciesSearchQuery = ref('')
const stationSearchQuery = ref('')

const selectedSpeciesCount = computed(() => props.selectedSpecies.length)
const selectedStationsCount = computed(() => props.selectedStations.length)
const normalizedSpeciesSearch = computed(() => speciesSearchQuery.value.trim().toLowerCase())
const normalizedStationSearch = computed(() => stationSearchQuery.value.trim().toLowerCase())

const filteredSpeciesOptions = computed(() => {
  if (!normalizedSpeciesSearch.value) {
    return props.speciesOptions
  }

  return props.speciesOptions.filter((option) =>
    option.label.toLowerCase().includes(normalizedSpeciesSearch.value) ||
      option.value.toLowerCase().includes(normalizedSpeciesSearch.value),
  )
})

const filteredStationOptions = computed(() => {
  if (!normalizedStationSearch.value) {
    return props.stationOptions
  }

  return props.stationOptions.filter((option) =>
    option.label.toLowerCase().includes(normalizedStationSearch.value) ||
      option.value.toLowerCase().includes(normalizedStationSearch.value),
  )
})

function createSelectionSummary(selectedValues, options, emptyLabel) {
  if (!selectedValues.length) {
    return emptyLabel
  }

  const selectedLabels = selectedValues
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter((label) => typeof label === 'string')

  if (!selectedLabels.length) {
    return emptyLabel
  }

  if (selectedLabels.length <= 2) {
    return selectedLabels.join(', ')
  }

  return `${selectedLabels[0]}, ${selectedLabels[1]} +${selectedLabels.length - 2}`
}

const selectedSpeciesSummary = computed(() => {
  return createSelectionSummary(props.selectedSpecies, props.speciesOptions, 'Todas las especies')
})

const selectedStationsSummary = computed(() => {
  return createSelectionSummary(props.selectedStations, props.stationOptions, 'Todas las estaciones')
})

function isSpeciesSelected(speciesName) {
  return props.selectedSpecies.includes(speciesName)
}

function isStationSelected(stationName) {
  return props.selectedStations.includes(stationName)
}

function toggleSpeciesDropdown() {
  isSpeciesDropdownOpen.value = !isSpeciesDropdownOpen.value
  if (isSpeciesDropdownOpen.value) {
    closeStationDropdown()
  }
}

function toggleStationDropdown() {
  isStationDropdownOpen.value = !isStationDropdownOpen.value
  if (isStationDropdownOpen.value) {
    closeSpeciesDropdown()
  }
}

function closeSpeciesDropdown() {
  isSpeciesDropdownOpen.value = false
  speciesSearchQuery.value = ''
}

function closeStationDropdown() {
  isStationDropdownOpen.value = false
  stationSearchQuery.value = ''
}

function toggleSpecies(speciesName, isChecked) {
  const nextSelectedSpecies = new Set(props.selectedSpecies)

  if (isChecked) {
    nextSelectedSpecies.add(speciesName)
  } else {
    nextSelectedSpecies.delete(speciesName)
  }

  emit('update:selectedSpecies', [...nextSelectedSpecies])
}

function toggleStation(stationName, isChecked) {
  const nextSelectedStations = new Set(props.selectedStations)

  if (isChecked) {
    nextSelectedStations.add(stationName)
  } else {
    nextSelectedStations.delete(stationName)
  }

  emit('update:selectedStations', [...nextSelectedStations])
}

function clearSpeciesSelection() {
  emit('update:selectedSpecies', [])
}

function clearStationSelection() {
  emit('update:selectedStations', [])
}

function selectAllSpecies() {
  emit(
    'update:selectedSpecies',
    props.speciesOptions.map((option) => option.value),
  )
}

function selectAllStations() {
  emit(
    'update:selectedStations',
    props.stationOptions.map((option) => option.value),
  )
}

function updateStartDate(event) {
  emit('update:startDate', event.target.value)
}

function updateEndDate(event) {
  emit('update:endDate', event.target.value)
}

function onDocumentPointerDown(event) {
  if (speciesDropdownRef.value && !speciesDropdownRef.value.contains(event.target)) {
    closeSpeciesDropdown()
  }

  if (stationDropdownRef.value && !stationDropdownRef.value.contains(event.target)) {
    closeStationDropdown()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
})
</script>

<template>
  <header
    class="grid gap-4 rounded-2xl border border-slate-300 bg-slate-50/95 px-4 py-3 shadow-md backdrop-blur md:px-5"
  >
    <div class="flex items-center gap-3">
      <span class="h-9 w-3 rounded-lg bg-gradient-to-b from-lime-400 to-green-700"></span>
      <div>
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Analitica operativa</p>
        <h1 class="mt-0.5 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">Dashboard de Murcielagos</h1>
      </div>
    </div>

    <div class="grid w-full items-end gap-2.5 md:grid-cols-2 xl:grid-cols-12">
      <div ref="speciesDropdownRef" class="relative z-[2200] flex min-w-0 flex-col gap-1 xl:col-span-4">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-bold text-slate-600">Especies (multiseleccion)</span>
          <span class="text-[11px] text-slate-500">
            {{ selectedSpeciesCount ? `${selectedSpeciesCount} seleccionada(s)` : 'Sin filtro' }}
          </span>
        </div>

        <button
          type="button"
          class="inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lime-300"
          @click="toggleSpeciesDropdown"
        >
          <span class="truncate">{{ selectedSpeciesSummary }}</span>
          <ChevronDown
            :size="16"
            class="shrink-0 text-slate-500 transition-transform"
            :class="isSpeciesDropdownOpen ? 'rotate-180' : ''"
          />
        </button>

        <div
          v-if="isSpeciesDropdownOpen"
          class="absolute left-0 top-full z-[2200] mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2 shadow-lg"
        >
          <div class="mb-2 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              class="text-[11px] font-semibold text-lime-700 hover:text-lime-800"
              @click="selectAllSpecies"
            >
              Seleccionar todas
            </button>
            <button
              type="button"
              class="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
              @click="clearSpeciesSelection"
            >
              Limpiar
            </button>
          </div>

          <div class="mb-2">
            <input
              v-model="speciesSearchQuery"
              type="search"
              placeholder="Buscar especie..."
              class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-lime-500"
            />
          </div>

          <div class="max-h-56 overflow-y-auto pr-1">
            <label
              v-for="option in filteredSpeciesOptions"
              :key="option.value"
              class="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                class="h-3.5 w-3.5 rounded border-slate-300 text-lime-600 focus:ring-lime-500"
                :checked="isSpeciesSelected(option.value)"
                @change="toggleSpecies(option.value, $event.target.checked)"
              />
              <span class="truncate">{{ option.label }} ({{ option.countLabel }})</span>
            </label>

            <p v-if="!filteredSpeciesOptions.length" class="px-1 py-2 text-[11px] text-slate-500">
              No hay coincidencias.
            </p>
          </div>
        </div>
      </div>

      <div ref="stationDropdownRef" class="relative z-[2200] flex min-w-0 flex-col gap-1 xl:col-span-4">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-bold text-slate-600">Estaciones (multiseleccion)</span>
          <span class="text-[11px] text-slate-500">
            {{ selectedStationsCount ? `${selectedStationsCount} seleccionada(s)` : 'Sin filtro' }}
          </span>
        </div>

        <button
          type="button"
          class="inline-flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-lime-300"
          @click="toggleStationDropdown"
        >
          <span class="truncate">{{ selectedStationsSummary }}</span>
          <ChevronDown
            :size="16"
            class="shrink-0 text-slate-500 transition-transform"
            :class="isStationDropdownOpen ? 'rotate-180' : ''"
          />
        </button>

        <div
          v-if="isStationDropdownOpen"
          class="absolute left-0 top-full z-[2200] mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-2 shadow-lg"
        >
          <div class="mb-2 flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              class="text-[11px] font-semibold text-lime-700 hover:text-lime-800"
              @click="selectAllStations"
            >
              Seleccionar todas
            </button>
            <button
              type="button"
              class="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
              @click="clearStationSelection"
            >
              Limpiar
            </button>
          </div>

          <div class="mb-2">
            <input
              v-model="stationSearchQuery"
              type="search"
              placeholder="Buscar estación..."
              class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-lime-500"
            />
          </div>

          <div class="max-h-56 overflow-y-auto pr-1">
            <label
              v-for="option in filteredStationOptions"
              :key="option.value"
              class="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                class="h-3.5 w-3.5 rounded border-slate-300 text-lime-600 focus:ring-lime-500"
                :checked="isStationSelected(option.value)"
                @change="toggleStation(option.value, $event.target.checked)"
              />
              <span class="truncate">{{ option.label }} ({{ option.countLabel }})</span>
            </label>

            <p v-if="!filteredStationOptions.length" class="px-1 py-2 text-[11px] text-slate-500">
              No hay coincidencias.
            </p>
          </div>
        </div>
      </div>

      <div class="flex min-w-0 flex-col gap-1 xl:col-span-2">
        <span class="text-xs font-bold text-slate-600">Desde</span>
        <label class="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-3 shadow-sm">
          <input
            :value="startDate"
            :min="minDate"
            :max="endDate || maxDate"
            type="date"
            class="w-full border-0 bg-transparent text-xs font-semibold text-slate-700 outline-none"
            @input="updateStartDate"
          />
        </label>
      </div>

      <div class="flex min-w-0 flex-col gap-1 xl:col-span-2">
        <span class="text-xs font-bold text-slate-600">Hasta</span>
        <label class="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-3 shadow-sm">
          <input
            :value="endDate"
            :min="startDate || minDate"
            :max="maxDate"
            type="date"
            class="w-full border-0 bg-transparent text-xs font-semibold text-slate-700 outline-none"
            @input="updateEndDate"
          />
        </label>
      </div>
    </div>
  </header>
</template>
