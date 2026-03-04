import { prettifySpeciesName } from './naming'

const MAX_BETA_STATIONS = 20
const MAX_SANKEY_STATIONS = 10
const MAX_SANKEY_SPECIES = 10
const DAY_MS = 24 * 60 * 60 * 1000
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function buildBetaDistanceMatrices(sensors) {
  const orderedSensors = [...sensors].sort(
    (left, right) => right.detections - left.detections || left.name.localeCompare(right.name),
  )

  const matrixSensors = orderedSensors.slice(0, MAX_BETA_STATIONS)
  const matrixSize = matrixSensors.length
  const jaccardMatrix = Array.from({ length: matrixSize }, () => Array(matrixSize).fill(0))
  const sorensenMatrix = Array.from({ length: matrixSize }, () => Array(matrixSize).fill(0))

  for (let rowIndex = 0; rowIndex < matrixSize; rowIndex += 1) {
    const leftSensor = matrixSensors[rowIndex]

    for (let colIndex = rowIndex; colIndex < matrixSize; colIndex += 1) {
      const rightSensor = matrixSensors[colIndex]

      let sharedSpecies = 0
      for (const speciesName of leftSensor.species) {
        if (rightSensor.species.has(speciesName)) {
          sharedSpecies += 1
        }
      }

      const onlyLeft = leftSensor.species.size - sharedSpecies
      const onlyRight = rightSensor.species.size - sharedSpecies
      const union = sharedSpecies + onlyLeft + onlyRight
      const sorensenDenominator = 2 * sharedSpecies + onlyLeft + onlyRight

      const jaccardDistance = union ? 1 - sharedSpecies / union : 0
      const sorensenDistance = sorensenDenominator ? 1 - (2 * sharedSpecies) / sorensenDenominator : 0

      jaccardMatrix[rowIndex][colIndex] = jaccardDistance
      jaccardMatrix[colIndex][rowIndex] = jaccardDistance
      sorensenMatrix[rowIndex][colIndex] = sorensenDistance
      sorensenMatrix[colIndex][rowIndex] = sorensenDistance
    }
  }

  return {
    betaStationLabels: matrixSensors.map((sensor) => sensor.name),
    betaJaccardMatrix: jaccardMatrix,
    betaSorensenMatrix: sorensenMatrix,
    betaMatrixUsedStations: matrixSensors.length,
    betaMatrixTotalStations: orderedSensors.length,
    betaMatrixTruncated: orderedSensors.length > matrixSensors.length,
  }
}

function calculateDiversityIndexesFromCounts(counts, total) {
  if (!Number.isFinite(total) || total <= 0) {
    return {
      shannonIndex: 0,
      shannonWienerIndex: 0,
      simpsonDominance: 0,
      simpsonIndex: 0,
      effectiveSpeciesNumber: 0,
      pielouEvenness: 0,
    }
  }

  let shannonIndex = 0
  let simpsonDominance = 0

  for (const count of counts.values()) {
    if (!Number.isFinite(count) || count <= 0) {
      continue
    }

    const relativeAbundance = count / total
    shannonIndex -= relativeAbundance * Math.log(relativeAbundance)
    simpsonDominance += relativeAbundance * relativeAbundance
  }

  const richness = counts.size
  const pielouEvenness = richness > 1 ? shannonIndex / Math.log(richness) : 0

  return {
    shannonIndex,
    shannonWienerIndex: shannonIndex,
    simpsonDominance,
    simpsonIndex: 1 - simpsonDominance,
    effectiveSpeciesNumber: Math.exp(shannonIndex),
    pielouEvenness: Math.max(0, Math.min(pielouEvenness, 1)),
  }
}

function calculatePairwiseBetaDistances(leftSpeciesSet, rightSpeciesSet) {
  let sharedSpecies = 0
  for (const speciesName of leftSpeciesSet) {
    if (rightSpeciesSet.has(speciesName)) {
      sharedSpecies += 1
    }
  }

  const onlyLeft = leftSpeciesSet.size - sharedSpecies
  const onlyRight = rightSpeciesSet.size - sharedSpecies
  const union = sharedSpecies + onlyLeft + onlyRight
  const sorensenDenominator = 2 * sharedSpecies + onlyLeft + onlyRight

  return {
    jaccardDistance: union ? 1 - sharedSpecies / union : 0,
    sorensenDistance: sorensenDenominator ? 1 - (2 * sharedSpecies) / sorensenDenominator : 0,
  }
}

