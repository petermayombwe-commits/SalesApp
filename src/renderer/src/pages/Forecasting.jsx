import React, { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, Package, FileDown } from 'lucide-react'
import { useAuth } from '../App'
import { fmt, fmtDate } from '../utils/format'
import * as XLSX from 'xlsx'

const CustomTooltip = ({ active, payload, label, currency }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 14px' }}>
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || '#f8fafc', fontSize: 13, fontWeight: 600 }}>
          {p.name}: {p.name === 'Units' ? p.value : fmt(p.value, currency)}
        </p>
      ))}
    </div>
  )
}

export default function Forecasting() {
  const { user } = useAuth()
  const bid = user?.business_id
  const currency = user?.currency || 'USD'

  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [demandForecast, setDemandForecast] = useState(null)
  const [revenueForecast, setRevenueForecast] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadProducts()
    loadRevenueForecast()
  }, [])

  const loadProducts = async () => {
    const p = await window.api.products.list({ businessId: bid })
    setProducts(p || [])
  }

  const loadRevenueForecast = async () => {
    const rf = await window.api.forecast.revenue({ businessId: bid })
    setRevenueForecast(rf)
  }

  const loadDemandForecast = async (productId) => {
    if (!productId) return
    setLoading(true)
    const df = await window.api.forecast.demand({ businessId: bid, productId, days: 30 })
    setDemandForecast(df)
    setLoading(false)
  }

  const combinedRevenue = revenueForecast ? [
    ...(revenueForecast.history || []).map(h => ({ ...h, type: 'actual', revenue: h.revenue })),
    ...(revenueForecast.forecast || []).map(f => ({ month: f.month, type: 'forecast', forecast: f.predicted }))
  ] : []

  const exportForecast = () => {
    if (!demandForecast?.forecast) return
    const wb = XLSX.utils.book_new()
    const data = [['Date', 'Predicted Demand', 'Confidence %'],
      ...demandForecast.forecast.map(f => [f.date, f.predicted, (f.confidence * 100).toFixed(0) + '%'])
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Demand Forecast')
    XLSX.writeFile(wb, `Demand_Forecast_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Forecasting & Predictions</h1>
          <p className="page-subtitle">AI-driven demand and revenue forecasting based on historical sales</p>
        </div>
      </div>

      {/* Revenue Forecast */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="var(--accent-blue)" /> Revenue Forecast (Next 3 Months)
            </div>
            <div className="card-subtitle">Historical actuals + projected revenue</div>
          </div>
        </div>
        {!revenueForecast?.history?.length ? (
          <div className="empty-state"><TrendingUp size={36} /><h3>Insufficient Data</h3><p>Record at least 2 months of sales to generate forecasts</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={combinedRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Bar dataKey="revenue" name="Actual Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="forecast" name="Projected Revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} opacity={0.7}
                style={{ strokeDasharray: '4 2' }} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {revenueForecast?.forecast?.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            {revenueForecast.forecast.map(f => (
              <div key={f.month} style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '10px 16px', flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{f.month} (forecast)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa' }}>{fmt(f.predicted, currency)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Demand Forecast */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={16} color="var(--accent-green)" /> Product Demand Forecast (30 Days)
            </div>
            <div className="card-subtitle">Select a product to view demand prediction</div>
          </div>
          {demandForecast?.success && (
            <button className="btn btn-secondary btn-sm" onClick={exportForecast}>
              <FileDown size={13} /> Export
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <select className="select" style={{ width: 280 }} value={selectedProduct}
            onChange={e => { setSelectedProduct(e.target.value); loadDemandForecast(e.target.value) }}>
            <option value="">Select a product...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {loading && <div className="spinner" />}
        </div>

        {demandForecast?.success ? (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '10px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Avg Daily Demand</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>{demandForecast.avgDaily?.toFixed(1)} units/day</div>
              </div>
              <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '10px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>30-Day Projection</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {demandForecast.forecast.reduce((s, f) => s + f.predicted, 0)} units
                </div>
              </div>
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Data Confidence</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-yellow)' }}>75%</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={demandForecast.forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} interval={4} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>Predicted: {payload[0]?.value} units</div>
                  </div>
                ) : null} />
                <Line type="monotone" dataKey="predicted" name="Units" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : demandForecast?.error ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {demandForecast.error} — record at least 7 days of sales for this product
          </div>
        ) : !selectedProduct ? (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <Package size={32} /><h3>Select a Product</h3><p>Choose a product above to view its demand forecast</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
