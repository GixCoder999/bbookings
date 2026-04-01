import { NavLink, Outlet } from 'react-router-dom'
import { DashboardIcon, ServicesIcon, AppointmentsIcon, ReportsIcon, SettingsIcon } from '../../components/Icons/Icons.jsx'

function Dashboard() {
  return (
    <div className="page-shell dashboard-shell">
      <aside className="dashboard-sidebar card">
        <div className="dashboard-sidebar__top">
          <p className="eyebrow">Dashboard</p>
          <h2>Control Center</h2>
          <p className="muted-text">
            Manage your services, approvals, and insights all in one place.
          </p>
        </div>
        <nav className="dashboard-nav">
          <NavLink to="services">
            <ServicesIcon size={18} />
            Services
          </NavLink>
          <NavLink to="appointments">
            <AppointmentsIcon size={18} />
            Appointments
          </NavLink>
          <NavLink to="analytics">
            <ReportsIcon size={18} />
            Analytics
          </NavLink>
          <NavLink to="account">
            <SettingsIcon size={18} />
            Account
          </NavLink>
        </nav>
      </aside>
      <section className="dashboard-content">
        <Outlet />
      </section>
    </div>
  )
}

export default Dashboard
