import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Plus, Search, FileDown, X, Trash2, Pencil,
  TrendingUp, TrendingDown, DollarSign, Tag,
  Settings, ChevronUp, ChevronDown, AlertCircle
} from 'lucide-react'
import { useAuth } from '../App'
import { fmt, fmtDate } from '../utils/format'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const PAYMENT_METHODS = ['cash','card','bank_transfer','mobile_money','cheque','other']

const BLANK = {
  title: '', description: '', amount: '',
  category_id: '', expense_date: new Date().toISOString().slice(0, 10),
  payment_method: 'cash', vendor: '', reference: '',
  receipt_note: '', is_recurring: false, recurrence: ''
}

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#f8fafc', fontSize: 13, fontWeight: 600 }}>
          {p.name}: {fmt(p.value, currency)}
        </p>
      ))}
    </div>
  )
}

export default function Expenses() {
  const { user } = useAuth()
  const bid      = user?.business_id
  const currency = user?.currency || 'USD'

  const [expenses, setExpenses]       = useState([])
  const [categories, setCategories]   = useState([])
  const [summary, setSummary]         = useState(null)
  const [byCat, setByCat]             = useState([])
  const [overTime, setOverTime]       = useState([])
  const [pl, setPL]                   = useState(null)
  const [period, setPeriod]           = useState('month')
  const [search, setSearch]           = useState('')
  const [catFilter, setCatFilter]     = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [editExpense, setEditExpense] = useState(null)
  const [form, setForm]               = useState(BLANK)
  const [showCatMgr, setShowCatMgr]  = useState(false)
  const [newCatName, setNewCatName]   = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState('list') // list | analytics | pl

  useEffect(() => { loadAll() }, [period])

  const loadAll = async () => {
    setLoading(true)
    const days = period === 'week' ? 7 : period === 'year' ? 365 : 30
    const [exp, cats, sum, cat, ot, plData] = await Promise.all([
      window.api.expenses.list({ businessId: bid }),
      window.api.expenses.categories.list({ businessId: bid }),
      window.api.expenses.summary({ businessId: bid, period }),
      window.api.expenses.byCategory({ businessId: bid, period }),
      window.api.expenses.overTime({ businessId: bid, days }),
      window.api.expenses.profitLoss({ businessId: bid, period })
    ])
    setExpenses(exp || [])
    setCategories(cats || [])
    setSummary(sum)
    setByCat(cat || [])
    setOverTime(ot || [])
    setPL(plData)
    setLoading(false)
  }

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase()
    return (!q || e.title?.toLowerCase().includes(q) || e.vendor?.toLowerCase().includes(q) || e.category_name?.toLowerCase().includes(q))
      && (!catFilter || e.category_id === catFilter)
  })

  // ── Save expense ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title)  return toast.error('Title is required')
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0)
      return toast.error('Enter a valid amount')

    let result
    if (editExpense) {
      result = await window.api.expenses.update({ id: editExpense.id, data: { ...form, recorded_by: user.id } })
    } else {
      result = await window.api.expenses.create({ businessId: bid, data: { ...form, recorded_by: user.id } })
    }

    if (result.success) {
      toast.success(editExpense ? 'Expense updated' : 'Expense recorded')
      setShowForm(false); setEditExpense(null); setForm(BLANK)
      loadAll()
    } else {
      toast.error(result.error)
    }
  }

  const openEdit = (e) => {
    setEditExpense(e)
    setForm({
      title: e.title, description: e.description || '',
      amount: e.amount, category_id: e.category_id || '',
      expense_date: e.expense_date?.slice(0, 10) || '',
      payment_method: e.payment_method || 'cash',
      vendor: e.vendor || '', reference: e.reference || '',
      receipt_note: e.receipt_note || '',
      is_recurring: !!e.is_recurring, recurrence: e.recurrence || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return
    const r = await window.api.expenses.delete({ id })
    if (r.success) { toast.success('Deleted'); loadAll() }
    else toast.error(r.error)
  }

  // ── Add category ───────────────────────────────────────────────────────────
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return toast.error('Enter a category name')
    const r = await window.api.expenses.categories.save({
      businessId: bid,
      categories: [{ id: null, name: newCatName.trim(), color: newCatColor }]
    })
    if (r.success) { setNewCatName(''); loadAll(); toast.success('Category added') }
    else toast.error(r.error)
  }

  const handleDeleteCat = async (id) => {
    const r = await window.api.expenses.categories.delete({ id })
    if (r.success) { loadAll(); toast.success('Category removed') } else toast.error(r.error)
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportExpenses = () => {
    const wb = XLSX.utils.book_new()
    const data = [
      ['Date', 'Title', 'Category', 'Vendor', 'Amount', 'Payment Method', 'Reference', 'Notes'],
      ...filtered.map(e => [
        e.expense_date?.slice(0, 10),
        e.title, e.category_name || 'Uncategorised',
        e.vendor || '', Number(e.amount).toFixed(2),
        e.payment_method, e.reference || '', e.receipt_note || ''
      ])
    ]
    if (pl) {
      data.push([])
      data.push(['--- PROFIT & LOSS SUMMARY ---'])
      data.push(['Revenue',        Number(pl.revenue).toFixed(2)])
      data.push(['Cost of Goods',  Number(pl.cogs).toFixed(2)])
      data.push(['Gross Profit',   Number(pl.gross_profit).toFixed(2)])
      data.push(['Total Expenses', Number(pl.expenses).toFixed(2)])
      data.push(['Net Profit',     Number(pl.net_profit).toFixed(2)])
    }
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
    XLSX.writeFile(wb, `Expenses_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const PLRow = ({ label, value, highlight, border, indent }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: `${border ? '12px 0' : '8px 0'}`,
      borderTop: border ? '1px solid var(--border)' : 'none',
      paddingLeft: indent ? 16 : 0
    }}>
      <span style={{ fontSize: indent ? 13 : 14, color: indent ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: highlight ? 700 : 400 }}>{label}</span>
      <span style={{
        fontSize: highlight ? 16 : 14,
        fontWeight: highlight ? 800 : 600,
        color: typeof value === 'number' ? (value >= 0 ? (highlight ? 'var(--accent-green)' : 'var(--text-primary)') : 'var(--accent-red)') : 'var(--text-muted)'
      }}>
        {typeof value === 'number' ? fmt(value, currency) : value}
      </span>
    </div>
  )

  const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316','#64748b']

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Expenses</h1>
          <p className="page-subtitle">Track spending, analyse costs and view profit & loss</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowCatMgr(true)}>
            <Tag size={14} /> Categories
          </button>
          <button className="btn btn-secondary" onClick={exportExpenses}>
            <FileDown size={14} /> Export Excel
          </button>
          <button className="btn btn-primary" onClick={() => { setEditExpense(null); setForm(BLANK); setShowForm(true) }}>
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['week', 'month', 'year'].map(p => (
          <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPeriod(p)} style={{ textTransform: 'capitalize' }}>{p}</button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Expenses',    value: fmt(summary?.total_amount || 0, currency), icon: TrendingDown, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
          { label: 'No. of Expenses',   value: summary?.total_count || 0,                 icon: DollarSign,   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
          { label: 'Average Expense',   value: fmt(summary?.avg_amount || 0, currency),   icon: TrendingUp,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
          { label: 'Net Profit',        value: fmt(pl?.net_profit || 0, currency),        icon: pl?.net_profit >= 0 ? TrendingUp : TrendingDown,
            color: (pl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444',
            bg:    (pl?.net_profit || 0) >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }
        ].map((c, i) => (
          <div key={i} className="stat-card" style={{ borderLeft: `3px solid ${c.color}` }}>
            <div className="stat-card-icon" style={{ background: c.bg }}>
              <c.icon size={20} color={c.color} />
            </div>
            <div className="stat-card-value" style={{ color: c.color }}>{c.value}</div>
            <div className="stat-card-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        {[['list','Expense List'], ['analytics','Analytics'], ['pl','Profit & Loss']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`btn btn-sm ${activeTab === key ? 'btn-primary' : 'btn-ghost'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Expense List ──────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <>
          <div className="filter-bar">
            <div className="search-wrapper">
              <Search size={14} className="search-icon" />
              <input className="search-input" placeholder="Search expenses..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="select" style={{ width: 180 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th><th>Title</th><th>Category</th><th>Vendor</th>
                  <th>Amount</th><th>Method</th><th>Recurring</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No expenses found. Click <strong>Add Expense</strong> to get started.
                  </td></tr>
                ) : filtered.map(e => (
                  <tr key={e.id}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(e.expense_date)}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{e.title}</div>
                      {e.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.description}</div>}
                    </td>
                    <td>
                      {e.category_name ? (
                        <span className="badge" style={{ background: `${e.category_color}22`, color: e.category_color }}>
                          {e.category_name}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{e.vendor || '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-red)' }}>{fmt(e.amount, currency)}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{e.payment_method?.replace('_', ' ')}</td>
                    <td>
                      {e.is_recurring
                        ? <span className="badge badge-purple">{e.recurrence || 'Recurring'}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(e)}
                          style={{ color: 'var(--accent-blue)' }}><Pencil size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(e.id)}
                          style={{ color: 'var(--accent-red)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Tab: Analytics ────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Expenses over time */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <div className="card-title">Expenses Over Time</div>
            </div>
            {overTime.length === 0 ? (
              <div className="empty-state"><TrendingDown size={32} /><h3>No data</h3><p>Record expenses to see trends</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={overTime}>
                  <defs>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                  <Tooltip content={<CustomTooltip currency={currency} />} />
                  <Area type="monotone" dataKey="total" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By Category Pie */}
          <div className="card">
            <div className="card-header"><div className="card-title">By Category</div></div>
            {byCat.length === 0 ? (
              <div className="empty-state"><Tag size={28} /><p>No categorised expenses</p></div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={byCat} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                      {byCat.map((entry, i) => (
                        <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v, currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {byCat.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color || COLORS[i % COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{c.category || 'Uncategorised'}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(c.total, currency)}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({c.count})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* By Category Bar */}
          <div className="card">
            <div className="card-header"><div className="card-title">Category Comparison</div></div>
            {byCat.length === 0 ? (
              <div className="empty-state"><Tag size={28} /><p>No data yet</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byCat} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                  <YAxis type="category" dataKey="category" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip content={<CustomTooltip currency={currency} />} />
                  <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {byCat.map((entry, i) => (
                      <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Profit & Loss ────────────────────────────────────────────── */}
      {activeTab === 'pl' && pl && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Profit & Loss Statement</div>
                <div className="card-subtitle" style={{ textTransform: 'capitalize' }}>Period: {period}</div>
              </div>
              {(pl.net_profit || 0) >= 0
                ? <span className="badge badge-green" style={{ fontSize: 13 }}>Profitable</span>
                : <span className="badge badge-red" style={{ fontSize: 13 }}>Loss</span>}
            </div>

            <PLRow label="Revenue (Sales)"        value={pl.revenue}      />
            <PLRow label="Cost of Goods Sold"     value={-pl.cogs}   indent />
            <PLRow label="Gross Profit"           value={pl.gross_profit} highlight border />
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Operating Expenses
              </div>
              {byCat.map((c, i) => (
                <PLRow key={i} label={c.category || 'Uncategorised'} value={-c.total} indent />
              ))}
              <PLRow label="Total Expenses"       value={-pl.expenses}    border />
            </div>
            <PLRow label="Net Profit / (Loss)"    value={pl.net_profit}   highlight border />

            {/* Margin indicators */}
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Gross Margin', value: pl.gross_margin, color: pl.gross_margin >= 0 ? '#10b981' : '#ef4444' },
                { label: 'Net Margin',   value: pl.net_margin,   color: pl.net_margin   >= 0 ? '#10b981' : '#ef4444' }
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value.toFixed(1)}%</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue vs Expenses bar */}
          <div className="card">
            <div className="card-header"><div className="card-title">Revenue vs Expenses</div></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[
                { name: 'Revenue',       value: pl.revenue,      fill: '#3b82f6' },
                { name: 'Cost of Goods', value: pl.cogs,         fill: '#8b5cf6' },
                { name: 'Expenses',      value: pl.expenses,     fill: '#ef4444' },
                { name: 'Net Profit',    value: Math.abs(pl.net_profit), fill: pl.net_profit >= 0 ? '#10b981' : '#ef4444' }
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                <Tooltip formatter={v => fmt(v, currency)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {[{ fill:'#3b82f6' },{ fill:'#8b5cf6' },{ fill:'#ef4444' },{ fill: pl.net_profit >= 0 ? '#10b981' : '#ef4444' }].map((c, i) => (
                    <Cell key={i} fill={c.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Quick stats */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { l: 'Total Revenue',    v: pl.revenue,      c: '#3b82f6' },
                { l: 'Cost of Goods',    v: pl.cogs,         c: '#8b5cf6' },
                { l: 'Gross Profit',     v: pl.gross_profit, c: '#10b981' },
                { l: 'Total Expenses',   v: pl.expenses,     c: '#ef4444' },
                { l: 'Net Profit/(Loss)',v: pl.net_profit,   c: pl.net_profit >= 0 ? '#10b981' : '#ef4444' }
              ].map(row => (
                <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{row.l}</span>
                  <span style={{ fontWeight: 700, color: row.c }}>{fmt(row.v, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Expense Modal ──────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditExpense(null) }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editExpense ? 'Edit Expense' : 'Record Expense'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowForm(false); setEditExpense(null) }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Title / Description *</label>
                  <input className="input" placeholder="e.g. Monthly office rent"
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label">Amount ({currency}) *</label>
                  <input type="number" className="input" min={0} step={0.01} placeholder="0.00"
                    value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="input" value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="select" value={form.category_id}
                    onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">Uncategorised</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="select" value={form.payment_method}
                    onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor / Supplier</label>
                  <input className="input" placeholder="e.g. City Landlord Ltd"
                    value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Reference / Invoice #</label>
                  <input className="input" placeholder="Optional"
                    value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Receipt Note</label>
                  <input className="input" placeholder="e.g. Receipt #1234"
                    value={form.receipt_note} onChange={e => setForm(f => ({ ...f, receipt_note: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Details / Notes</label>
                <textarea className="textarea" style={{ minHeight: 60 }} placeholder="Additional details..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Recurring toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.is_recurring}
                    onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} />
                  Recurring expense
                </label>
                {form.is_recurring && (
                  <select className="select" style={{ width: 160 }} value={form.recurrence}
                    onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}>
                    <option value="">Select frequency</option>
                    {['Daily','Weekly','Monthly','Quarterly','Annually'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditExpense(null) }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editExpense ? <><Pencil size={14} /> Save Changes</> : <><Plus size={14} /> Record Expense</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Manager Modal ────────────────────────────────────────── */}
      {showCatMgr && (
        <div className="modal-overlay" onClick={() => setShowCatMgr(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Expense Categories</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCatMgr(false)}><X size={18} /></button>
            </div>

            {/* Add new */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input className="input" style={{ flex: 1 }} placeholder="Category name"
                value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
              <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                style={{ width: 40, height: 38, padding: 2, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
              <button className="btn btn-primary btn-sm" onClick={handleAddCategory}><Plus size={13} /></button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg-primary)', borderRadius: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: cat.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{cat.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.expense_count} expenses</span>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDeleteCat(cat.id)}
                    style={{ color: 'var(--accent-red)' }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
