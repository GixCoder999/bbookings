import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ServiceCard from '../components/ServiceCard/ServiceCard.jsx'
import SectionHeading from '../components/SectionHeading/SectionHeading.jsx'
import StatCard from '../components/StatCard/StatCard.jsx'
import StatusBadge from '../components/StatusBadge/StatusBadge.jsx'
import { ScheduleIcon, AnalyticsIcon, CheckIcon, UserIcon, BookmarkIcon } from '../components/Icons/Icons'
import { useAuth } from '../context/useAuth.js'
import { formatDate, formatTime } from '../utils/dateUtils'
import { getBusinessCatalog, getCustomerBookings } from '../utils/api'

function Home() {
  const { currentUser } = useAuth()
  const [catalog, setCatalog] = useState({ business: null, services: [] })
  const [bookings, setBookings] = useState([])
  const [searchParams, setSearchParams] = useSearchParams()
  const catalogSectionRef = useRef(null)
  const serviceSearch = searchParams.get('search') ?? ''

  useEffect(() => {
    getBusinessCatalog().then(setCatalog)
  }, [])

  useEffect(() => {
    if (currentUser?.role === 'customer') {
      getCustomerBookings(currentUser.id).then(setBookings)
    }
  }, [currentUser?.id, currentUser?.role])

  const visibleBookings = currentUser?.role === 'customer' ? bookings : []
  const featuredServices = catalog.services.slice(0, 6)
  const normalizedServiceSearch = serviceSearch.trim().toLowerCase()
  const visibleServices = featuredServices.filter((service) => {
    if (!normalizedServiceSearch) {
      return true
    }

    return [service.name, service.description]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedServiceSearch))
  })

  useEffect(() => {
    if (!serviceSearch.trim()) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      catalogSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)

    return () => window.clearTimeout(timeoutId)
  }, [serviceSearch, visibleServices.length])

  function handleServiceSearchChange(value) {
    const nextParams = new URLSearchParams(searchParams)

    if (value.trim()) {
      nextParams.set('search', value)
    } else {
      nextParams.delete('search')
    }

    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className="page-shell home-page">
      <section className="home-hero">
        <div className="hero-panel hero-panel--home">
          <div className="hero-copy-block">
            <div className="hero-kicker-row">
              <p className="eyebrow">Business Booking</p>
              <span className="hero-inline-badge">Minimal scheduling for modern service teams</span>
            </div>
            <h1>Bookings that feel polished on both sides of the counter.</h1>
            <p className="hero-copy">
              Built for service businesses that want clean operations, confident approvals, and a booking experience customers can understand instantly.
            </p>
            <div className="hero-actions">
              <Link className="primary-button" to={currentUser ? '/dashboard' : '/signup'}>
                {currentUser ? 'Open Dashboard' : 'Start Free'}
              </Link>
              <Link className="ghost-button" to={featuredServices[0] ? `/booking/${featuredServices[0].id}` : '/'}>
                Preview Booking Flow
              </Link>
            </div>
            <div className="hero-chip-row">
              <span className="hero-chip">
                <ScheduleIcon size={18} />
                Clear slot availability
              </span>
              <span className="hero-chip">
                <AnalyticsIcon size={18} />
                Owner-side visibility
              </span>
              <span className="hero-chip">
                <CheckIcon size={18} />
                Request and approval flow
              </span>
            </div>
          </div>
          <div className="hero-showcase">
            <div className="hero-showcase__frame">
              <div className="hero-showcase__head">
                <div>
                  <p className="eyebrow">Today at a Glance</p>
                  <h2>{catalog.business?.name ?? 'Loading workspace'}</h2>
                </div>
                <span className="hero-inline-badge hero-inline-badge--soft">Workspace snapshot</span>
              </div>
              <div className="hero-showcase__metrics">
                <StatCard label="Services" value={catalog.services.length} hint="Published offers" />
                <StatCard label="Window" value="30 days" hint="Rolling availability" />
                <StatCard
                  label="Pending"
                  value={visibleBookings.filter((booking) => booking.status === 'pending').length}
                  hint="Customer-side requests"
                />
              </div>
              <div className="hero-showcase__agenda">
                <div className="hero-showcase__agenda-header">
                  <strong>Featured services</strong>
                  <span>{featuredServices.length} visible</span>
                </div>
                {featuredServices.slice(0, 3).map((service) => (
                  <div className="hero-agenda-item" key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      <span>{service.duration_mins} mins</span>
                    </div>
                    <em>${service.price}</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-highlight-strip">
        <article className="highlight-metric">
          <span>Designed for</span>
          <strong>Service businesses</strong>
          <p>Minimal admin surface, customer-friendly booking flow.</p>
        </article>
        <article className="highlight-metric">
          <span>Approval model</span>
          <strong>Request first</strong>
          <p>Owners can confirm or decline without losing context.</p>
        </article>
        <article className="highlight-metric">
          <span>Availability</span>
          <strong>Structured slots</strong>
          <p>Generated from working hours, duration, and buffer rules.</p>
        </article>
      </section>

      <section className="spotlight-grid home-spotlight-grid">
        <article className="spotlight-card spotlight-card--primary">
          <div className="spotlight-icon"><UserIcon size={36} /></div>
          <p className="eyebrow">Owner Workspace</p>
          <h2>Control the business without babysitting the calendar.</h2>
          <p className="hero-copy">
            Configure your business once, publish services, review incoming requests, and keep reporting tidy. The layout stays focused on what needs action.
          </p>
          <div className="spotlight-list">
            <span>Business profile and service setup stay in one place.</span>
            <span>Appointments remain readable across pending and confirmed states.</span>
            <span>Analytics keep the operational view clean.</span>
          </div>
        </article>
        <article className="spotlight-card">
          <div className="spotlight-icon"><BookmarkIcon size={36} /></div>
          <p className="eyebrow">Customer Experience</p>
          <h2>Shorter decision time, clearer booking intent.</h2>
          <p>
            Services are presented clearly, slots stay easy to scan, and customers can follow request status without hunting through the UI.
          </p>
          <div className="spotlight-list">
            <span>Simple service discovery.</span>
            <span>Immediate slot selection.</span>
            <span>Readable booking status updates.</span>
          </div>
        </article>
      </section>

      <section className="content-panel home-catalog-panel" ref={catalogSectionRef}>
        <SectionHeading
          eyebrow="Service Catalog"
          title={catalog.business?.name ?? 'Services'}
          description={catalog.business?.description ?? 'Bookable services arranged in a cleaner storefront layout.'}
        />
        <div className="catalog-header-row">
          <div className="catalog-header-copy">
            <strong>{visibleServices.length} services available</strong>
            <span>Choose a service to preview time options and request a booking.</span>
          </div>
          <label className="catalog-search">
            <span>Search services</span>
            <input
              value={serviceSearch}
              onChange={(event) => handleServiceSearchChange(event.target.value)}
              type="search"
              placeholder="Search by name or description"
            />
          </label>
        </div>
        <div className="service-grid service-grid--showcase">
          {visibleServices.map((service) => (
            <ServiceCard key={service.id} service={service} variant="showcase" />
          ))}
        </div>
        {visibleServices.length === 0 && (
          <p className="muted-text">No services match your search.</p>
        )}
      </section>

      {currentUser?.role === 'customer' && (
        <section className="content-panel">
          <SectionHeading
            eyebrow="Your Bookings"
            title="Track booking status"
            description="Customers can review pending, confirmed, and cancelled appointment requests here."
          />
          <div className="appointment-list">
            {visibleBookings.map((booking) => (
              <article className="appointment-card" key={booking.id}>
                <div>
                  <h3>{booking.service?.name}</h3>
                  <p>
                    {formatDate(booking.slot?.date)} at {formatTime(booking.slot?.start_time)}
                  </p>
                </div>
                <StatusBadge status={booking.status} />
              </article>
            ))}
            {visibleBookings.length === 0 && <p className="muted-text">No bookings yet.</p>}
          </div>
        </section>
      )}
    </div>
  )
}

export default Home
