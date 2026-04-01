import { useEffect, useState } from 'react'
import SectionHeading from '../../components/SectionHeading/SectionHeading.jsx'
import { useAuth } from '../../context/useAuth.js'
import { useToast } from '../../context/useToast.js'
import { getOwnerDashboard, saveService } from '../../utils/api'

const initialForm = {
  name: '',
  description: '',
  duration_mins: 60,
  price: 100,
}

function Services() {
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const [dashboard, setDashboard] = useState({ business: null, services: [] })
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    getOwnerDashboard(currentUser.id).then(setDashboard)
  }, [currentUser.id])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!dashboard.business) {
      showToast('Create or save your business profile in Account before adding services.', 'error')
      return
    }
    try {
      await saveService(dashboard.business.id, {
        ...form,
        duration_mins: Number(form.duration_mins),
        price: Number(form.price),
      })
      setForm(initialForm)
      const data = await getOwnerDashboard(currentUser.id)
      setDashboard(data)
      showToast('Service created successfully.', 'success')
    } catch (submitError) {
      showToast(submitError.message, 'error')
    }
  }

  return (
    <div className="stack-lg">
      <div className="card">
        <SectionHeading
          eyebrow="Services"
          title="Service management"
          description="Create service offerings with duration-driven slot generation for the next 30 days."
        />
        <div className="simple-table">
          <div className="table-row table-head">
            <span>Name</span>
            <span>Duration</span>
            <span>Price</span>
          </div>
          {dashboard.services.map((service) => (
            <div className="table-row" key={service.id}>
              <span>{service.name}</span>
              <span>{service.duration_mins} mins</span>
              <span>${service.price}</span>
            </div>
          ))}
        </div>
      </div>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <SectionHeading
          eyebrow="Add Service"
          title="Create a new service"
          description="Each new service automatically gets bookable slots based on business hours."
        />
        {!dashboard.business && (
          <p className="form-error">Create or save your business profile in Account before adding services.</p>
        )}
        <label>
          Service name
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
            disabled={!dashboard.business}
          />
        </label>
        <label>
          Description
          <textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            rows="4"
            disabled={!dashboard.business}
          />
        </label>
        <label>
          Duration (mins)
          <input
            value={form.duration_mins}
            onChange={(event) =>
              setForm((current) => ({ ...current, duration_mins: event.target.value }))
            }
            type="number"
            min="15"
            step="15"
            required
            disabled={!dashboard.business}
          />
        </label>
        <label>
          Price
          <input
            value={form.price}
            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            type="number"
            min="0"
            step="5"
            required
            disabled={!dashboard.business}
          />
        </label>
        <button className="primary-button" type="submit" disabled={!dashboard.business}>
          Save service
        </button>
      </form>
    </div>
  )
}

export default Services
