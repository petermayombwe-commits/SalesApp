import React, { useState, useEffect } from 'react'
import { Plus, X, Shield, User } from 'lucide-react'
import { useAuth } from '../App'
import { fmtDate } from '../utils/format'
import toast from 'react-hot-toast'

const PERMISSIONS = [
  { key: 'sales',     label: 'Sales & Orders' },
  { key: 'inventory', label: 'Inventory Management' },
  { key: 'credits',   label: 'Credits & Collections' },
  { key: 'clients',   label: 'Client Management' },
  { key: 'products',  label: 'Product Catalogue' },
  { key: 'reports',   label: 'Reports & Forecasting' },
  { key: 'staff',     label: 'Staff Management' },
  { key: 'expenses',  label: 'Expenses & P&L' },
  { key: 'settings',  label: 'Business Settings' }
]

const BLANK = { full_name: '', username: '', email: '', role: 'staff', password: '', permissions: {}, is_active: true }

export default function Staff() {
  const { user } = useAuth()
  const bid = user?.business_id
  const [staff, setStaff] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editStaff, setEditStaff] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { loadStaff() }, [])

  const loadStaff = async () => {
    const data = await window.api.staff.list({ businessId: bid })
    setStaff(data || [])
  }

  const handleSave = async () => {
    if (!form.full_name || !form.username || !form.email) return toast.error('Name, username and email required')
    if (!editStaff && !form.password) return toast.error('Password required for new staff')

    let result
    if (editStaff) {
      result = await window.api.staff.update({ id: editStaff.id, data: form })
    } else {
      result = await window.api.staff.create({ businessId: bid, data: form })
    }

    if (result.success) {
      toast.success(editStaff ? 'Staff updated' : 'Staff member created')
      setShowForm(false)
      setEditStaff(null)
      setForm(BLANK)
      loadStaff()
    } else {
      toast.error(result.error)
    }
  }

  const openEdit = (s) => {
    setEditStaff(s)
    setForm({ full_name: s.full_name, username: s.username, email: s.email, role: s.role, password: '', permissions: s.permissions || {}, is_active: s.is_active !== 0 })
    setShowForm(true)
  }

  const togglePerm = (key) => {
    if (form.role === 'admin') return
    setForm(f => ({
      ...f,
      permissions: { ...f.permissions, [key]: !f.permissions[key] }
    }))
  }

  const roleColors = { admin: '#ef4444', manager: '#f59e0b', staff: '#3b82f6' }
  const avatarColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f97316', '#ef4444']

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">{staff.length} staff members</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditStaff(null); setForm(BLANK); setShowForm(true) }}>
          <Plus size={15} /> Add Staff
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {staff.map(s => {
          const initials = s.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
          const color = avatarColors[initials?.charCodeAt(0) % avatarColors.length]
          return (
            <div key={s.id} className="card" style={{ borderLeft: `3px solid ${roleColors[s.role] || '#3b82f6'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div className="avatar" style={{ width: 44, height: 44, fontSize: 15, background: color }}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{s.username}</div>
                </div>
                <span className="badge" style={{ background: `${roleColors[s.role]}22`, color: roleColors[s.role] }}>
                  {s.role}
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                <div>{s.email}</div>
                <div style={{ marginTop: 2 }}>Last login: {s.last_login ? fmtDate(s.last_login) : 'Never'}</div>
              </div>

              {/* Permissions mini-display */}
              {s.role !== 'admin' && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Permissions</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {PERMISSIONS.map(p => (
                      <span key={p.key} style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 100,
                        background: s.permissions?.[p.key] ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.1)',
                        color: s.permissions?.[p.key] ? '#34d399' : '#475569',
                        fontWeight: 600
                      }}>{p.label}</span>
                    ))}
                  </div>
                </div>
              )}
              {s.role === 'admin' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent-red)', marginBottom: 12 }}>
                  <Shield size={12} /> Full access to all features
                </div>
              )}

              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEdit(s)}>Edit</button>
                <span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`} style={{ display: 'flex', alignItems: 'center' }}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} disabled={!!editStaff} />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, permissions: e.target.value === 'admin' ? { all: true } : f.permissions }))}>
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                </div>
              </div>
              {!editStaff && (
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 6 characters" />
                </div>
              )}

              {form.role !== 'admin' && (
                <div>
                  <label className="form-label" style={{ marginBottom: 10 }}>Access Permissions</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {PERMISSIONS.map(p => (
                      <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', background: form.permissions[p.key] ? 'rgba(16,185,129,0.1)' : 'var(--bg-primary)', borderRadius: 8, border: `1px solid ${form.permissions[p.key] ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`, transition: 'all 0.15s', fontSize: 13 }}>
                        <input type="checkbox" checked={!!form.permissions[p.key]} onChange={() => togglePerm(p.key)} />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                Account is active
              </label>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editStaff ? 'Save Changes' : 'Create Staff Account'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
