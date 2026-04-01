import { Link } from 'react-router-dom'
import './ServiceCard.css'

function ServiceCard({ service, variant = 'default' }) {
  return (
    <article className={`service-card service-card--${variant}`}>
      <div className="service-card__top">
        <p className="service-meta">{service.duration_mins} mins</p>
        <span className="service-pill">{service.availableSlots} open</span>
      </div>
      <div>
        <h3>{service.name}</h3>
        <p>{service.description}</p>
      </div>
      <div className="service-card__footer">
        <strong className="service-price">${service.price}</strong>
        <div>
          <Link to={`/booking/${service.id}`}>Book now</Link>
        </div>
      </div>
    </article>
  )
}

export default ServiceCard
