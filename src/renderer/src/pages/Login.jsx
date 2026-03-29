import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Eye, EyeOff, Plus, Building2, Lock, User, AlertCircle } from 'lucide-react'
import { useAuth } from '../App'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [businesses, setBusinesses] = useState([])
  const [form, setForm] = useState({ businessId: '', username: 'admin', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [showNewBiz, setShowNewBiz] = useState(false)
  const [newBiz, setNewBiz] = useState({
    name: '', address: '', phone: '', email: '',
    currency: 'USD', taxRate: 0,
    adminUsername: 'admin', adminName: '', adminPassword: ''
  })

  // ── Check window.api is available (preload loaded correctly) ──────────────
  useEffect(() => {
    if (!window.api) {
      setApiError('window.api is not available — the preload script did not load correctly. Check DevTools console.')
      return
    }
    loadBusinesses()
  }, [])

  const loadBusinesses = async () => {
    try {
      const list = await window.api.auth.listBusinesses()
      setBusinesses(list || [])
      if (list?.length === 1) {
        setForm(f => ({ ...f, businessId: list[0].id }))
      }
    } catch (err) {
      setApiError(`Failed to load businesses: ${err.message}`)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!window.api) return toast.error('API bridge not available')
    if (!form.businessId) return toast.error('Please select a business')
    if (!form.username)   return toast.error('Please enter a username')
    if (!form.password)   return toast.error('Please enter a password')

    setLoading(true)
    try {
      const result = await window.api.auth.login(form)
      if (result.success) {
        login(result.user)
        navigate('/')
      } else {
        toast.error(result.error || 'Invalid credentials. Default: admin / admin123')
      }
    } catch (err) {
      toast.error(`Login error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBusiness = async (e) => {
    e.preventDefault()
    if (!newBiz.name)          return toast.error('Business name is required')
    if (!newBiz.adminName)     return toast.error('Admin full name is required')
    if (!newBiz.adminPassword) return toast.error('Admin password is required')

    setLoading(true)
    try {
      const result = await window.api.auth.createBusiness(newBiz)
      if (result.success) {
        toast.success('Business created! Log in with your new credentials.')
        setShowNewBiz(false)
        await loadBusinesses()
        setForm(f => ({ ...f, businessId: result.businessId, username: newBiz.adminUsername }))
      } else {
        toast.error(result.error || 'Could not create business')
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── Fatal API error screen ────────────────────────────────────────────────
  if (apiError) {
    return (
      <div className="login-page">
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 14, padding: 32, maxWidth: 500, width: '100%', textAlign: 'center'
        }}>
          <AlertCircle size={40} color="var(--accent-red)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: 'var(--accent-red)' }}>
            Application Error
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            {apiError}
          </p>
          <button className="btn btn-secondary" onClick={() => { setApiError(null); loadBusinesses() }}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
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
          /* ── Login Form ──────────────────────────────────────────────── */
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '36px 32px', boxShadow: 'var(--shadow-lg)'
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Welcome back</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 }}>
              Sign in to continue · Default: <code style={{ background: 'var(--bg-primary)', padding: '1px 6px', borderRadius: 4 }}>admin / admin123</code>
            </p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Business selector */}
              <div className="form-group">
                <label className="form-label">Business</label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <select className="select" style={{ paddingLeft: 34 }}
                    value={form.businessId}
                    onChange={e => setForm(f => ({ ...f, businessId: e.target.value }))}>
                    <option value="">
                      {businesses.length === 0 ? 'No businesses found — create one below' : 'Select business...'}
                    </option>
                    {businesses.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                {businesses.length === 0 && (
                  <p style={{ fontSize: 11, color: 'var(--accent-yellow)', marginTop: 4 }}>
                    ⚠ No businesses found. Create one below to get started.
                  </p>
                )}
              </div>

              {/* Username */}
              <div className="form-group">
                <label className="form-label">Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input className="input" style={{ paddingLeft: 34 }}
                    placeholder="admin"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    autoComplete="username" autoCapitalize="none" />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input className="input"
                    type={showPass ? 'text' : 'password'}
                    style={{ paddingLeft: 34, paddingRight: 40 }}
                    placeholder="admin123"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                  }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: 6, padding: '11px' }}>
                {loading
                  ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  : 'Sign In'}
              </button>
            </form>

            <div className="divider" />

            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setShowNewBiz(true)}>
              <Plus size={15} /> Create New Business
            </button>
          </div>

        ) : (
          /* ── Create Business Form ────────────────────────────────────── */
          <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '32px', boxShadow: 'var(--shadow-lg)', maxWidth: 480, margin: '0 auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create New Business</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNewBiz(false)}>← Back</button>
            </div>

            <form onSubmit={handleCreateBusiness} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Business Details
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Business Name *</label>
                  <input className="input" placeholder="Acme Ltd" value={newBiz.name}
                    onChange={e => setNewBiz(b => ({ ...b, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="input" type="email" placeholder="info@business.com" value={newBiz.email}
                    onChange={e => setNewBiz(b => ({ ...b, email: e.target.value }))} />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="input" placeholder="+256 700 000000" value={newBiz.phone}
                    onChange={e => setNewBiz(b => ({ ...b, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="select" value={newBiz.currency}
                    onChange={e => setNewBiz(b => ({ ...b, currency: e.target.value }))}>
                    {['USD','EUR','GBP','UGX','KES','NGN','ZAR','GHS','TZS','CAD','AUD','INR'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="input" placeholder="Plot 1, Kampala Road" value={newBiz.address}
                  onChange={e => setNewBiz(b => ({ ...b, address: e.target.value }))} />
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
                Admin Account
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Your Full Name *</label>
                  <input className="input" placeholder="John Smith" value={newBiz.adminName}
                    onChange={e => setNewBiz(b => ({ ...b, adminName: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="input" placeholder="admin" value={newBiz.adminUsername}
                    onChange={e => setNewBiz(b => ({ ...b, adminUsername: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="input" type="password" placeholder="Create a strong password"
                  value={newBiz.adminPassword}
                  onChange={e => setNewBiz(b => ({ ...b, adminPassword: e.target.value }))} required />
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '11px' }}>
                {loading
                  ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  : 'Create Business & Sign In'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
