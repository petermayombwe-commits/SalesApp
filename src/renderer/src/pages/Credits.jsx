import React, { useState, useEffect } from 'react'
import { Search, FileDown, DollarSign, Clock, AlertTriangle, X, Settings, Check } from 'lucide-react'
import { useAuth } from '../App'
import { fmt, fmtDate, daysUntil } from '../utils/format'
import { exportCreditsReport } from '../utils/export'
import toast from 'react-hot-toast'

export default function Credits() {
  const { user } = useAuth()
  const bid = user?.business_id
  const currency = user?.currency || 'USD'

  const [credits, setCredits] = useState([])
  const [overdue, setOverdue] = useState([])
  const [rules, setRules] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('outstanding')
  const [showPayment, setShowPayment] = useState(null)
  const [showRules, setShowRules] = useState(false)
  const [payment, setPayment] = useState({ amount: '', method: 'cash', reference: '', notes: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [c, od, r] = await Promise.all([
      window.api.credits.list({ businessId: bid }),
      window.api.credits.overdue({ businessId: bid }),
      window.api.credits.rules.list({ businessId: bid })
    ])
    setCredits(c || [])
    setOverdue(od || [])
    setRules(r || [])
    setLoading(false)
  }

  const filtered = credits.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || c.client_name?.toLowerCase().includes(q) || c.order_number?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalOutstanding = credits.filter(c => c.status === 'outstanding').reduce((s, c) => s + c.balance, 0)
  const totalOverdue = overdue.reduce((s, o) => s + o.balance, 0)

  const handlePayment = async () => {
    if (payment.amount === '' || payment.amount === null || payment.amount === undefined) return toast.error('Enter a payment amount')
    const result = await window.api.credits.recordPayment({
      creditId: showPayment.id,
      amount: Number(payment.amount),
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      recordedBy: user.id
    })
    if (result.success) {
      toast.success(`Payment recorded. ${result.newStatus === 'settled' ? '✓ Account settled!' : `Balance: ${fmt(result.newBalance, currency)}`}`)
      setShowPayment(null)
      setPayment({ amount: '', method: 'cash', reference: '', notes: '' })
      loadAll()
    } else {
      toast.error(result.error)
    }
  }

  const saveRules = async () => {
    const result = await window.api.credits.rules.save({ businessId: bid, rules })
    if (result.success) {
      toast.success('Collection rules saved')
      setShowRules(false)
    } else {
      toast.error(result.error)
    }
  }

  const addRule = () => setRules(r => [...r, {
    id: null, name: '', days_overdue: 0, action_type: 'reminder',
    message_template: 'Your payment of {amount} is due.', is_active: true
  }])

  const updateRule = (idx, field, val) => setRules(r => r.map((rule, i) => i === idx ? { ...rule, [field]: val } : rule))

  const getDueBadge = (dueDate) => {
    if (!dueDate) return null
    const days = daysUntil(dueDate)
    if (days < 0) return <span className="badge badge-red">Overdue {Math.abs(days)}d</span>
    if (days === 0) return <span className="badge badge-yellow">Due today</span>
    if (days <= 7) return <span className="badge badge-yellow">Due in {days}d</span>
    return <span className="badge badge-gray">Due in {days}d</span>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Credit Management</h1>
          <p className="page-subtitle">{filtered.length} credit entries · Outstanding: {fmt(totalOutstanding, currency)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowRules(true)}>
            <Settings size={15} /> Collection Rules
          </button>
          <button className="btn btn-secondary" onClick={() => exportCreditsReport(credits, currency)}>
            <FileDown size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-yellow)' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Clock size={20} color="var(--accent-yellow)" />
          </div>
          <div className="stat-card-value">{fmt(totalOutstanding, currency)}</div>
          <div className="stat-card-label">Total Outstanding</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-red)' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <AlertTriangle size={20} color="var(--accent-red)" />
          </div>
          <div className="stat-card-value">{fmt(totalOverdue, currency)}</div>
          <div className="stat-card-label">Overdue ({overdue.length} accounts)</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <Check size={20} color="var(--accent-green)" />
          </div>
          <div className="stat-card-value">{credits.filter(c => c.status === 'settled').length}</div>
          <div className="stat-card-label">Settled Accounts</div>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {overdue.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="var(--accent-red)" />
          <span style={{ fontSize: 13, color: 'var(--accent-red)', fontWeight: 600 }}>
            {overdue.length} account{overdue.length > 1 ? 's are' : ' is'} overdue — {fmt(totalOverdue, currency)} total
          </span>
          <button className="btn btn-sm" style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.2)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.3)' }}
            onClick={async () => {
              await window.api.notifications.generateCreditAlerts({ businessId: bid })
              toast.success('Credit alerts generated')
            }}>
            Send Alerts
          </button>
        </div>
      )}

      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input className="search-input" placeholder="Search client or order..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="outstanding">Outstanding</option>
          <option value="settled">Settled</option>
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Order #</th>
              <th>Original Amount</th>
              <th>Balance</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No credits found</td></tr>
            ) : filtered.map(c => {
              const overdueDays = c.due_date ? Math.round((new Date() - new Date(c.due_date)) / 86400000) : 0
              return (
                <tr key={c.id} style={{ borderLeft: overdueDays > 0 && c.status === 'outstanding' ? '3px solid var(--accent-red)' : undefined }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.client_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.client_code}</div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-blue)' }}>{c.order_number || '-'}</td>
                  <td>{fmt(c.amount, currency)}</td>
                  <td style={{ fontWeight: 700, color: c.balance > 0 ? 'var(--accent-yellow)' : 'var(--accent-green)' }}>{fmt(c.balance, currency)}</td>
                  <td>
                    <div style={{ marginBottom: 3 }}>{fmtDate(c.due_date)}</div>
                    {c.status === 'outstanding' && getDueBadge(c.due_date)}
                  </td>
                  <td>
                    <span className={`badge ${c.status === 'settled' ? 'badge-green' : overdueDays > 0 ? 'badge-red' : 'badge-yellow'}`}>
                      {c.status === 'settled' ? 'Settled' : overdueDays > 0 ? `Overdue ${overdueDays}d` : 'Outstanding'}
                    </span>
                  </td>
                  <td>
                    {c.status === 'outstanding' && (
                      <button className="btn btn-success btn-sm" onClick={() => { setShowPayment(c); setPayment({ amount: c.balance.toFixed(2), method: 'cash', reference: '', notes: '' }) }}>
                        <DollarSign size={13} /> Record Payment
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <div className="modal-overlay" onClick={() => setShowPayment(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record Payment</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowPayment(null)}><X size={18} /></button>
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: 14, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{showPayment.client_name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Balance due:</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-yellow)' }}>{fmt(showPayment.balance, currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Due date:</span>
                <span>{fmtDate(showPayment.due_date)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Amount Paid ({currency})</label>
                <input type="number" className="input" min={0} step={0.01} value={payment.amount}
                  onChange={e => setPayment(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="select" value={payment.method} onChange={e => setPayment(p => ({ ...p, method: e.target.value }))}>
                  {['cash', 'card', 'bank_transfer', 'mobile_money', 'cheque'].map(m => (
                    <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference / Cheque Number</label>
                <input className="input" placeholder="Optional reference" value={payment.reference}
                  onChange={e => setPayment(p => ({ ...p, reference: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="textarea" style={{ minHeight: 55 }} value={payment.notes}
                  onChange={e => setPayment(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPayment(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handlePayment}>
                <Check size={15} /> Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection Rules Modal */}
      {showRules && (
        <div className="modal-overlay" onClick={() => setShowRules(false)}>
          <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Debt Collection Rules</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Configure automatic reminders and escalation triggers based on due date
                </p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowRules(false)}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              {rules.map((rule, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 2fr 80px auto', gap: 10, alignItems: 'start', marginBottom: 10, background: 'var(--bg-primary)', padding: 12, borderRadius: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Rule Name</label>
                    <input className="input" value={rule.name} onChange={e => updateRule(idx, 'name', e.target.value)} placeholder="e.g. 7-day reminder" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Days (- = before)</label>
                    <input type="number" className="input" value={rule.days_overdue} onChange={e => updateRule(idx, 'days_overdue', Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Action Type</label>
                    <select className="select" value={rule.action_type} onChange={e => updateRule(idx, 'action_type', e.target.value)}>
                      {['reminder', 'due', 'demand', 'escalate', 'final_notice'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message Template ({'{amount}'}, {'{client}'}, {'{days}'})</label>
                    <textarea className="textarea" style={{ minHeight: 50, fontSize: 12 }} value={rule.message_template} onChange={e => updateRule(idx, 'message_template', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginTop: 18 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                      <input type="checkbox" checked={rule.is_active} onChange={e => updateRule(idx, 'is_active', e.target.checked)} />
                      Active
                    </label>
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }} onClick={() => setRules(r => r.filter((_, i) => i !== idx))}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn btn-secondary btn-sm" onClick={addRule}>+ Add Rule</button>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRules(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveRules}>Save Rules</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
