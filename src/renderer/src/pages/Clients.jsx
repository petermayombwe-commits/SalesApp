import React, { useState, useEffect } from 'react'
import { Plus, Search, FileDown, User, X, Book } from 'lucide-react'
import { useAuth } from '../App'
import { fmt, fmtDate } from '../utils/format'
import { exportClientLedger } from '../utils/export'
import toast from 'react-hot-toast'

const BLANK = { name: '', company: '', email: '', phone: '', address: '', credit_limit: 0, credit_terms: 30, notes: '' }

export default function Clients() {
  const { user } = useAuth()
  const bid = user?.business_id
  const currency = user?.currency || 'USD'

  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showLedger, setShowLedger] = useState(null)
  const [ledger, setLedger] = useState([])
  const [editClient, setEditClient] = useState(null)
  const [form, setForm] = useState(BLANK)

  useEffect(() => { loadClients() }, [])

  const loadClients = async () => {
    const data = await window.api.clients.list({ businessId: bid })
    setClients(data || [])
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return !q || c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q)
  })

  const handleSave = async () => {
    if (!form.name) return toast.error('Client name is required')
    let result
    if (editClient) {
      result = await window.api.clients.update({ id: editClient.id, data: form })
    } else {
      result = await window.api.clients.create({ businessId: bid, data: form })
    }
    if (result.success) {
      toast.success(editClient ? 'Client updated' : 'Client created')
      setShowForm(false)
      setEditClient(null)
      setForm(BLANK)
      loadClients()
    } else {
      toast.error(result.error)
    }
  }

  const openLedger = async (client) => {
    const full = await window.api.clients.get({ id: client.id })
    const lData = await window.api.clients.ledger({ clientId: client.id })
    setShowLedger(full || client)
    setLedger(lData || [])
  }

  const openEdit = (client) => {
    setEditClient(client)
    setForm({
      name: client.name, company: client.company || '', email: client.email || '',
      phone: client.phone || '', address: client.address || '',
      credit_limit: client.credit_limit || 0, credit_terms: client.credit_terms || 30,
      notes: client.notes || '', is_active: client.is_active !== 0
    })
    setShowForm(true)
  }

  const totalCreditExposure = clients.reduce((s, c) => s + (c.outstanding_credit || 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{clients.length} clients · Credit exposure: {fmt(totalCreditExposure, currency)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => { setEditClient(null); setForm(BLANK); setShowForm(true) }}>
            <Plus size={15} /> New Client
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input className="search-input" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Company</th>
              <th>Contact</th>
              <th>Credit Limit</th>
              <th>Outstanding</th>
              <th>Total Sales</th>
              <th>Orders</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No clients found</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{c.code}</span></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, background: '#3b82f622', color: '#3b82f6' }}>
                      {c.name?.charAt(0)}
                    </div>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.company || '-'}</td>
                <td>
                  <div style={{ fontSize: 12 }}>{c.email || '-'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone || ''}</div>
                </td>
                <td>{fmt(c.credit_limit, currency)}</td>
                <td style={{ color: c.outstanding_credit > 0 ? 'var(--accent-yellow)' : 'var(--text-muted)', fontWeight: c.outstanding_credit > 0 ? 600 : 400 }}>
                  {fmt(c.outstanding_credit, currency)}
                </td>
                <td style={{ fontWeight: 600 }}>{fmt(c.total_sales, currency)}</td>
                <td>{c.total_orders}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openLedger(c)} style={{ fontSize: 11 }}>
                      <Book size={12} /> Ledger
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)} style={{ fontSize: 11 }}>Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Client Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editClient ? 'Edit Client' : 'New Client'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Client Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Company</label>
                  <input className="input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company name" />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Credit Limit ({currency})</label>
                  <input type="number" className="input" min={0} value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Credit Terms (days)</label>
                  <input type="number" className="input" min={0} value={form.credit_terms} onChange={e => setForm(f => ({ ...f, credit_terms: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editClient ? 'Save Changes' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {showLedger && (
        <div className="modal-overlay" onClick={() => setShowLedger(null)}>
          <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Ledger — {showLedger.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {showLedger.company && `${showLedger.company} · `}
                  {showLedger.email} · {showLedger.phone}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => exportClientLedger(showLedger, ledger, currency)}>
                  <FileDown size={13} /> Export
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowLedger(null)}><X size={18} /></button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { l: 'Credit Limit', v: fmt(showLedger.credit_limit, currency), c: '#3b82f6' },
                { l: 'Outstanding', v: fmt(showLedger.current_balance, currency), c: '#f59e0b' },
                { l: 'Available Credit', v: fmt((showLedger.credit_limit || 0) - (showLedger.current_balance || 0), currency), c: '#10b981' }
              ].map(i => (
                <div key={i.l} style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{i.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: i.c }}>{i.v}</div>
                </div>
              ))}
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Type</th><th>Reference</th><th>Date</th><th>Debit</th><th>Credit</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No transactions</td></tr>
                  ) : ledger.map((l, i) => (
                    <tr key={i}>
                      <td><span className={`badge ${l.type === 'order' ? 'badge-blue' : 'badge-green'}`}>{l.type}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-blue)' }}>{l.ref || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(l.date)}</td>
                      <td style={{ color: 'var(--accent-red)', fontWeight: l.debit > 0 ? 600 : 400 }}>
                        {l.debit > 0 ? fmt(l.debit, currency) : '-'}
                      </td>
                      <td style={{ color: 'var(--accent-green)', fontWeight: l.credit > 0 ? 600 : 400 }}>
                        {l.credit > 0 ? fmt(l.credit, currency) : '-'}
                      </td>
                      <td><span className={`badge ${l.status === 'paid' || l.status === 'completed' ? 'badge-green' : l.status === 'cancelled' ? 'badge-gray' : 'badge-yellow'}`}>{l.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
