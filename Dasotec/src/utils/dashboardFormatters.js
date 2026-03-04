export const numberFormatter = new Intl.NumberFormat('es-ES')

export const percentFormatter = new Intl.NumberFormat('es-ES', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const dateFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' })

export function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return 'n/d'
  }

  return dateFormatter.format(new Date(timestamp))
}
