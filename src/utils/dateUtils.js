export const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatDate(dateValue) {
  if (!dateValue) return 'TBD'
  return DATE_FORMATTER.format(new Date(`${dateValue}T00:00:00`))
}

export function formatTime(timeValue) {
  if (!timeValue) return '--:--'
  const [hours, minutes] = timeValue.split(':').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2024, 0, 1, hours, minutes))
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function isWithinBookingWindow(dateValue, daysAhead = 30) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const max = addDays(today, daysAhead)
  const candidate = new Date(`${dateValue}T00:00:00`)
  return candidate >= today && candidate <= max
}
