import React, { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  TrendingUp, DollarSign, ShoppingCart, Users,
  Package, AlertTriangle, CreditCard, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { useAuth } from '../App'
import { fmt, fmtDate } from '../utils/format'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 13, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' && p.name !== 'Orders' ? `$${p.value.toLocaleString()}` : p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const bid = user?.business_id
  const currency = user?.currency || 'USD'

  const [summary, setSummary] = useState(null)
  const [salesChart, setSalesChart] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [topClients, setTopClients] = useState([])
  const [catBreakdown, setCatBreakdown] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [overdue, setOverdue] = useState([])
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [period])

  const loadAll = async () => {
    setLoading(true)
    const [sum, chart, prods, clients, cats, stock, od] = await Promise.all([
      window.api.orders.summary({ businessId: bid, period }),
      window.api.reports.salesOverTime({ businessId: bid, days: period === 'week' ? 7 : period === 'year' ? 365 : 30 }),
      window.api.reports.topProducts({ businessId: bid }),
      window.api.reports.topClients({ businessId: bid }),
      window.api.reports.categoryBreakdown({ businessId: bid }),
      window.api.inventory.lowStock({ businessId: bid }),
      window.api.credits.overdue({ businessId: bid })
    ])
    setSummary(sum)
    setSalesChart(chart || [])
    setTopProducts(prods || [])
    setTopClients(clients || [])
    setCatBreakdown(cats || [])
    setLowStock(stock || [])
    setOverdue(od || [])
    setLoading(false)
  }

  const KPICard = ({ icon: Icon, label, value, sub, color, gradient, change }) => (
    <div className="stat-card glow-blue" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="stat-card-icon" style={{ background: gradient || `${color}22` }}>
        <Icon size={20} color={color} />
      </div>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )

  const totalRevenue = summary?.total_revenue || 0
  const totalOrders = summary?.total_orders || 0
  const totalOutstanding = summary?.total_outstanding || 0
  const overdueTotal = overdue.reduce((s, r) => s + r.balance, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.full_name?.split(' ')[0]}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['today', 'week', 'month', 'year'].map(p => (
            <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p)} style={{ textTransform: 'capitalize' }}>{p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <KPICard icon={DollarSign} label="Total Revenue" value={fmt(totalRevenue, currency)} color="#3b82f6" gradient="var(--gradient-blue)" />
        <KPICard icon={ShoppingCart} label="Orders" value={totalOrders.toLocaleString()} sub={`Avg ${fmt(summary?.avg_order_value || 0, currency)}/order`} color="#10b981" />
        <KPICard icon={CreditCard} label="Outstanding" value={fmt(totalOutstanding, currency)} color="#f59e0b" />
        <KPICard icon={AlertTriangle} label="Overdue Credits" value={fmt(overdueTotal, currency)} sub={`${overdue.length} accounts`} color="#ef4444" />
      </div>

      {/* Revenue Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Revenue Over Time</div>
              <div className="card-subtitle">Sales & collections trend</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesChart}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2} fill="url(#colGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Pie */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Revenue by Category</div>
          </div>
          {catBreakdown.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <Package size={32} /><p>No data yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={catBreakdown} dataKey="revenue" nameKey="category" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                    {catBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {catBreakdown.slice(0, 4).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{c.category || 'Other'}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(c.revenue, currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Top Products</div>
          </div>
          {topProducts.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <Package size={28} /><p>No sales data</p>
            </div>
          ) : topProducts.slice(0, 5).map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${COLORS[i % COLORS.length]}22`,
                color: COLORS[i % COLORS.length],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0
              }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }} className="truncate">{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.total_qty} units sold</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(p.total_revenue, currency)}</div>
            </div>
          ))}
        </div>

        {/* Top Clients */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Top Clients</div>
          </div>
          {topClients.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <Users size={28} /><p>No client data</p>
            </div>
          ) : topClients.slice(0, 5).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="avatar" style={{
                width: 30, height: 30, fontSize: 11,
                background: COLORS[i % COLORS.length]
              }}>{c.name?.charAt(0) || '?'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }} className="truncate">{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.order_count} orders</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{fmt(c.total_value, currency)}</div>
            </div>
          ))}
        </div>

        {/* Low Stock & Overdue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1, borderColor: lowStock.length > 0 ? 'rgba(245,158,11,0.3)' : 'var(--border)' }}>
            <div className="card-header">
              <div className="card-title" style={{ color: lowStock.length > 0 ? 'var(--accent-yellow)' : undefined }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> Low Stock ({lowStock.length})
                </span>
              </div>
            </div>
            {lowStock.length === 0 ? (
              <div style={{ color: 'var(--accent-green)', fontSize: 13 }}>✓ All stock levels OK</div>
            ) : lowStock.slice(0, 4).map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
                <span className="truncate" style={{ flex: 1 }}>{s.name}</span>
                <span className="badge badge-yellow" style={{ marginLeft: 8 }}>{s.current_stock}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ flex: 1, borderColor: overdue.length > 0 ? 'rgba(239,68,68,0.3)' : 'var(--border)' }}>
            <div className="card-header">
              <div className="card-title" style={{ color: overdue.length > 0 ? 'var(--accent-red)' : undefined }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CreditCard size={14} /> Overdue ({overdue.length})
                </span>
              </div>
            </div>
            {overdue.length === 0 ? (
              <div style={{ color: 'var(--accent-green)', fontSize: 13 }}>✓ No overdue accounts</div>
            ) : overdue.slice(0, 4).map((o, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
                <div>
                  <div className="truncate" style={{ maxWidth: 110 }}>{o.client_name}</div>
                  <div style={{ color: 'var(--accent-red)', fontSize: 10 }}>{Math.round(o.days_overdue)}d overdue</div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--accent-red)' }}>{fmt(o.balance, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
