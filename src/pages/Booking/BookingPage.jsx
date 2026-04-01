import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import SlotPicker from '../../components/SlotPicker/SlotPicker.jsx'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import { useAuth } from '../../context/useAuth.js'
import { isWithinBookingWindow } from '../../utils/dateUtils'
import { createBooking, getServiceAvailability } from '../../utils/api'

function BookingPage() {
  const { serviceId } = useParams()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState({ service: null, business: null, slots: [] })
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getServiceAvailability(serviceId).then((result) => {
      setData({
        ...result,
        slots: result.slots.filter(
          (slot) => slot.status === 'available' && isWithinBookingWindow(slot.date),
        ),
      })
    })
  }, [serviceId])

  async function handleBooking() {
    try {
      setError('')
      const booking = await createBooking(selectedSlotId)
      navigate(`/booking/confirmation/${booking.id}`)
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  if (!data.service) {
    return <div className="page-shell">Loading service availability...</div>
  }

  return (
    <div className="page-shell booking-shell">
      <div className="card booking-summary">
        <p className="eyebrow">Booking Flow</p>
        <h1>{data.service.name}</h1>
        <p className="section-copy">{data.service.description}</p>
        <div className="summary-grid">
          <div>
            <span>Duration</span>
            <strong>{data.service.duration_mins} mins</strong>
          </div>
          <div>
            <span>Price</span>
            <strong>${data.service.price}</strong>
          </div>
          <div>
            <span>Timezone</span>
            <strong>{data.business.timezone}</strong>
          </div>
          <div>
            <span>Status</span>
            <StatusBadge status="pending" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="booking-header-row">
          <div>
            <p className="eyebrow">Availability</p>
            <h2>Select a slot</h2>
          </div>
          <p className="muted-text">Showing the earliest available openings in the current window.</p>
        </div>
        <SlotPicker slots={data.slots.slice(0, 24)} selectedSlotId={selectedSlotId} onSelect={setSelectedSlotId} />
        {error && <p className="form-error">{error}</p>}
        <button
          className="primary-button"
          type="button"
          onClick={handleBooking}
          disabled={!selectedSlotId}
        >
          Request booking
        </button>
      </div>
    </div>
  )
}

export default BookingPage
