import { getStationKeyFromRow } from './naming'

function parseTimestampMs(value) {
  const timestamp = Number.parseInt(value, 10)
  return Number.isFinite(timestamp) ? timestamp : Number.NaN
}

function parseDateStartMs(dateInput) {
  if (!dateInput) {
    return Number.NaN
  }

  const startMs = Date.parse(`${dateInput}T00:00:00.000Z`)
  return Number.isFinite(startMs) ? startMs : Number.NaN
}

function parseDateEndMs(dateInput) {
  if (!dateInput) {
    return Number.NaN
  }

  const endMs = Date.parse(`${dateInput}T23:59:59.999Z`)
  return Number.isFinite(endMs) ? endMs : Number.NaN
}

export function getTimestampBounds(rows) {
  let minTimestamp = Number.POSITIVE_INFINITY
  let maxTimestamp = Number.NEGATIVE_INFINITY

  for (const row of rows) {
    const timestamp = parseTimestampMs(row.timestamp_ms)
    if (!Number.isFinite(timestamp)) {
      continue
    }

    if (timestamp < minTimestamp) {
      minTimestamp = timestamp
    }

    if (timestamp > maxTimestamp) {
      maxTimestamp = timestamp
    }
  }

  return {
    minTimestamp: Number.isFinite(minTimestamp) ? minTimestamp : Number.NaN,
    maxTimestamp: Number.isFinite(maxTimestamp) ? maxTimestamp : Number.NaN,
  }
}

export function getFilteredRows(rows, filters = {}) {
  const {
    speciesFilter = 'all',
    stationFilter = 'all',
    startDate = '',
    endDate = '',
  } = filters

  const normalizedSpeciesFilter = Array.isArray(speciesFilter)
    ? speciesFilter.filter((speciesName) => typeof speciesName === 'string' && speciesName.length > 0)
    : speciesFilter

  const hasSpeciesFilter = Array.isArray(normalizedSpeciesFilter)
    ? normalizedSpeciesFilter.length > 0
    : normalizedSpeciesFilter !== 'all'

  const normalizedStationFilter = Array.isArray(stationFilter)
    ? stationFilter.filter((stationName) => typeof stationName === 'string' && stationName.length > 0)
    : stationFilter

  const hasStationFilter = Array.isArray(normalizedStationFilter)
    ? normalizedStationFilter.length > 0
    : normalizedStationFilter !== 'all'

  const startTimestamp = parseDateStartMs(startDate)
  const endTimestamp = parseDateEndMs(endDate)
  const hasTemporalFilter = Number.isFinite(startTimestamp) || Number.isFinite(endTimestamp)

  return rows.filter((row) => {
    const speciesName = row.specie || 'sin-especie'
    const stationName = getStationKeyFromRow(row)

    if (hasSpeciesFilter) {
      if (Array.isArray(normalizedSpeciesFilter)) {
        if (!normalizedSpeciesFilter.includes(speciesName)) {
          return false
        }
      } else if (speciesName !== normalizedSpeciesFilter) {
        return false
      }
    }

    if (hasStationFilter) {
      if (Array.isArray(normalizedStationFilter)) {
        if (!normalizedStationFilter.includes(stationName)) {
          return false
        }
      } else if (stationName !== normalizedStationFilter) {
        return false
      }
    }

    if (!hasTemporalFilter) {
      return true
    }

    const timestamp = parseTimestampMs(row.timestamp_ms)
    if (!Number.isFinite(timestamp)) {
      return false
    }

    if (Number.isFinite(startTimestamp) && timestamp < startTimestamp) {
      return false
    }

    if (Number.isFinite(endTimestamp) && timestamp > endTimestamp) {
      return false
    }

    return true
  })
}
