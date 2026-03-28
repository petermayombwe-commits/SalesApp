import React, { useState, useEffect } from 'react'
import { Plus, Search, FileDown, Eye, X, Trash2 } from 'lucide-react'
import { useAuth } from '../App'
import { fmt, fmtDate, statusBadge } from '../utils/format'
import { exportSalesReport } from '../utils/export'
import toast from 'react-hot-toast'

export default function Sales() {
  const { user } = useAuth()
  const bid = user?.business_id
  const currency = user?.currency || 'USD'

  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [viewOrder, setViewOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  // New order form
  const [form, setForm] = useState({
    client_id: '', status: 'completed', due_date: '',
    payment_method: 'cash', paid_amount: '', discount_amount: 0, notes: '',
    items: [{ product_id: '', quantity: 1, unit_price: 0, discount_pct: 0 }]
  })

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [o, p, c] = await Promise.all([
      window.api.orders.list({ businessId: bid }),
      window.api.products.list({ businessId: bid }),
      window.api.clients.list({ businessId: bid })
    ])
    setOrders(o || [])
    setProducts(p || [])
    setClients(c || [])
    setLoading(false)
  }

  const filtered = orders.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = !q || o.order_number?.toLowerCase().includes(q) || o.client_name?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const addItem = () => setForm(f => ({
    ...f, items: [...f.items, { product_id: '', quantity: 1, unit_price: 0, discount_pct: 0 }]
  }))

  const removeItem = (idx) => setForm(f => ({
    ...f, items: f.items.filter((_, i) => i !== idx)
  }))

  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items]
      items[idx] = { ...items[idx], [field]: value }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === value)
        if (prod) items[idx].unit_price = prod.selling_price
      }
      return { ...f, items }
    })
  }

  const calcSubtotal = () => form.items.reduce((s, item) => {
    return s + (item.quantity * item.unit_price * (1 - (item.discount_pct || 0) / 100))
  }, 0)

  const calcTotal = () => {
    const sub = calcSubtotal()
    const tax = sub * ((user?.tax_rate || 0) / 100)
    return sub + tax - (Number(form.discount_amount) || 0)
  }

  const handleSubmit = async () => {
    if (!form.items[0].product_id) return toast.error('Add at least one product')
    const total = calcTotal()
    const paid = Number(form.paid_amount) || (form.status === 'completed' ? total : 0)

    const result = await window.api.orders.create({
      businessId: bid,
      data: {
        ...form,
        paid_amount: paid,
        items: form.items.filter(i => i.product_id),
        created_by: user.id
      }
    })

    if (result.success) {
      toast.success(`Order ${result.orderNumber} created`)
      setShowNew(false)
      setForm({ client_id: '', status: 'completed', due_date: '', payment_method: 'cash', paid_amount: '', discount_amount: 0, notes: '', items: [{ product_id: '', quantity: 1, unit_price: 0, discount_pct: 0 }] })
      loadAll()
      window.api.showNotification({ title: 'New Order', body: `Order ${result.orderNumber} recorded` })
    } else {
      toast.error(result.error)
    }
  }

  const handleViewOrder = async (id) => {
    const o = await window.api.orders.get({ id })
    setViewOrder(o)
  }

  const total_revenue = filtered.reduce((s, o) => s + o.total_amount, 0)
  const total_paid = filtered.reduce((s, o) => s + o.paid_amount, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales & Orders</h1>
          <p className="page-subtitle">{filtered.length} orders · {fmt(total_revenue, currency)} revenue</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => exportSalesReport(filtered, currency)}>
            <FileDown size={15} /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={15} /> New Order
          </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Revenue', val: fmt(total_revenue, currency), color: '#3b82f6' },
          { label: 'Collected', val: fmt(total_paid, currency), color: '#10b981' },
          { label: 'Outstanding', val: fmt(total_revenue - total_paid, currency), color: '#f59e0b' }
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.color }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input className="search-input" placeholder="Search orders or clients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date</th>
              <th>Client</th>
              <th>Items</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No orders found</td></tr>
            ) : filtered.map(o => (
              <tr key={o.id}>
                <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-blue)' }}>{o.order_number}</span></td>
                <td style={{ color: 'var(--text-secondary)' }}>{fmtDate(o.order_date)}</td>
                <td>{o.client_name || <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{o.item_count}</td>
                <td style={{ fontWeight: 600 }}>{fmt(o.total_amount, currency)}</td>
                <td style={{ color: 'var(--accent-green)' }}>{fmt(o.paid_amount, currency)}</td>
                <td style={{ color: o.total_amount > o.paid_amount ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                  {fmt(o.total_amount - o.paid_amount, currency)}
                </td>
                <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                <td>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleViewOrder(o.id)}>
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Order Modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">New Order</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>

            <div className="form-grid-2" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Client (optional)</label>
                <select className="select" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                  <option value="">Walk-in Customer</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="select" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {['cash', 'card', 'bank_transfer', 'mobile_money', 'credit', 'cheque'].map(m => (
                    <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Order Items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label className="form-label">Order Items</label>
                <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Item</button>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-primary)' }}>
                      {['Product', 'Qty', 'Unit Price', 'Disc %', 'Line Total', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => {
                      const lineTotal = item.quantity * item.unit_price * (1 - (item.discount_pct || 0) / 100)
                      return (
                        <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <select className="select" style={{ fontSize: 12 }} value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)}>
                              <option value="">Select product</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit}) — {fmt(p.selling_price, currency)}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input type="number" className="input" style={{ width: 70, fontSize: 12 }} min={0.01} step={0.01} value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input type="number" className="input" style={{ width: 90, fontSize: 12 }} min={0} step={0.01} value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input type="number" className="input" style={{ width: 60, fontSize: 12 }} min={0} max={100} value={item.discount_pct} onChange={e => updateItem(idx, 'discount_pct', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '6px 10px', fontWeight: 600, fontSize: 13 }}>{fmt(lineTotal, currency)}</td>
                          <td style={{ padding: '6px 8px' }}>
                            {form.items.length > 1 && (
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(idx)} style={{ color: 'var(--accent-red)' }}>
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals & Payment */}
            <div className="form-grid-2">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="textarea" style={{ minHeight: 60 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Order notes..." />
                </div>
              </div>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: 16 }}>
                {[
                  { l: 'Subtotal', v: fmt(calcSubtotal(), currency) },
                  { l: `Tax (${user?.tax_rate || 0}%)`, v: fmt(calcSubtotal() * ((user?.tax_rate || 0) / 100), currency) },
                  { l: 'Discount', v: `-${fmt(Number(form.discount_amount) || 0, currency)}` }
                ].map(row => (
                  <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span>{row.l}</span><span>{row.v}</span>
                  </div>
                ))}
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}>
                  <span>TOTAL</span><span style={{ color: 'var(--accent-blue)' }}>{fmt(calcTotal(), currency)}</span>
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Amount Paid</label>
                  <input type="number" className="input" placeholder={`Full: ${calcTotal().toFixed(2)}`} value={form.paid_amount}
                    onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Leave blank = paid in full</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                <Plus size={15} /> Create Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {viewOrder && (
        <div className="modal-overlay" onClick={() => setViewOrder(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Order {viewOrder.order_number}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{fmtDate(viewOrder.order_date)}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className={`badge ${statusBadge(viewOrder.status)}`}>{viewOrder.status}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setViewOrder(null)}><X size={18} /></button>
              </div>
            </div>
            {viewOrder.client_name && (
              <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>{viewOrder.client_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{viewOrder.client_email} · {viewOrder.client_phone}</div>
              </div>
            )}
            <div className="table-container" style={{ marginBottom: 16 }}>
              <table className="table">
                <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Disc</th><th>Total</th></tr></thead>
                <tbody>
                  {viewOrder.items?.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>{item.sku}</td>
                      <td>{item.quantity} {item.unit}</td>
                      <td>{fmt(item.unit_price, currency)}</td>
                      <td>{item.discount_pct > 0 ? `${item.discount_pct}%` : '-'}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(item.line_total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 240 }}>
                {[['Subtotal', viewOrder.subtotal], ['Tax', viewOrder.tax_amount], ['Discount', viewOrder.discount_amount]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span>{l}</span><span>{fmt(v, currency)}</span>
                  </div>
                ))}
                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                  <span>Total</span><span>{fmt(viewOrder.total_amount, currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-green)', fontSize: 13 }}>
                  <span>Paid</span><span>{fmt(viewOrder.paid_amount, currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-red)', fontSize: 13, fontWeight: 600 }}>
                  <span>Balance</span><span>{fmt(viewOrder.total_amount - viewOrder.paid_amount, currency)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
