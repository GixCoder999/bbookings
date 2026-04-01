import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'

function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      setError('')
      const user = await login(form)
      const nextPath =
        location.state?.from ?? (user.role === 'owner' ? '/dashboard' : '/')
      navigate(nextPath)
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  return (
    <div className="page-shell auth-shell">
      <div className="auth-layout card">
        <section className="auth-aside">
          <p className="eyebrow">Welcome back</p>
          <h1>Sign in to your booking workspace.</h1>
          <p className="section-copy">
            Manage service requests, review availability, and step back into a cleaner booking flow.
          </p>
          <div className="auth-promo-list">
            <span className="auth-promo-chip">Owner dashboard</span>
            <span className="auth-promo-chip">Customer booking flow</span>
            <span className="auth-promo-chip">Approval queue</span>
          </div>
          <div className="auth-demo-box">
            <strong>Demo access</strong>
            <p>Owner: `owner@demo.com` / `demo1234`</p>
            <p>Customer: `customer@demo.com` / `demo1234`</p>
          </div>
        </section>

        <form className="auth-card auth-form-panel" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <p className="eyebrow">Account Access</p>
            <h2>Sign in</h2>
          </div>
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
              placeholder="Enter your password"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit">
            Sign in
          </button>
          <p className="muted-text auth-link-row">
            Need an account? <Link to="/signup">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default Login
