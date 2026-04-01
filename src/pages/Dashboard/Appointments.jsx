import { useEffect, useState } from 'react'
import SectionHeading from '../../components/SectionHeading/SectionHeading.jsx'
import StatusBadge from '../../components/StatusBadge/StatusBadge.jsx'
import { useAuth } from '../../context/useAuth.js'
import { useToast } from '../../context/useToast.js'
import { formatDate, formatTime } from '../../utils/dateUtils'
import { getOwnerDashboard, updateBookingStatus } from '../../utils/api'

function Appointments() {
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const [appointments, setAppointments] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getOwnerDashboard(currentUser.id).then((data) => setAppointments(data.appointments))
  }, [currentUser.id])

  const filteredAppointments = appointments.filter((entry) =>
    filter === 'all' ? true : entry.status === filter,
  )

  async function handleStatusChange(bookingId, status) {
    try {
      await updateBookingStatus(bookingId, status)
      const data = await getOwnerDashboard(currentUser.id)
      setAppointments(data.appointments)
      showToast(
        status === 'confirmed' ? 'Booking confirmed successfully.' : 'Booking cancelled successfully.',
        'success',
      )
    } catch (submitError) {
      showToast(submitError.message, 'error')
    }
  }

  return (
    <div className="card">
      <SectionHeading
        eyebrow="Appointments"
        title="Approval queue"
        description="Review pending requests and convert them into confirmed or cancelled appointments."
        action={
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        }
      />
      <div className="appointment-list">
        {filteredAppointments.map((appointment) => (
          <article className="appointment-card" key={appointment.id}>
            <div>
              <h3>{appointment.service?.name}</h3>
              <p>
                {appointment.customer?.full_name} on {formatDate(appointment.slot?.date)} at{' '}
                {formatTime(appointment.slot?.start_time)}
              </p>
            </div>
            <div className="appointment-actions">
              <StatusBadge status={appointment.status} />
              <button
                className="ghost-button"
                type="button"
                onClick={() => handleStatusChange(appointment.id, 'confirmed')}
              >
                Confirm
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => handleStatusChange(appointment.id, 'cancelled')}
              >
                Cancel
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default Appointments
