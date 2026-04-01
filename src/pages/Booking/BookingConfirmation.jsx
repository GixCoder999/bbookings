import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import { formatDate, formatTime } from '../../utils/dateUtils'
import { getBookingById } from '../../utils/api'

function BookingConfirmation() {
  const { bookingId } = useParams()
  const [booking, setBooking] = useState(null)

  useEffect(() => {
    getBookingById(bookingId).then(setBooking)
  }, [bookingId])

  if (!booking) {
    return <div className="page-shell">Loading booking...</div>
  }

  return (
    <div className="page-shell confirmation-shell">
      <div className="card">
        <p className="eyebrow">Booking Submitted</p>
        <h1>Your appointment request is in.</h1>
        <p className="section-copy">
          {booking.service.name} with {booking.business.name} on {formatDate(booking.slot.date)} at{' '}
          {formatTime(booking.slot.start_time)}.
        </p>
        <StatusBadge status={booking.status} />
        <div className="confirmation-actions">
          <Link className="primary-button" to="/">
            Back to services
          </Link>
        </div>
      </div>
    </div>
  )
}

export default BookingConfirmation
