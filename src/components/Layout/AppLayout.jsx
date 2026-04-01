import { Outlet, useLocation } from 'react-router-dom'
import Footer from '../Footer/Footer.jsx'
import Header from '../Header/Header.jsx'
import RouteLoader from './RouteLoader.jsx'
import ToastStack from '../ToastStack/ToastStack.jsx'

function AppLayout() {
  const location = useLocation()

  return (
    <div className="app-shell">
      <RouteLoader key={location.pathname} />
      <ToastStack />
      <Header />
      <main className="app-main">
        <div className="route-stage" key={location.pathname}>
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default AppLayout
