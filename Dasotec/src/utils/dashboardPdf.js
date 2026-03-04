import { prettifySpeciesName, prettifyStationName } from './dashboardData'
import { formatDate, numberFormatter, percentFormatter } from './dashboardFormatters'

const diversityFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const FILE_STAMP_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function normalizeConfidence(rawConfidence) {
  if (!Number.isFinite(rawConfidence) || rawConfidence <= 0) {
    return 'n/d'
  }

  const normalized = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence
  return percentFormatter.format(Math.max(0, Math.min(normalized, 1)))
}

function averageUpperTriangleDistance(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) {
    return Number.NaN
  }

  let sum = 0
  let count = 0

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || []

    for (let colIndex = rowIndex + 1; colIndex < row.length; colIndex += 1) {
      const value = row[colIndex]
      if (!Number.isFinite(value)) {
        continue
      }

      sum += value
      count += 1
    }
  }

  if (!count) {
    return Number.NaN
  }

  return sum / count
}

function buildPdfFileName(now = new Date()) {
  const compactStamp = FILE_STAMP_FORMATTER.format(now)
    .replaceAll('-', '')
    .replaceAll(' ', '-')
    .replaceAll(':', '')

  return `dashboard-murcielagos-${compactStamp}.pdf`
}

export async function exportDashboardPdf({ data, filters = {}, sourcePath = '' }) {
  if (!data) {
    throw new Error('No hay datos para exportar en PDF.')
  }

  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 40
  const contentWidth = pageWidth - margin * 2
  const lineHeight = 13
  const tableHeaderHeight = 18
  const tableRowHeight = 16
  let cursorY = margin

  function startNewPage() {
    pdf.addPage()
    cursorY = margin
  }

  function ensureSpace(heightNeeded = lineHeight) {
    if (cursorY + heightNeeded > pageHeight - margin) {
      startNewPage()
    }
  }

  function truncateCellText(text, maxWidth) {
    const value = String(text || '')
    if (pdf.getTextWidth(value) <= maxWidth) {
      return value
    }

    let current = value
    while (current.length > 1 && pdf.getTextWidth(`${current}...`) > maxWidth) {
      current = current.slice(0, -1)
    }

    return `${current}...`
  }

  function writeTitle(text) {
    ensureSpace(24)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(17)
    pdf.setTextColor(15, 23, 42)
    pdf.text(text, margin, cursorY)
    cursorY += 24
  }

  function writeSectionTitle(text) {
    ensureSpace(20)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.setTextColor(51, 65, 85)
    pdf.text(text, margin, cursorY)
    cursorY += 16
  }

  function writeParagraph(text, { fontSize = 10, color = [71, 85, 105] } = {}) {
    const normalizedText = String(text || '').trim()
    if (!normalizedText) {
      return
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(fontSize)
    pdf.setTextColor(color[0], color[1], color[2])
    const lines = pdf.splitTextToSize(normalizedText, contentWidth)
    ensureSpace(lines.length * lineHeight + 2)
    pdf.text(lines, margin, cursorY)
    cursorY += lines.length * lineHeight + 2
  }

  function writeGap(points = 8) {
    cursorY += points
  }

  function drawTable(headers, rows, colWidths) {
    if (!rows.length) {
      writeParagraph('No hay filas para este bloque con los filtros actuales.')
      return
    }

    const drawHeader = () => {
      ensureSpace(tableHeaderHeight)
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margin, cursorY, contentWidth, tableHeaderHeight, 'F')
      pdf.setDrawColor(203, 213, 225)
      pdf.rect(margin, cursorY, contentWidth, tableHeaderHeight, 'S')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(51, 65, 85)

      let xCursor = margin
      headers.forEach((header, index) => {
        const cellPadding = 4
        const width = colWidths[index]
        const cellText = truncateCellText(header, width - cellPadding * 2)
        pdf.text(cellText, xCursor + cellPadding, cursorY + 12)
        xCursor += width
      })

      cursorY += tableHeaderHeight
    }

    const drawRow = (row, rowIndex) => {
      ensureSpace(tableRowHeight)
      const rowBg = rowIndex % 2 === 0 ? 255 : 248
      pdf.setFillColor(rowBg, rowBg, rowBg)
      pdf.rect(margin, cursorY, contentWidth, tableRowHeight, 'F')
      pdf.setDrawColor(226, 232, 240)
      pdf.rect(margin, cursorY, contentWidth, tableRowHeight, 'S')

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.7)
      pdf.setTextColor(51, 65, 85)

      let xCursor = margin
      row.forEach((cellValue, cellIndex) => {
        const cellPadding = 4
        const width = colWidths[cellIndex]
        const text = truncateCellText(String(cellValue), width - cellPadding * 2)
        pdf.text(text, xCursor + cellPadding, cursorY + 11)
        xCursor += width
      })

      cursorY += tableRowHeight
    }

    drawHeader()

    rows.forEach((row, rowIndex) => {
      if (cursorY + tableRowHeight > pageHeight - margin) {
        startNewPage()
        drawHeader()
      }

      drawRow(row, rowIndex)
    })

    writeGap(8)
  }

  const now = new Date()
  const minDataDate = formatDate(data.minTimestamp)
  const maxDataDate = formatDate(data.maxTimestamp)
  const peakHourIndex = data.hourlyValues?.length
    ? data.hourlyValues.reduce(
        (bestIndex, value, index, values) => (value > values[bestIndex] ? index : bestIndex),
        0,
      )
    : -1
  const peakHourLabel = peakHourIndex >= 0 ? data.hourlyLabels?.[peakHourIndex] || 'n/d' : 'n/d'
  const avgJaccard = averageUpperTriangleDistance(data.betaJaccardMatrix)
  const avgSorensen = averageUpperTriangleDistance(data.betaSorensenMatrix)

  const topSpeciesRows = (data.speciesRanking || []).slice(0, 12).map((species) => [
    String(species.rank),
    prettifySpeciesName(species.key),
    numberFormatter.format(species.detections),
    percentFormatter.format(species.share || 0),
    numberFormatter.format(species.stationCount),
    normalizeConfidence(species.averageConfidence),
  ])

  const stationRows = (data.stationRanking || []).slice(0, 12).map((station) => [
    String(station.rank),
    prettifyStationName(station.name),
    numberFormatter.format(station.detections),
    numberFormatter.format(station.richness),
    diversityFormatter.format(station.shannonIndex),
    diversityFormatter.format(station.simpsonIndex),
    normalizeConfidence(station.averageConfidence),
  ])

  writeTitle('Dashboard de Murcielagos - Informe PDF')
  writeParagraph(`Generado: ${DATE_TIME_FORMATTER.format(now)}`, { fontSize: 9 })
  if (sourcePath) {
    writeParagraph(`Fuente de datos: ${sourcePath}`, { fontSize: 9 })
  }
  writeGap(4)

  writeSectionTitle('Filtros activos')
  writeParagraph(`Especies: ${filters.species || 'Todas las especies'}`)
  writeParagraph(`Estaciones: ${filters.stations || 'Todas las estaciones'}`)
  writeParagraph(`Rango temporal: ${filters.range || 'Todo el rango disponible'}`)
  writeGap(4)

  writeSectionTitle('Resumen general')
  writeParagraph(`Detecciones totales: ${numberFormatter.format(data.totalDetections)}`)
  writeParagraph(`Especies unicas: ${numberFormatter.format(data.uniqueSpecies)}`)
  writeParagraph(`Estaciones/sensores unicos: ${numberFormatter.format(data.uniqueSensors)}`)
  writeParagraph(`Confianza media: ${normalizeConfidence(data.averageConfidence)}`)
  writeParagraph(`Shannon (H'): ${diversityFormatter.format(data.shannonIndex)}`)
  writeParagraph(`Simpson (1-D): ${diversityFormatter.format(data.simpsonIndex)}`)
  writeParagraph(`Periodo observado en datos filtrados: ${minDataDate} -> ${maxDataDate}`)
  writeParagraph(`Hora pico de detecciones: ${peakHourLabel}`)
  writeGap(4)

  writeSectionTitle('Diversidad beta (resumen)')
  writeParagraph(
    `Estaciones usadas en matriz: ${numberFormatter.format(data.betaMatrixUsedStations || 0)} de ${numberFormatter.format(
      data.betaMatrixTotalStations || 0,
    )}`,
  )
  writeParagraph(`Distancia media Jaccard: ${Number.isFinite(avgJaccard) ? avgJaccard.toFixed(3) : 'n/d'}`)
  writeParagraph(`Distancia media Sorensen: ${Number.isFinite(avgSorensen) ? avgSorensen.toFixed(3) : 'n/d'}`)
  writeGap(6)

  writeSectionTitle('Top especies')
  drawTable(
    ['#', 'Especie', 'Detecciones', '%', 'Est.', 'Conf. media'],
    topSpeciesRows,
    [24, 190, 90, 65, 42, contentWidth - (24 + 190 + 90 + 65 + 42)],
  )

  writeSectionTitle('Ranking de estaciones')
  drawTable(
    ['#', 'Estacion', 'Det.', 'Riq.', 'Shannon', 'Simpson', 'Conf. media'],
    stationRows,
    [24, 170, 56, 50, 65, 65, contentWidth - (24 + 170 + 56 + 50 + 65 + 65)],
  )

  pdf.save(buildPdfFileName(now))
}
