<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { percentFormatter, numberFormatter } from '../../utils/dashboardFormatters'
import { prettifySpeciesName } from '../../utils/dashboardData'

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
})

const rankedSpecies = computed(() => (props.data.speciesRanking || []).slice(0, 12))

const metadataBySpecies = ref({})
const metadataError = ref('')
const isLoadingMetadata = ref(false)

const wikidataCache = new Map()
let metadataRequestId = 0

function scientificNameFromKey(speciesKey) {
  return (speciesKey || '').replaceAll('-', ' ').trim()
}

function extractEntityImageUrl(entity) {
  const imageName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  if (typeof imageName !== 'string' || !imageName.length) {
    return ''
  }

  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageName)}?width=800`
}

function extractEntityCommonName(entity) {
  const vernacularClaims = entity?.claims?.P1843 || []
  const vernacularValue = vernacularClaims
    .map((claim) => claim?.mainsnak?.datavalue?.value)
    .find((value) => value?.language === 'es' || value?.language === 'en')

  return vernacularValue?.text || ''
}

function chooseBestSearchCandidate(searchResults, scientificName) {
  if (!Array.isArray(searchResults) || !searchResults.length) {
    return null
  }

  const normalizedTarget = scientificName.toLowerCase()
  return searchResults.find((item) => (item?.label || '').toLowerCase() === normalizedTarget) || searchResults[0]
}

async function fetchWikidataMetadata(speciesKey) {
  const scientificName = scientificNameFromKey(speciesKey)
  if (!scientificName) {
    return {
      description: '',
      commonName: '',
      imageUrl: '',
      wikidataUrl: '',
    }
  }

  const searchParams = new URLSearchParams({
    action: 'wbsearchentities',
    search: scientificName,
    language: 'en',
    type: 'item',
    limit: '6',
    format: 'json',
    origin: '*',
  })

  const searchResponse = await fetch(`https://www.wikidata.org/w/api.php?${searchParams.toString()}`)
  if (!searchResponse.ok) {
    throw new Error(`Wikidata search fallo (${searchResponse.status})`)
  }

  const searchData = await searchResponse.json()
  const bestCandidate = chooseBestSearchCandidate(searchData.search, scientificName)
  if (!bestCandidate?.id) {
    return {
      description: searchData.search?.[0]?.description || '',
      commonName: '',
      imageUrl: '',
      wikidataUrl: '',
    }
  }

  const entityParams = new URLSearchParams({
    action: 'wbgetentities',
    ids: bestCandidate.id,
    languages: 'es|en',
    props: 'labels|descriptions|claims',
    format: 'json',
    origin: '*',
  })

  const entityResponse = await fetch(`https://www.wikidata.org/w/api.php?${entityParams.toString()}`)
  if (!entityResponse.ok) {
    throw new Error(`Wikidata entity fallo (${entityResponse.status})`)
  }

  const entityData = await entityResponse.json()
  const entity = entityData.entities?.[bestCandidate.id]

  return {
    commonName: extractEntityCommonName(entity),
    description: entity?.descriptions?.es?.value || entity?.descriptions?.en?.value || bestCandidate.description || '',
    imageUrl: extractEntityImageUrl(entity),
    wikidataUrl: `https://www.wikidata.org/wiki/${bestCandidate.id}`,
  }
}

async function ensureMetadataLoaded() {
  const speciesList = rankedSpecies.value
  if (!speciesList.length) {
    metadataBySpecies.value = {}
    metadataError.value = ''
    return
  }

  const requestId = ++metadataRequestId
  isLoadingMetadata.value = true
  metadataError.value = ''

  try {
    const missingSpecies = speciesList.filter((species) => !wikidataCache.has(species.key))

    if (missingSpecies.length) {
      const results = await Promise.all(
        missingSpecies.map(async (species) => {
          try {
            const metadata = await fetchWikidataMetadata(species.key)
            return [species.key, metadata]
          } catch {
            return [
              species.key,
              {
                commonName: '',
                description: '',
                imageUrl: '',
                wikidataUrl: '',
              },
            ]
          }
        }),
      )

      if (requestId !== metadataRequestId) {
        return
      }

      for (const [key, metadata] of results) {
        wikidataCache.set(key, metadata)
      }
    }

    if (requestId !== metadataRequestId) {
      return
    }

    const nextMetadata = {}
    for (const species of speciesList) {
      nextMetadata[species.key] = wikidataCache.get(species.key) || null
    }

    metadataBySpecies.value = nextMetadata
  } catch {
    if (requestId === metadataRequestId) {
      metadataError.value = 'No se pudo cargar la metadata de Wikidata para todas las especies.'
    }
  } finally {
    if (requestId === metadataRequestId) {
      isLoadingMetadata.value = false
    }
  }
}

