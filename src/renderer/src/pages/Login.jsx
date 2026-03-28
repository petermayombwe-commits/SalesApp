import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Eye, EyeOff, Plus, Building2, Lock, User } from 'lucide-react'
import { useAuth } from '../App'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [form, setForm] = useState({ businessId: '', username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showNewBiz, setShowNewBiz] = useState(false)
  const [newBiz, setNewBiz] = useState({
    name: '', address: '', phone: '', email: '', currency: 'USD',
    taxRate: 0, adminUsername: 'admin', adminName: '', adminPassword: ''
  })

  useEffect(() => { loadBusinesses() }, [])

  const loadBusinesses = async () => {
    const list = await window.api.auth.listBusinesses()
    setBusinesses(list || [])
    if (list?.length === 1) setForm(f => ({ ...f, businessId: list[0].id }))
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!form.businessId) return toast.error('Please select a business')
    setLoading(true)
    const result = await window.api.auth.login(form)
    setLoading(false)
    if (result.success) {
      login(result.user)
      navigate('/')
    } else {
      toast.error(result.error || 'Login failed')
    }
  }

  const handleCreateBusiness = async (e) => {
    e.preventDefault()
    if (!newBiz.name || !newBiz.adminPassword) return toast.error('Business name and admin password required')
    setLoading(true)
    const result = await window.api.auth.createBusiness(newBiz)
    setLoading(false)
    if (result.success) {
      toast.success('Business created! You can now log in.')
      setShowNewBiz(false)
      loadBusinesses()
      setForm(f => ({ ...f, businessId: result.businessId, username: newBiz.adminUsername }))
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="login-page">
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div className="login-logo" style={{ marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 52, height: 52, background: 'var(--gradient-blue)',
              borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(59,130,246,0.4)'
            }}>
              <TrendingUp size={26} color="white" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px' }}>SalesFlow</div>
              <div style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 700, letterSpacing: '0.15em' }}>PRO</div>
            </div>
          </div>
        </div>

        {!showNewBiz ? (
          <div className="login-card">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Welcome back</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
              Sign in to your account to continue
            </p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Business</label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <select
                    className="select"
                    style={{ paddingLeft: 34 }}
                    value={form.businessId}
                    onChange={e => setForm(f => ({ ...f, businessId: e.target.value }))}
                  >
                    <option value="">Select business...</option>
                    {businesses.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="input" style={{ paddingLeft: 34 }}
                    placeholder="Enter username"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="input" type={showPass ? 'text' : 'password'}
                    style={{ paddingLeft: 34, paddingRight: 38 }}
                    placeholder="Enter password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 6, padding: '10px' }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Sign In'}
              </button>
            </form>

            <div className="divider" />
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowNewBiz(true)}>
              <Plus size={15} /> Create New Business
            </button>
          </div>
        ) : (
          <div className="login-card" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create New Business</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNewBiz(false)}>← Back</button>
            </div>

            <form onSubmit={handleCreateBusiness} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Business Details</div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Business Name *</label>
                  <input className="input" placeholder="My Business Ltd" value={newBiz.name} onChange={e => setNewBiz(b => ({ ...b, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="input" type="email" placeholder="info@business.com" value={newBiz.email} onChange={e => setNewBiz(b => ({ ...b, email: e.target.value }))} />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="input" placeholder="+1 555-0100" value={newBiz.phone} onChange={e => setNewBiz(b => ({ ...b, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="select" value={newBiz.currency} onChange={e => setNewBiz(b => ({ ...b, currency: e.target.value }))}>
                    {['USD','EUR','GBP','UGX','KES','NGN','ZAR','GHS','TZS','CAD','AUD'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="input" placeholder="123 Main Street, City" value={newBiz.address} onChange={e => setNewBiz(b => ({ ...b, address: e.target.value }))} />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6 }}>Admin Account</div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Admin Name *</label>
                  <input className="input" placeholder="John Smith" value={newBiz.adminName} onChange={e => setNewBiz(b => ({ ...b, adminName: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="input" placeholder="admin" value={newBiz.adminUsername} onChange={e => setNewBiz(b => ({ ...b, adminUsername: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="input" type="password" placeholder="Create a strong password" value={newBiz.adminPassword} onChange={e => setNewBiz(b => ({ ...b, adminPassword: e.target.value }))} required />
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '10px' }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Create Business & Account'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
