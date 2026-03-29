import React, { createContext, useContext, useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Sales from './pages/Sales'
import Credits from './pages/Credits'
import Clients from './pages/Clients'
import Products from './pages/Products'
import Forecasting from './pages/Forecasting'
import Staff from './pages/Staff'
import Settings from './pages/Settings'
import Expenses from './pages/Expenses'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function ProtectedRoute({ children, permission }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (permission && !user.permissions?.all && !user.permissions?.[permission]) {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('sf_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const login = (userData) => {
    sessionStorage.setItem('sf_user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    sessionStorage.removeItem('sf_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="inventory" element={<ProtectedRoute permission="inventory"><Inventory /></ProtectedRoute>} />
          <Route path="sales" element={<ProtectedRoute permission="sales"><Sales /></ProtectedRoute>} />
          <Route path="credits" element={<ProtectedRoute permission="credits"><Credits /></ProtectedRoute>} />
          <Route path="clients" element={<ProtectedRoute permission="clients"><Clients /></ProtectedRoute>} />
          <Route path="products" element={<ProtectedRoute permission="products"><Products /></ProtectedRoute>} />
          <Route path="forecasting" element={<ProtectedRoute permission="reports"><Forecasting /></ProtectedRoute>} />
          <Route path="staff" element={<ProtectedRoute permission="staff"><Staff /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute permission="settings"><Settings /></ProtectedRoute>} />
          <Route path="expenses" element={<ProtectedRoute permission="expenses"><Expenses /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  )
}