function buildStationBetaTurnoverMap(sensors) {
  const turnoverByStation = new Map()

  if (sensors.length <= 1) {
    for (const sensor of sensors) {
      turnoverByStation.set(sensor.name, {
        betaMeanJaccard: 0,
        betaMeanSorensen: 0,
        betaTurnoverIndex: 0,
      })
    }
    return turnoverByStation
  }

  const distanceAccumulator = sensors.map(() => ({
    jaccardSum: 0,
    sorensenSum: 0,
    comparisons: 0,
  }))

  for (let leftIndex = 0; leftIndex < sensors.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sensors.length; rightIndex += 1) {
      const distances = calculatePairwiseBetaDistances(sensors[leftIndex].species, sensors[rightIndex].species)

      distanceAccumulator[leftIndex].jaccardSum += distances.jaccardDistance
      distanceAccumulator[leftIndex].sorensenSum += distances.sorensenDistance
      distanceAccumulator[leftIndex].comparisons += 1

      distanceAccumulator[rightIndex].jaccardSum += distances.jaccardDistance
      distanceAccumulator[rightIndex].sorensenSum += distances.sorensenDistance
      distanceAccumulator[rightIndex].comparisons += 1
    }
  }

  sensors.forEach((sensor, sensorIndex) => {
    const accumulator = distanceAccumulator[sensorIndex]
    const comparisons = accumulator.comparisons
    const betaMeanJaccard = comparisons ? accumulator.jaccardSum / comparisons : 0
    const betaMeanSorensen = comparisons ? accumulator.sorensenSum / comparisons : 0

    turnoverByStation.set(sensor.name, {
      betaMeanJaccard,
      betaMeanSorensen,
      betaTurnoverIndex: (betaMeanJaccard + betaMeanSorensen) / 2,
    })
  })

  return turnoverByStation
}

function dayKeyToUtcTimestamp(dayKey) {
  if (!dayKey) {
    return Number.NaN
  }

  const timestamp = Date.parse(`${dayKey}T00:00:00.000Z`)
  return Number.isFinite(timestamp) ? timestamp : Number.NaN
}

function buildStationTrendMap(sensors, minTimestamp, maxTimestamp) {
  const trendByStation = new Map()

  if (!Number.isFinite(minTimestamp) || !Number.isFinite(maxTimestamp) || maxTimestamp <= minTimestamp) {
    for (const sensor of sensors) {
      trendByStation.set(sensor.name, {
        trendLabel: 'stable',
        trendScore: 0,
      })
    }

    return trendByStation
  }

  const midpointTimestamp = minTimestamp + (maxTimestamp - minTimestamp) / 2
  const firstHalfDays = Math.max(1, Math.ceil((midpointTimestamp - minTimestamp + 1) / DAY_MS))
  const secondHalfDays = Math.max(1, Math.ceil((maxTimestamp - midpointTimestamp) / DAY_MS))

  for (const sensor of sensors) {
    let firstHalfDetections = 0
    let secondHalfDetections = 0

    for (const [dayKey, dayCount] of sensor.dailyDetections.entries()) {
      const dayTimestamp = dayKeyToUtcTimestamp(dayKey)
      if (!Number.isFinite(dayTimestamp) || !Number.isFinite(dayCount) || dayCount <= 0) {
        continue
      }

      if (dayTimestamp <= midpointTimestamp) {
        firstHalfDetections += dayCount
      } else {
        secondHalfDetections += dayCount
      }
    }

    const firstHalfRate = firstHalfDetections / firstHalfDays
    const secondHalfRate = secondHalfDetections / secondHalfDays
    const trendScore = (secondHalfRate - firstHalfRate) / Math.max(firstHalfRate, 0.001)

    let trendLabel = 'stable'
    if (trendScore > 0.15) {
      trendLabel = 'up'
    } else if (trendScore < -0.15) {
      trendLabel = 'down'
    }

    trendByStation.set(sensor.name, {
      trendLabel,
      trendScore: Number.isFinite(trendScore) ? trendScore : 0,
    })
  }

  return trendByStation
}

