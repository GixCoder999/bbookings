import { addDays, toISODate } from './dateUtils'

function toMinutes(timeValue) {
  const [hours, minutes] = timeValue.split(':').map(Number)
  return hours * 60 + minutes
}

function toTimeString(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const minutes = String(totalMinutes % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function generateSlots({
  businessId,
  serviceId,
  workingDays,
  startTime,
  endTime,
  durationMins,
  daysAhead = 30,
  bufferMins = 0,
}) {
  const slots = []
  const start = new Date()
  const allowedDays = new Set(workingDays)
  const startMinutes = toMinutes(startTime)
  const endMinutes = toMinutes(endTime)

  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const currentDate = addDays(start, offset)
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' })

    if (!allowedDays.has(dayName)) {
      continue
    }

    let cursor = startMinutes
    while (cursor + durationMins <= endMinutes) {
      slots.push({
        id: `${serviceId}-${toISODate(currentDate)}-${cursor}`,
        business_id: businessId,
        service_id: serviceId,
        date: toISODate(currentDate),
        start_time: toTimeString(cursor),
        end_time: toTimeString(cursor + durationMins),
        status: 'available',
      })
      cursor += durationMins + bufferMins
    }
  }

  return slots
}

export function sortSlots(slots) {
  return [...slots].sort((left, right) => {
    const leftKey = `${left.date}-${left.start_time}`
    const rightKey = `${right.date}-${right.start_time}`
    return leftKey.localeCompare(rightKey)
  })
}
