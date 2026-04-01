import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../components/Layout/AppLayout.jsx'
import ProtectedRoute from '../components/ProtectedRoute/ProtectedRoute.jsx'
import BookingConfirmation from '../pages/Booking/BookingConfirmation.jsx'
import BookingPage from '../pages/Booking/BookingPage.jsx'
import Account from '../pages/Dashboard/Account.jsx'
import Analytics from '../pages/Dashboard/Analytics.jsx'
import Appointments from '../pages/Dashboard/Appointments.jsx'
import Dashboard from '../pages/Dashboard/Dashboard.jsx'
import Services from '../pages/Dashboard/Services.jsx'
import Home from '../pages/Home.jsx'
import Login from '../pages/Login.jsx'
import Signup from '../pages/Signup.jsx'

function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <Dashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="services" replace />} />
          <Route path="services" element={<Services />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="account" element={<Account />} />
        </Route>
        <Route
          path="booking/:serviceId"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <BookingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="booking/confirmation/:bookingId"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <BookingConfirmation />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default AppRouter