function buildCommonSpeciesSet(globalSpeciesCounts) {
  const orderedSpecies = [...globalSpeciesCounts.entries()].sort((left, right) => right[1] - left[1])
  if (!orderedSpecies.length) {
    return new Set()
  }

  const commonSpeciesCount = Math.max(1, Math.ceil(orderedSpecies.length * 0.3))
  return new Set(orderedSpecies.slice(0, commonSpeciesCount).map(([speciesName]) => speciesName))
}

function buildStationRanking(sensors, globalSpeciesCounts, totalDetections, minTimestamp, maxTimestamp) {
  const commonSpeciesSet = buildCommonSpeciesSet(globalSpeciesCounts)
  const turnoverByStation = buildStationBetaTurnoverMap(sensors)
  const trendByStation = buildStationTrendMap(sensors, minTimestamp, maxTimestamp)

  return [...sensors]
    .sort((left, right) => right.detections - left.detections || right.species.size - left.species.size)
    .map((sensor, index) => {
      const diversity = calculateDiversityIndexesFromCounts(sensor.speciesCounts, sensor.detections)
      const turnover = turnoverByStation.get(sensor.name) || {
        betaMeanJaccard: 0,
        betaMeanSorensen: 0,
        betaTurnoverIndex: 0,
      }
      const trend = trendByStation.get(sensor.name) || {
        trendLabel: 'stable',
        trendScore: 0,
      }
      let conservationPriorityIndex = 0
      let commonForestAvifaunaIndex = 0

      for (const [speciesName, stationSpeciesDetections] of sensor.speciesCounts.entries()) {
        if (!Number.isFinite(stationSpeciesDetections) || stationSpeciesDetections <= 0) {
          continue
        }

        const stationRelativeAbundance = stationSpeciesDetections / sensor.detections
        const globalSpeciesDetections = globalSpeciesCounts.get(speciesName) || 0
        const globalRelativeAbundance = totalDetections > 0 ? globalSpeciesDetections / totalDetections : 0
        const rarityWeight = 1 - globalRelativeAbundance

        conservationPriorityIndex += stationRelativeAbundance * rarityWeight

        if (commonSpeciesSet.has(speciesName)) {
          commonForestAvifaunaIndex += stationRelativeAbundance
        }
      }

      return {
        rank: index + 1,
        name: sensor.name,
        detections: sensor.detections,
        richness: sensor.species.size,
        averageConfidence: sensor.confidenceRows ? sensor.confidenceSum / sensor.confidenceRows : 0,
        shannonIndex: diversity.shannonIndex,
        shannonWienerIndex: diversity.shannonWienerIndex,
        simpsonDominance: diversity.simpsonDominance,
        simpsonIndex: diversity.simpsonIndex,
        pielouEvenness: diversity.pielouEvenness,
        effectiveSpeciesNumber: diversity.effectiveSpeciesNumber,
        betaMeanJaccard: turnover.betaMeanJaccard,
        betaMeanSorensen: turnover.betaMeanSorensen,
        betaTurnoverIndex: turnover.betaTurnoverIndex,
        conservationPriorityIndex: Math.max(0, Math.min(conservationPriorityIndex, 1)),
        commonForestAvifaunaIndex: Math.max(0, Math.min(commonForestAvifaunaIndex, 1)),
        trendLabel: trend.trendLabel,
        trendScore: trend.trendScore,
      }
    })
}

function buildStationSpeciesSankey(sensors, topSpeciesEntries) {
  const orderedStations = [...sensors].sort(
    (left, right) => right.detections - left.detections || left.name.localeCompare(right.name),
  )
  const stationNodes = orderedStations.slice(0, MAX_SANKEY_STATIONS)
  const topSpeciesNodes = topSpeciesEntries.slice(0, MAX_SANKEY_SPECIES)
  const speciesKeyList = topSpeciesNodes.map(([speciesName]) => speciesName)
  const speciesIndexByName = new Map(speciesKeyList.map((speciesName, index) => [speciesName, index]))
  const links = []

  for (let stationIndex = 0; stationIndex < stationNodes.length; stationIndex += 1) {
    const station = stationNodes[stationIndex]

    for (const [speciesName, count] of station.speciesCounts.entries()) {
      const speciesIndex = speciesIndexByName.get(speciesName)
      if (speciesIndex == null || !Number.isFinite(count) || count <= 0) {
        continue
      }

      links.push({
        stationIndex,
        speciesIndex,
        value: count,
      })
    }
  }

  links.sort((left, right) => right.value - left.value)

  return {
    sankeyStationLabels: stationNodes.map((station) => station.name),
    sankeySpeciesKeys: speciesKeyList,
    sankeySpeciesLabels: speciesKeyList.map((speciesName) => prettifySpeciesName(speciesName)),
    sankeyLinks: links,
    sankeyStationsTruncated: orderedStations.length > stationNodes.length,
    sankeySpeciesTruncated: topSpeciesEntries.length > topSpeciesNodes.length,
  }
}

