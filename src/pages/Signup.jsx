import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

function Signup() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'customer',
  })
  const [error, setError] = useState('')
  const { signup } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      setError('')
      const user = await signup(form)
      navigate(user.role === 'owner' ? '/dashboard' : '/')
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  return (
    <div className="page-shell auth-shell">
      <div className="auth-layout card auth-layout--signup">
        <section className="auth-aside">
          <p className="eyebrow">Account setup</p>
          <h1>Create a profile that fits your role.</h1>
          <p className="section-copy">
            Start as a customer for quick appointment requests or as an owner to manage services,
            approvals, and analytics.
          </p>
          <div className="auth-promo-list">
            <span className="auth-promo-chip">Modern scheduling</span>
            <span className="auth-promo-chip">Role-based views</span>
            <span className="auth-promo-chip">Fast onboarding</span>
          </div>
        </section>

        <form className="auth-card auth-form-panel" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <p className="eyebrow">New Account</p>
            <h2>Create an account</h2>
          </div>
          <label>
            Full name
            <input
              value={form.fullName}
              onChange={(event) =>
                setForm((current) => ({ ...current, fullName: event.target.value }))
              }
              placeholder="Your full name"
              required
            />
          </label>
          <label>
            Email
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              type="email"
              placeholder="you@business.com"
              required
            />
          </label>
          <label>
            Password
            <input
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              type="password"
              minLength="8"
              placeholder="Minimum 8 characters"
              required
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
            >
              <option value="customer">Customer</option>
              <option value="owner">Business Owner</option>
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit">
            Create account
          </button>
          <p className="muted-text auth-link-row">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Signup
