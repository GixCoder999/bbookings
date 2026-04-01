import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/useAuth.js'
import './Header.css'

function Header() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [headerSearch, setHeaderSearch] = useState(searchParams.get('search') ?? '')

  const isHomePage = location.pathname === '/'

  useEffect(() => {
    if (isHomePage) {
      setHeaderSearch(searchParams.get('search') ?? '')
    }
  }, [isHomePage, searchParams])

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  function handleSearchSubmit(event) {
    event.preventDefault()
    const nextSearch = headerSearch.trim()
    navigate(nextSearch ? `/?search=${encodeURIComponent(nextSearch)}` : '/')
  }

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <svg className="brand-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.9" />
          <rect x="17" y="3" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.6" />
          <rect x="3" y="17" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.6" />
          <rect x="17" y="17" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.9" />
        </svg>
        <div>
          <strong>BBookings</strong>
        </div>
      </Link>

      <form className="header-search" onSubmit={handleSearchSubmit}>
        <input
          value={headerSearch}
          onChange={(event) => setHeaderSearch(event.target.value)}
          type="search"
          placeholder="Search services"
          aria-label="Search services"
        />
        <button className="ghost-button" type="submit">
          Search
        </button>
      </form>

      <nav className="main-nav">
        <NavLink to="/">Home</NavLink>
        {currentUser?.role === 'owner' && <NavLink to="/dashboard">Dashboard</NavLink>}
        {!currentUser && <NavLink to="/login">Login</NavLink>}
        {!currentUser && <NavLink to="/signup">Signup</NavLink>}
        {currentUser && (
          <button className="ghost-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </nav>
    </header>
  )
}

export default Header
