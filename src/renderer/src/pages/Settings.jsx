import React, { useState, useEffect } from 'react'
import { Save, Lock, Building2 } from 'lucide-react'
import { useAuth } from '../App'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user } = useAuth()
  const bid = user?.business_id

  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({})
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadSettings() }, [])

  const loadSettings = async () => {
    const data = await window.api.settings.get({ businessId: bid })
    if (data) { setSettings(data); setForm(data) }
  }

  const handleSaveBusiness = async () => {
    setSaving(true)
    const result = await window.api.settings.update({ businessId: bid, data: form })
    setSaving(false)
    if (result.success) toast.success('Settings saved')
    else toast.error(result.error)
  }

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword) return toast.error('All fields required')
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('Passwords do not match')
    if (pwForm.newPassword.length < 6) return toast.error('Password must be at least 6 characters')
    const result = await window.api.auth.changePassword({ userId: user.id, ...pwForm })
    if (result.success) { toast.success('Password changed successfully'); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }) }
    else toast.error(result.error)
  }

  if (!settings) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your business configuration and account</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Business Settings */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} color="var(--accent-blue)" /> Business Information
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input className="input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="input" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="input" value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="textarea" style={{ minHeight: 60 }} value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="select" value={form.currency || 'USD'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {['USD', 'EUR', 'GBP', 'UGX', 'KES', 'NGN', 'ZAR', 'GHS', 'TZS', 'CAD', 'AUD', 'JPY', 'INR', 'CNY'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tax Rate (%)</label>
                  <input type="number" className="input" min={0} max={100} step={0.1} value={form.tax_rate || 0}
                    onChange={e => setForm(f => ({ ...f, tax_rate: Number(e.target.value) }))} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSaveBusiness} disabled={saving} style={{ alignSelf: 'flex-start' }}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />}
                Save Business Settings
              </button>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Account info */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Your Account</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              {[['Name', user?.full_name], ['Username', user?.username], ['Role', user?.role], ['Business', user?.business_name]].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                  <span style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Change Password */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={15} color="var(--accent-purple)" /> Change Password
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'currentPassword', label: 'Current Password', placeholder: 'Enter current password' },
                { key: 'newPassword', label: 'New Password', placeholder: 'Min 6 characters' },
                { key: 'confirmPassword', label: 'Confirm New Password', placeholder: 'Repeat new password' }
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="form-group">
                  <label className="form-label">{label}</label>
                  <input type="password" className="input" placeholder={placeholder} value={pwForm[key]}
                    onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <button className="btn btn-secondary" onClick={handleChangePassword} style={{ alignSelf: 'flex-start' }}>
                <Lock size={13} /> Update Password
              </button>
            </div>
          </div>

          {/* App info */}
          <div className="card">
            <div className="card-header"><div className="card-title">Application</div></div>
            {[['Version', '1.0.0'], ['Mode', 'Offline / Local'], ['Database', 'SQLite'], ['Platform', 'macOS']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                <span className="badge badge-blue">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