export function aggregateRows(rows) {
  const speciesCount = new Map()
  const speciesStats = new Map()
  const speciesHourlyCount = new Map()
  const speciesMonthlyCount = new Map()
  const sensorCount = new Map()
  const dailyCount = new Map()
  const hourlyCount = Array(24).fill(0)

  let confidenceSum = 0
  let confidenceRows = 0
  let minTimestamp = Number.POSITIVE_INFINITY
  let maxTimestamp = Number.NEGATIVE_INFINITY

  for (const row of rows) {
    const sensorName = row.sensor_name || 'sensor-desconocido'
    const speciesName = row.specie || 'sin-especie'
    const confidence = Number.parseFloat(row.confidence)
    const latitude = Number.parseFloat(row.latitude)
    const longitude = Number.parseFloat(row.longitude)
    const timestamp = Number.parseInt(row.timestamp_ms, 10)

    speciesCount.set(speciesName, (speciesCount.get(speciesName) || 0) + 1)

    if (!speciesStats.has(speciesName)) {
      speciesStats.set(speciesName, {
        key: speciesName,
        detections: 0,
        stations: new Set(),
        confidenceSum: 0,
        confidenceRows: 0,
      })
    }

    const speciesStat = speciesStats.get(speciesName)
    speciesStat.detections += 1
    speciesStat.stations.add(sensorName)

    if (!speciesHourlyCount.has(speciesName)) {
      speciesHourlyCount.set(speciesName, Array(24).fill(0))
    }

    if (!speciesMonthlyCount.has(speciesName)) {
      speciesMonthlyCount.set(speciesName, Array(12).fill(0))
    }

    if (!sensorCount.has(sensorName)) {
      sensorCount.set(sensorName, {
        name: sensorName,
        detections: 0,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        species: new Set(),
        speciesCounts: new Map(),
        dailyDetections: new Map(),
        confidenceSum: 0,
        confidenceRows: 0,
      })
    }

    const sensor = sensorCount.get(sensorName)
    sensor.detections += 1
    sensor.species.add(speciesName)
    sensor.speciesCounts.set(speciesName, (sensor.speciesCounts.get(speciesName) || 0) + 1)

    if (Number.isFinite(latitude) && Number.isFinite(longitude) && sensor.latitude == null && sensor.longitude == null) {
      sensor.latitude = latitude
      sensor.longitude = longitude
    }

    if (Number.isFinite(confidence)) {
      confidenceSum += confidence
      confidenceRows += 1
      sensor.confidenceSum += confidence
      sensor.confidenceRows += 1
      speciesStat.confidenceSum += confidence
      speciesStat.confidenceRows += 1
    }

    if (Number.isFinite(timestamp)) {
      if (timestamp < minTimestamp) {
        minTimestamp = timestamp
      }

      if (timestamp > maxTimestamp) {
        maxTimestamp = timestamp
      }

      const timestampDate = new Date(timestamp)
      if (!Number.isNaN(timestampDate.getTime())) {
        const utcHour = timestampDate.getUTCHours()
        const utcMonth = timestampDate.getUTCMonth()
        hourlyCount[utcHour] += 1
        speciesHourlyCount.get(speciesName)[utcHour] += 1
        speciesMonthlyCount.get(speciesName)[utcMonth] += 1

        const dayKey = timestampDate.toISOString().slice(0, 10)
        dailyCount.set(dayKey, (dailyCount.get(dayKey) || 0) + 1)
        sensor.dailyDetections.set(dayKey, (sensor.dailyDetections.get(dayKey) || 0) + 1)
      }
    }
  }

  const topSpecies = [...speciesCount.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)

  const sensors = [...sensorCount.values()]

  const topSensors = [...sensors]
    .sort((left, right) => right.detections - left.detections)
    .slice(0, 12)

  const validSensorPoints = sensors
    .filter((sensor) => Number.isFinite(sensor.latitude) && Number.isFinite(sensor.longitude))
    .sort((left, right) => right.detections - left.detections)

  const orderedDaily = [...dailyCount.entries()].sort((left, right) => left[0].localeCompare(right[0]))
  const betaMatrices = buildBetaDistanceMatrices(sensors)
  const topSpeciesForHourly = topSpecies.slice(0, 6)
  const topSpeciesForHourlyHeatmap = topSpecies.slice(0, 10)
  const topSpeciesForMonthly = topSpecies.slice(0, 6)
  const totalDetections = rows.length
  const globalDiversity = calculateDiversityIndexesFromCounts(speciesCount, totalDetections)
  const stationRanking = buildStationRanking(sensors, speciesCount, totalDetections, minTimestamp, maxTimestamp)
  const stationPrioritization = stationRanking.slice(0, 30)
  const sankeyData = buildStationSpeciesSankey(sensors, topSpecies)
  const speciesRanking = [...speciesStats.values()]
    .sort(
      (left, right) =>
        right.detections - left.detections || right.stations.size - left.stations.size || left.key.localeCompare(right.key),
    )
    .map((species, index) => ({
      rank: index + 1,
      key: species.key,
      label: prettifySpeciesName(species.key),
      scientificName: species.key.replaceAll('-', ' '),
      detections: species.detections,
      share: totalDetections ? species.detections / totalDetections : 0,
      stationCount: species.stations.size,
      averageConfidence: species.confidenceRows ? species.confidenceSum / species.confidenceRows : 0,
    }))

  const speciesHourlySeries = topSpeciesForHourly.map(([speciesName, total]) => ({
    speciesName,
    label: prettifySpeciesName(speciesName),
    total,
    values: [...(speciesHourlyCount.get(speciesName) || Array(24).fill(0))],
  }))

  const speciesHourlyHeatmapSeries = topSpeciesForHourlyHeatmap.map(([speciesName, total]) => ({
    speciesName,
    label: prettifySpeciesName(speciesName),
    total,
    values: [...(speciesHourlyCount.get(speciesName) || Array(24).fill(0))],
  }))

  const speciesMonthlySeries = topSpeciesForMonthly.map(([speciesName, total]) => ({
    speciesName,
    label: prettifySpeciesName(speciesName),
    total,
    values: [...(speciesMonthlyCount.get(speciesName) || Array(12).fill(0))],
  }))

  return {
    totalDetections,
    uniqueSpecies: speciesCount.size,
    uniqueSensors: sensorCount.size,
    averageConfidence: confidenceRows ? confidenceSum / confidenceRows : 0,
    shannonIndex: globalDiversity.shannonIndex,
    simpsonIndex: globalDiversity.simpsonIndex,
    minTimestamp: Number.isFinite(minTimestamp) ? minTimestamp : Number.NaN,
    maxTimestamp: Number.isFinite(maxTimestamp) ? maxTimestamp : Number.NaN,
    topSpeciesLabels: topSpecies.map(([speciesName]) => prettifySpeciesName(speciesName)),
    topSpeciesValues: topSpecies.map(([, count]) => count),
    topSensorsLabels: topSensors.map((sensor) => sensor.name),
    topSensorsValues: topSensors.map((sensor) => sensor.detections),
    hourlyLabels: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`),
    hourlyValues: hourlyCount,
    dailyLabels: orderedDaily.map(([dayKey]) => dayKey),
    dailyValues: orderedDaily.map(([, count]) => count),
    speciesHourlySeries,
    speciesHourlyHeatmapSeries,
    monthlyLabels: MONTH_LABELS,
    speciesMonthlySeries,
    stationRanking,
    stationPrioritization,
    ...sankeyData,
    speciesRanking,
    sensorPoints: validSensorPoints,
    ...betaMatrices,
  }
}
