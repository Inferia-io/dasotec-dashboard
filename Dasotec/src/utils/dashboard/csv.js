import Papa from 'papaparse'

import { CSV_FILE_PATH } from '../../constants/dashboard'

function parseCsv(text) {
  const { data } = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header, index) => (index === 0 ? header.replace(/^\uFEFF/, '').trim() : header.trim()),
    transform: (value) => String(value || '').trim(),
  })

  if (!Array.isArray(data)) {
    return []
  }

  return data.map((row) => {
    const normalizedRow = {}

    for (const [key, value] of Object.entries(row || {})) {
      if (!key) {
        continue
      }

      normalizedRow[key] = typeof value === 'string' ? value : String(value || '')
    }

    return normalizedRow
  })
}

export async function fetchCsvRows() {
  const response = await fetch(CSV_FILE_PATH)
  if (!response.ok) {
    throw new Error(`No se pudo leer ${CSV_FILE_PATH} (${response.status})`)
  }

  const csvText = await response.text()
  return parseCsv(csvText)
}
