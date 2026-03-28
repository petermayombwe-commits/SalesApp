// Products Page
import React, { useState, useEffect } from 'react'
import { Plus, Search, X, Package } from 'lucide-react'
import { useAuth } from '../App'
import { fmt } from '../utils/format'
import toast from 'react-hot-toast'

const BLANK_PROD = { sku: '', name: '', description: '', category: '', unit: 'pcs', cost_price: 0, selling_price: 0, reorder_level: 10, initial_stock: 0, is_active: true }

export default function Products() {
  const { user } = useAuth()
  const bid = user?.business_id
  const currency = user?.currency || 'USD'

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [form, setForm] = useState(BLANK_PROD)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const [p, c] = await Promise.all([
      window.api.products.list({ businessId: bid }),
      window.api.products.categories({ businessId: bid })
    ])
    setProducts(p || [])
    setCategories(c || [])
  }

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const ms = !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    const mc = !catFilter || p.category === catFilter
    return ms && mc
  })

  const handleSave = async () => {
    if (!form.name) return toast.error('Product name required')
    let result
    if (editProduct) {
      result = await window.api.products.update({ id: editProduct.id, data: form })
    } else {
      result = await window.api.products.create({ businessId: bid, data: form })
    }
    if (result.success) {
      toast.success(editProduct ? 'Product updated' : 'Product created')
      setShowForm(false)
      setEditProduct(null)
      setForm(BLANK_PROD)
      loadAll()
    } else {
      toast.error(result.error)
    }
  }

  const openEdit = (p) => {
    setEditProduct(p)
    setForm({ sku: p.sku || '', name: p.name, description: p.description || '', category: p.category || '', unit: p.unit || 'pcs', cost_price: p.cost_price, selling_price: p.selling_price, reorder_level: p.reorder_level, is_active: p.is_active !== 0 })
    setShowForm(true)
  }

  const margin = (p) => {
    if (!p.cost_price || !p.selling_price) return 0
    return ((p.selling_price - p.cost_price) / p.selling_price * 100).toFixed(1)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{products.length} products across {categories.length} categories</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditProduct(null); setForm(BLANK_PROD); setShowForm(true) }}>
          <Plus size={15} /> New Product
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input className="search-input" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 160 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr><th>SKU</th><th>Product</th><th>Category</th><th>Unit</th><th>Cost</th><th>Price</th><th>Margin</th><th>In Stock</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{p.sku || '-'}</td>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td><span className="badge badge-blue">{p.category || '-'}</span></td>
                <td style={{ color: 'var(--text-secondary)' }}>{p.unit}</td>
                <td>{fmt(p.cost_price, currency)}</td>
                <td style={{ fontWeight: 600 }}>{fmt(p.selling_price, currency)}</td>
                <td>
                  <span style={{ color: margin(p) > 30 ? 'var(--accent-green)' : margin(p) > 15 ? 'var(--accent-yellow)' : 'var(--accent-red)', fontWeight: 600 }}>
                    {margin(p)}%
                  </span>
                </td>
                <td>{p.quantity_on_hand ?? '-'}</td>
                <td><span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} style={{ fontSize: 11 }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editProduct ? 'Edit Product' : 'New Product'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU / Code</label>
                  <input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. WID-001" />
                </div>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input className="input" list="cats" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                  <datalist id="cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <select className="select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    {['pcs', 'kg', 'g', 'litre', 'ml', 'box', 'pack', 'metre', 'sqm', 'hour'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reorder Level</label>
                  <input type="number" className="input" min={0} value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Cost Price ({currency})</label>
                  <input type="number" className="input" min={0} step={0.01} value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price ({currency})</label>
                  <input type="number" className="input" min={0} step={0.01} value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: Number(e.target.value) }))} />
                </div>
                {!editProduct && (
                  <div className="form-group">
                    <label className="form-label">Opening Stock</label>
                    <input type="number" className="input" min={0} value={form.initial_stock} onChange={e => setForm(f => ({ ...f, initial_stock: Number(e.target.value) }))} />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="textarea" style={{ minHeight: 60 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {editProduct && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  Active product
                </label>
              )}
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 8, padding: '10px 14px', marginTop: 14, fontSize: 13 }}>
              Margin: {form.selling_price > 0 && form.cost_price >= 0 ? ((form.selling_price - form.cost_price) / form.selling_price * 100).toFixed(1) : 0}%
              · Markup: {form.cost_price > 0 ? ((form.selling_price - form.cost_price) / form.cost_price * 100).toFixed(1) : 0}%
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editProduct ? 'Save Changes' : 'Create Product'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
