import { formatDate, formatTime } from '../../utils/dateUtils'
import './SlotPicker.css'

function SlotPicker({ slots, selectedSlotId, onSelect }) {
  const groupedSlots = slots.reduce((groups, slot) => {
    groups[slot.date] = groups[slot.date] ?? []
    groups[slot.date].push(slot)
    return groups
  }, {})

  return (
    <div className="slot-picker">
      {Object.entries(groupedSlots).map(([date, daySlots]) => (
        <section key={date} className="slot-day">
          <h3>{formatDate(date)}</h3>
          <div className="slot-grid">
            {daySlots.map((slot) => (
              <button
                key={slot.id}
                className={selectedSlotId === slot.id ? 'slot-pill active' : 'slot-pill'}
                type="button"
                onClick={() => onSelect(slot.id)}
                disabled={slot.status !== 'available'}
              >
                {formatTime(slot.start_time)}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default SlotPicker
