import React, { useState, useEffect } from 'react'
import { Plus, Search, FileDown, AlertTriangle, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'
import { useAuth } from '../App'
import { fmt, fmtDate } from '../utils/format'
import { exportInventoryReport } from '../utils/export'
import toast from 'react-hot-toast'

export default function Inventory() {
  const { user } = useAuth()
  const bid = user?.business_id
  const currency = user?.currency || 'USD'

  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [categories, setCategories] = useState([])
  const [showAdjust, setShowAdjust] = useState(null) // product
  const [showMovements, setShowMovements] = useState(null)
  const [adjust, setAdjust] = useState({ type: 'add', quantity: 1, notes: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [inv, cats] = await Promise.all([
      window.api.inventory.list({ businessId: bid }),
      window.api.products.categories({ businessId: bid })
    ])
    setItems(inv || [])
    setCategories(cats || [])
    setLoading(false)
  }

  const loadMovements = async (productId) => {
    const mv = await window.api.inventory.movements({ businessId: bid, productId })
    setMovements(mv || [])
  }

  const filtered = items.filter(item => {
    const q = search.toLowerCase()
    const matchSearch = !q || item.name?.toLowerCase().includes(q) || item.sku?.toLowerCase().includes(q)
    const matchCat = !catFilter || item.category === catFilter
    return matchSearch && matchCat
  })

  const lowStockCount = items.filter(i => i.needs_reorder).length
  const totalValue = items.reduce((s, i) => s + (i.quantity_on_hand * i.cost_price), 0)

  const handleAdjust = async () => {
    if (!adjust.quantity || adjust.quantity <= 0) return toast.error('Enter a valid quantity')
    const result = await window.api.inventory.adjust({
      businessId: bid,
      productId: showAdjust.product_id,
      quantity: Number(adjust.quantity),
      type: adjust.type,
      notes: adjust.notes,
      createdBy: user.id
    })
    if (result.success) {
      toast.success(`Stock updated. New qty: ${result.newQuantity}`)
      setShowAdjust(null)
      setAdjust({ type: 'add', quantity: 1, notes: '' })
      loadAll()
    } else {
      toast.error(result.error)
    }
  }

  const mvTypeColor = { purchase: '#3b82f6', sale: '#10b981', adjustment: '#f59e0b', opening: '#8b5cf6', set: '#06b6d4' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">
            {filtered.length} products · Stock value: {fmt(totalValue, currency)}
            {lowStockCount > 0 && <span style={{ color: 'var(--accent-yellow)', marginLeft: 8 }}>⚠ {lowStockCount} low stock</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => exportInventoryReport(items, currency)}>
            <FileDown size={15} /> Export Excel
          </button>
          <button className="btn btn-secondary" onClick={loadAll}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input className="search-input" placeholder="Search products or SKU..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!filtered.find(i => i.needs_reorder)} onChange={() => {}} readOnly />
          Show low stock only
        </label>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Category</th>
              <th>On Hand</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Reorder At</th>
              <th>Cost Price</th>
              <th>Sell Price</th>
              <th>Stock Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No products found</td></tr>
            ) : filtered.map(item => (
              <tr key={item.product_id} style={{ borderLeft: item.needs_reorder ? '3px solid var(--accent-yellow)' : undefined }}>
                <td><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{item.sku || '-'}</span></td>
                <td style={{ fontWeight: 600 }}>
                  {item.needs_reorder && <AlertTriangle size={12} style={{ color: 'var(--accent-yellow)', marginRight: 5, verticalAlign: 'middle' }} />}
                  {item.name}
                </td>
                <td><span className="badge badge-blue">{item.category || '-'}</span></td>
                <td style={{ fontWeight: 600 }}>{item.quantity_on_hand}</td>
                <td style={{ color: 'var(--text-muted)' }}>{item.quantity_reserved || 0}</td>
                <td style={{ color: item.available_qty <= item.reorder_level ? 'var(--accent-yellow)' : 'var(--accent-green)', fontWeight: 600 }}>
                  {item.available_qty}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{item.reorder_level}</td>
                <td>{fmt(item.cost_price, currency)}</td>
                <td>{fmt(item.selling_price, currency)}</td>
                <td style={{ fontWeight: 600 }}>{fmt(item.quantity_on_hand * item.cost_price, currency)}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Add Stock" onClick={() => { setShowAdjust(item); setAdjust({ type: 'add', quantity: 1, notes: '' }) }} style={{ color: 'var(--accent-green)' }}>
                      <ArrowUp size={14} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Remove Stock" onClick={() => { setShowAdjust(item); setAdjust({ type: 'subtract', quantity: 1, notes: '' }) }} style={{ color: 'var(--accent-red)' }}>
                      <ArrowDown size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" title="View Movements" onClick={async () => { await loadMovements(item.product_id); setShowMovements(item) }} style={{ fontSize: 11 }}>
                      History
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Adjust Stock Modal */}
      {showAdjust && (
        <div className="modal-overlay" onClick={() => setShowAdjust(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Adjust Stock</h3>
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-primary)', borderRadius: 8 }}>
              <div style={{ fontWeight: 600 }}>{showAdjust.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current: {showAdjust.quantity_on_hand} {showAdjust.unit}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Adjustment Type</label>
                <select className="select" value={adjust.type} onChange={e => setAdjust(a => ({ ...a, type: e.target.value }))}>
                  <option value="add">Add Stock (Purchase / Return)</option>
                  <option value="subtract">Remove Stock (Write-off / Loss)</option>
                  <option value="set">Set Exact Quantity</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input type="number" className="input" min={0.01} step={0.01} value={adjust.quantity}
                  onChange={e => setAdjust(a => ({ ...a, quantity: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Reason / Notes</label>
                <textarea className="textarea" style={{ minHeight: 60 }} value={adjust.notes}
                  onChange={e => setAdjust(a => ({ ...a, notes: e.target.value }))} placeholder="e.g. Restocked from supplier..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdjust(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdjust}>Apply Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {/* Movements Modal */}
      {showMovements && (
        <div className="modal-overlay" onClick={() => setShowMovements(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Stock History — {showMovements.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Last 50 movements</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowMovements(null)}>✕</button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>Type</th><th>Quantity</th><th>Reference</th><th>Notes</th></tr></thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No movement history</td></tr>
                  ) : movements.map(m => (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{fmtDate(m.created_at)}</td>
                      <td>
                        <span className="badge" style={{ background: `${mvTypeColor[m.movement_type] || '#64748b'}22`, color: mvTypeColor[m.movement_type] || '#94a3b8' }}>
                          {m.movement_type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: ['sale', 'subtract'].includes(m.movement_type) ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                        {['sale', 'subtract'].includes(m.movement_type) ? '-' : '+'}{m.quantity}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.reference_id?.slice(0, 8) || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.notes || '-'}</td>
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
