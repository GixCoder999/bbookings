import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth.js'

function ProtectedRoute({ allowedRoles, children }) {
  const { currentUser, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="page-shell">Loading session...</div>
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to={currentUser.role === 'owner' ? '/dashboard' : '/'} replace />
  }

  return children
}

export default ProtectedRoute