watch(
  rankedSpecies,
  () => {
    ensureMetadataLoaded()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  metadataRequestId += 1
})

function formatConfidence(rawConfidence) {
  if (!Number.isFinite(rawConfidence) || rawConfidence <= 0) {
    return 'n/d'
  }

  const normalized = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence
  return percentFormatter.format(Math.max(0, Math.min(normalized, 1)))
}
</script>

<template>
  <div class="min-w-0">
    <p v-if="metadataError" class="mb-2 text-xs font-semibold text-amber-700">{{ metadataError }}</p>

    <div v-if="rankedSpecies.length" class="max-h-[65vh] space-y-2 overflow-auto pr-1 lg:max-h-[760px]">
      <article
        v-for="species in rankedSpecies"
        :key="species.key"
        class="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-3"
      >
        <div class="relative h-[72px] w-[72px] overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-[88px] sm:w-[88px]">
          <img
            v-if="metadataBySpecies[species.key]?.imageUrl"
            :src="metadataBySpecies[species.key].imageUrl"
            :alt="prettifySpeciesName(species.key)"
            class="h-full w-full object-cover object-center"
            loading="lazy"
          />
          <div v-else class="flex h-full w-full items-center justify-center text-[11px] font-semibold text-slate-500">
            Sin imagen
          </div>

          <span class="absolute left-1 top-1 rounded-full bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            #{{ species.rank }}
          </span>
        </div>

        <div class="min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-xs font-semibold text-slate-800 sm:text-sm">{{ prettifySpeciesName(species.key) }}</p>
              <p class="truncate text-[11px] italic text-slate-500">{{ scientificNameFromKey(species.key) }}</p>
            </div>

            <a
              v-if="metadataBySpecies[species.key]?.wikidataUrl"
              :href="metadataBySpecies[species.key].wikidataUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 text-[11px] font-semibold text-lime-700 hover:text-lime-800"
            >
              Wikidata
            </a>
          </div>

          <p v-if="metadataBySpecies[species.key]?.commonName" class="mt-0.5 truncate text-[11px] text-slate-600">
            {{ metadataBySpecies[species.key].commonName }}
          </p>

          <p
            class="mt-1 text-[11px] leading-snug text-slate-500"
            style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden"
          >
            {{ metadataBySpecies[species.key]?.description || 'Sin descripcion disponible en Wikidata.' }}
          </p>

          <div class="mt-1.5 flex flex-wrap gap-1 text-[10px] text-slate-600">
            <span class="rounded-full bg-slate-100 px-1.5 py-0.5">{{ numberFormatter.format(species.detections) }} det.</span>
            <span class="rounded-full bg-slate-100 px-1.5 py-0.5">{{ percentFormatter.format(species.share) }}</span>
            <span class="rounded-full bg-slate-100 px-1.5 py-0.5">{{ numberFormatter.format(species.stationCount) }} est.</span>
            <span class="rounded-full bg-slate-100 px-1.5 py-0.5">{{ formatConfidence(species.averageConfidence) }}</span>
          </div>
        </div>
      </article>
    </div>

    <p v-else class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
      No hay especies para mostrar con los filtros actuales.
    </p>

    <p v-if="isLoadingMetadata" class="mt-2 text-[11px] text-slate-500">Cargando imagenes y metadata de Wikidata...</p>
  </div>
</template>
