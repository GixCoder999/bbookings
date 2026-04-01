import { useEffect, useState } from 'react'
import SectionHeading from '../../components/SectionHeading/SectionHeading.jsx'
import { useAuth } from '../../context/useAuth.js'
import { useToast } from '../../context/useToast.js'
import { getOwnerDashboard, saveBusiness } from '../../utils/api'

function Account() {
  const { currentUser } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({
    name: '',
    description: '',
    working_days: 'Monday,Tuesday,Wednesday,Thursday,Friday',
    start_time: '09:00',
    end_time: '17:00',
    timezone: 'America/New_York',
  })

  useEffect(() => {
    getOwnerDashboard(currentUser.id).then((data) => {
      if (!data.business) return
      setForm({
        name: data.business.name,
        description: data.business.description,
        working_days: data.business.working_days.join(','),
        start_time: data.business.start_time,
        end_time: data.business.end_time,
        timezone: data.business.timezone,
      })
    })
  }, [currentUser.id])

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      await saveBusiness(currentUser.id, {
        ...form,
        working_days: form.working_days.split(',').map((entry) => entry.trim()),
      })
      showToast('Business details saved successfully.', 'success')
    } catch (submitError) {
      showToast(submitError.message, 'error')
    }
  }

  return (
    <form className="card form-grid" onSubmit={handleSubmit}>
      <SectionHeading
        eyebrow="Account Settings"
        title="Business profile"
        description="Update the owner-facing business record that drives service slots and customer availability."
      />
      <label>
        Business name
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
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
        />
      </label>
      <label>
        Working days
        <input
          value={form.working_days}
          onChange={(event) =>
            setForm((current) => ({ ...current, working_days: event.target.value }))
          }
        />
      </label>
      <label>
        Start time
        <input
          value={form.start_time}
          onChange={(event) =>
            setForm((current) => ({ ...current, start_time: event.target.value }))
          }
          type="time"
          required
        />
      </label>
      <label>
        End time
        <input
          value={form.end_time}
          onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))}
          type="time"
          required
        />
      </label>
      <label>
        Timezone
        <input
          value={form.timezone}
          onChange={(event) =>
            setForm((current) => ({ ...current, timezone: event.target.value }))
          }
          required
        />
      </label>
      <button className="primary-button" type="submit">
        Save settings
      </button>
    </form>
  )
}

export default Account
