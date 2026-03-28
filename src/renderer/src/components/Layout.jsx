import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, CreditCard,
  Users, Archive, TrendingUp, UserCog, Settings,
  Bell, LogOut, ChevronDown, AlertTriangle, Search
} from 'lucide-react'
import { useAuth } from '../App'

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard',    perm: null },
  { to: '/sales',       icon: ShoppingCart,    label: 'Sales',        perm: 'sales' },
  { to: '/inventory',   icon: Archive,         label: 'Inventory',    perm: 'inventory' },
  { to: '/credits',     icon: CreditCard,      label: 'Credits',      perm: 'credits' },
  { to: '/clients',     icon: Users,           label: 'Clients',      perm: 'clients' },
  { to: '/products',    icon: Package,         label: 'Products',     perm: 'products' },
  { to: '/forecasting', icon: TrendingUp,      label: 'Forecasting',  perm: 'reports' },
  { to: '/staff',       icon: UserCog,         label: 'Staff',        perm: 'staff' },
  { to: '/settings',    icon: Settings,        label: 'Settings',     perm: 'settings' }
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [unread, setUnread] = useState(0)
  const [lowStock, setLowStock] = useState(0)

  const hasPermission = (perm) => {
    if (!perm) return true
    return user?.permissions?.all || user?.permissions?.[perm]
  }

  useEffect(() => {
    loadNotifications()
    loadLowStock()
    // Poll for alerts every 5 minutes
    const interval = setInterval(() => {
      generateAlerts()
      loadNotifications()
    }, 300000)
    return () => clearInterval(interval)
  }, [])

  const generateAlerts = async () => {
    await window.api.notifications.generateCreditAlerts({ businessId: user.business_id })
  }

  const loadNotifications = async () => {
    const data = await window.api.notifications.list({
      businessId: user.business_id,
      userId: user.id,
      unreadOnly: false
    })
    setNotifications(data || [])
    setUnread(data?.filter(n => !n.is_read).length || 0)
  }

  const loadLowStock = async () => {
    const data = await window.api.inventory.lowStock({ businessId: user.business_id })
    setLowStock(data?.length || 0)
  }

  const markRead = async (id) => {
    await window.api.notifications.markRead({ id })
    loadNotifications()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'
  const avatarColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#ef4444']
  const avatarColor = avatarColors[initials.charCodeAt(0) % avatarColors.length]

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30,
              background: 'var(--gradient-blue)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <TrendingUp size={16} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>SalesFlow</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>PRO</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          {NAV.slice(0, 2).map(item => (
            hasPermission(item.perm) && (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <item.icon size={16} />
                {item.label}
                {item.to === '/inventory' && lowStock > 0 && <span className="nav-badge">{lowStock}</span>}
              </NavLink>
            )
          ))}

          <div className="nav-section-label">Management</div>
          {NAV.slice(2, 7).map(item => (
            hasPermission(item.perm) && (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <item.icon size={16} />
                {item.label}
              </NavLink>
            )
          ))}

          <div className="nav-section-label">Admin</div>
          {NAV.slice(7).map(item => (
            hasPermission(item.perm) && (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <item.icon size={16} />
                {item.label}
              </NavLink>
            )
          ))}
        </nav>

        {/* User info */}
        <div className="sidebar-user" onClick={handleLogout} title="Click to sign out">
          <div className="avatar" style={{ background: avatarColor }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
              {user?.full_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }} className="truncate">
              {user?.role}
            </div>
          </div>
          <LogOut size={14} color="var(--text-muted)" />
        </div>
      </aside>

      {/* Main */}
      <div className="main-area">
        {/* Header */}
        <header className="header">
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {user?.business_name}
          </div>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setShowNotifs(!showNotifs)}
              style={{ position: 'relative' }}
            >
              <Bell size={17} />
              {unread > 0 && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 8, height: 8, background: 'var(--accent-red)',
                  borderRadius: '50%', border: '1.5px solid var(--bg-secondary)'
                }} />
              )}
            </button>

            {showNotifs && (
              <div style={{
                position: 'absolute', right: 0, top: '100%',
                width: 340, background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)', zIndex: 500,
                overflow: 'hidden'
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                  {unread > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={async () => {
                      await window.api.notifications.markAllRead({ businessId: user.business_id, userId: user.id })
                      loadNotifications()
                    }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      No notifications
                    </div>
                  ) : notifications.map(n => (
                    <div key={n.id}
                      onClick={() => markRead(n.id)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: n.is_read ? 'transparent' : 'rgba(59,130,246,0.05)',
                        cursor: 'pointer',
                        transition: 'background 0.1s'
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: n.is_read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date(n.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {lowStock > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventory')} style={{ color: 'var(--accent-yellow)', borderColor: 'rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={13} />
              {lowStock} Low Stock
            </button>
          )}
        </header>

        {/* Page */}
        <main className="page-content" onClick={() => setShowNotifs(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
