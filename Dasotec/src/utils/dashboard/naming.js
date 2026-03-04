export function prettifySpeciesName(speciesName) {
  return (speciesName || 'sin-especie').replaceAll('-', ' ')
}

export function prettifyStationName(stationName) {
  return (stationName || 'estacion-desconocida').replaceAll('-', ' ').replaceAll('_', ' ')
}

export function getStationKeyFromRow(row) {
  const stationName = (row?.station || row?.station_name || row?.sensor_name || '').trim()
  return stationName || 'estacion-desconocida'
}
