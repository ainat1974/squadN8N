import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'
import SalesPage from './pages/SalesPage'
import StockPage from './pages/StockPage'
import FinancialPage from './pages/FinancialPage'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/visao-geral" replace />} />
            <Route path="/visao-geral" element={<OverviewPage />} />
            <Route path="/vendas" element={<SalesPage />} />
            <Route path="/estoque" element={<StockPage />} />
            <Route path="/financeiro" element={<FinancialPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
