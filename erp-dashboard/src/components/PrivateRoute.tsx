import { Navigate, Outlet } from 'react-router-dom'

export default function PrivateRoute() {
  const token = sessionStorage.getItem('auth_token')
  return token ? <Outlet /> : <Navigate to="/login" replace />
}
