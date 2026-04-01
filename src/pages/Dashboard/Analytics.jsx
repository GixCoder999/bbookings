import { useEffect, useState } from 'react'
import SectionHeading from '../../components/SectionHeading/SectionHeading.jsx'
import StatCard from '../../components/StatCard/StatCard.jsx'
import { useAuth } from '../../context/useAuth.js'
import { getAnalytics } from '../../utils/api'

function Analytics() {
  const { currentUser } = useAuth()
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    getAnalytics(currentUser.id).then(setAnalytics)
  }, [currentUser.id])

  if (!analytics) {
    return <div className="card">Loading analytics...</div>
  }

  const maxBookings = Math.max(...analytics.serviceBreakdown.map((entry) => entry.bookings), 1)

  return (
    <div className="stack-lg">
      <div className="stats-grid">
        <StatCard label="Total bookings" value={analytics.totalBookings} hint="All appointment requests" />
        <StatCard label="Confirmed" value={analytics.confirmedBookings} hint="Owner-approved appointments" />
        <StatCard label="Pending" value={analytics.pendingBookings} hint="Waiting for review" />
        <StatCard label="Revenue" value={`$${analytics.revenue}`} hint="Confirmed bookings only" />
      </div>

      <div className="card">
        <SectionHeading
          eyebrow="Service Popularity"
          title="Bookings by service"
          description="Simple visual distribution of how booking demand is split across your services."
        />
        <div className="chart-list">
          {analytics.serviceBreakdown.map((entry) => (
            <div className="chart-row" key={entry.name}>
              <span>{entry.name}</span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar-fill"
                  style={{ width: `${(entry.bookings / maxBookings) * 100}%` }}
                />
              </div>
              <strong>{entry.bookings}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Analytics
