import React, { useState, useEffect, useCallback } from 'react'
import {
  Search, FileDown, DollarSign, Clock, AlertTriangle, X,
  Settings, Check, Plus, Pencil, Ban, History
} from 'lucide-react'
import { useAuth } from '../App'
import { fmt, fmtDate, fmtDateTime, daysUntil } from '../utils/format'
import { exportCreditsReport } from '../utils/export'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'all',      label: 'All Credits' },
  { key: 'overdue',  label: 'Overdue' },
  { key: 'aging',    label: 'Aging Report' },
  { key: 'payments', label: 'Payment History' },
]

export default function Credits() {
  const { user } = useAuth()
  const bid      = user?.business_id
  const currency = user?.currency || 'USD'

  const [tab, setTab]                     = useState('overview')
  const [credits, setCredits]             = useState([])
  const [overdue, setOverdue]             = useState([])
  const [aging, setAging]                 = useState(null)
  const [payments, setPayments]           = useState([])
  const [clientSummary, setClientSummary] = useState([])
  const [rules, setRules]                 = useState([])
  const [clients, setClients]             = useState([])
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('outstanding')
  const [loading, setLoading]             = useState(true)

  const [showPayment,  setShowPayment]  = useState(null)
  const [showHistory,  setShowHistory]  = useState(null)
  const [historyData,  setHistoryData]  = useState([])
  const [showEdit,     setShowEdit]     = useState(null)
  const [showNew,      setShowNew]      = useState(false)
  const [showWriteOff, setShowWriteOff] = useState(null)
  const [showRules,    setShowRules]    = useState(false)

  const [payment,      setPayment]      = useState({ amount: '', method: 'cash', reference: '', notes: '', payment_date: new Date().toISOString().slice(0,10) })
  const [editForm,     setEditForm]     = useState({ due_date: '', notes: '' })
  const [writeOffNote, setWriteOffNote] = useState('')
  const [newForm,      setNewForm]      = useState({ client_id: '', amount: '', due_date: '', credit_type: 'manual', notes: '' })

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [cr, od, ag, pmts, cs, r, cl] = await Promise.all([
      window.api.credits.list({ businessId: bid }),
      window.api.credits.overdue({ businessId: bid }),
      window.api.credits.aging({ businessId: bid }),
      window.api.credits.allPayments({ businessId: bid }),
      window.api.credits.clientSummary({ businessId: bid }),
      window.api.credits.rules.list({ businessId: bid }),
      window.api.clients.list({ businessId: bid })
    ])
    setCredits(cr || [])
    setOverdue(od || [])
    setAging(ag)
    setPayments(pmts || [])
    setClientSummary(cs || [])
    setRules(r || [])
    setClients(cl || [])
    setLoading(false)
  }, [bid])

  useEffect(() => { loadAll() }, [loadAll])

  const totalOutstanding = credits.filter(c => c.status === 'outstanding').reduce((s,c) => s + c.balance, 0)
  const totalOverdue     = overdue.reduce((s,o) => s + o.balance, 0)
  const totalSettled     = credits.filter(c => c.status === 'settled').reduce((s,c) => s + c.amount, 0)
  const totalCollected   = payments.reduce((s,p) => s + p.amount, 0)

  const filtered = credits.filter(c => {
    const q = search.toLowerCase()
    const mq = !q || c.client_name?.toLowerCase().includes(q) || c.order_number?.toLowerCase().includes(q) || c.client_code?.toLowerCase().includes(q)
    const ms = !statusFilter || c.computed_status === statusFilter || c.status === statusFilter
    return mq && ms
  })

  const handleRecordPayment = async () => {
    if (payment.amount === '' || payment.amount === null) return toast.error('Enter payment amount')
    const result = await window.api.credits.recordPayment({
      creditId: showPayment.id, amount: Number(payment.amount),
      method: payment.method, reference: payment.reference,
      notes: payment.notes, paymentDate: payment.payment_date, recordedBy: user.id
    })
    if (result.success) {
      toast.success(result.newStatus === 'settled' ? 'Account fully settled!' : `Payment recorded — Balance: ${fmt(result.newBalance, currency)}`)
      setShowPayment(null)
      setPayment({ amount: '', method: 'cash', reference: '', notes: '', payment_date: new Date().toISOString().slice(0,10) })
      loadAll()
    } else toast.error(result.error)
  }

  const handleViewHistory = async (credit) => {
    setShowHistory(credit)
    const h = await window.api.credits.paymentHistory({ creditId: credit.id })
    setHistoryData(h || [])
  }

  const handleEdit = async () => {
    const result = await window.api.credits.update({ id: showEdit.id, data: editForm })
    if (result.success) { toast.success('Credit updated'); setShowEdit(null); loadAll() }
    else toast.error(result.error)
  }

  const handleCreateManual = async () => {
    if (!newForm.client_id) return toast.error('Select a client')
    if (!newForm.amount || Number(newForm.amount) <= 0) return toast.error('Enter a valid amount')
    const result = await window.api.credits.create({ businessId: bid, data: newForm })
    if (result.success) {
      toast.success('Credit entry created')
      setShowNew(false)
      setNewForm({ client_id: '', amount: '', due_date: '', credit_type: 'manual', notes: '' })
      loadAll()
    } else toast.error(result.error)
  }

  const handleWriteOff = async () => {
    if (!window.confirm('Write off this credit? This cannot be undone.')) return
    const result = await window.api.credits.writeOff({ creditId: showWriteOff.id, notes: writeOffNote })
    if (result.success) { toast.success('Credit written off'); setShowWriteOff(null); setWriteOffNote(''); loadAll() }
    else toast.error(result.error)
  }

  const exportAging = () => {
    if (!aging?.rows?.length) return toast.error('No aging data')
    const wb = XLSX.utils.book_new()
    const data = [
      ['Client','Code','Current','1-30 Days','31-60 Days','61-90 Days','90+ Days','Total'],
      ...aging.rows.map(r => [r.client_name, r.client_code, r.current_amount, r.days_1_30, r.days_31_60, r.days_61_90, r.days_over_90, r.total_outstanding]),
      [],
      ['TOTALS','', aging.totals.current_amount, aging.totals.days_1_30, aging.totals.days_31_60, aging.totals.days_61_90, aging.totals.days_over_90, aging.totals.total_outstanding]
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Aging')
    XLSX.writeFile(wb, `Aging_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const DueBadge = ({ c }) => {
    if (c.status === 'settled')     return <span className="badge badge-green">Settled</span>
    if (c.status === 'written_off') return <span className="badge badge-gray">Written Off</span>
    if (!c.due_date)                return <span className="badge badge-gray">No due date</span>
    const days = daysUntil(c.due_date)
    if (days < 0)  return <span className="badge badge-red">Overdue {Math.abs(days)}d</span>
    if (days === 0) return <span className="badge badge-yellow">Due today</span>
    if (days <= 7)  return <span className="badge badge-yellow">Due in {days}d</span>
    return <span className="badge badge-blue">Due in {days}d</span>
  }

  const CreditActions = ({ c }) => (
    <div style={{ display: 'flex', gap: 4 }}>
      {c.status === 'outstanding' && (
        <button className="btn btn-success btn-sm"
          onClick={() => { setShowPayment(c); setPayment({ amount: c.balance.toFixed(2), method: 'cash', reference: '', notes: '', payment_date: new Date().toISOString().slice(0,10) }) }}>
          <DollarSign size={12} /> Pay
        </button>
      )}
      <button className="btn btn-ghost btn-icon btn-sm" title="Payment history" onClick={() => handleViewHistory(c)} style={{ color: 'var(--accent-blue)' }}>
        <History size={13} />
      </button>
      {c.status === 'outstanding' && <>
        <button className="btn btn-ghost btn-icon btn-sm" title="Edit due date"
          onClick={() => { setShowEdit(c); setEditForm({ due_date: c.due_date?.slice(0,10) || '', notes: c.notes || '' }) }}
          style={{ color: 'var(--accent-yellow)' }}><Pencil size={13} /></button>
        <button className="btn btn-ghost btn-icon btn-sm" title="Write off"
          onClick={() => setShowWriteOff(c)} style={{ color: 'var(--text-muted)' }}><Ban size={13} /></button>
      </>}
    </div>
  )

  const updateRule = (i, f, v) => setRules(r => r.map((rule, idx) => idx === i ? { ...rule, [f]: v } : rule))
  const addRule    = () => setRules(r => [...r, { id: null, name: '', days_overdue: 0, action_type: 'reminder', message_template: 'Your payment of {amount} is due.', is_active: true }])
  const saveRules  = async () => {
    const result = await window.api.credits.rules.save({ businessId: bid, rules })
    if (result.success) { toast.success('Rules saved'); setShowRules(false) } else toast.error(result.error)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300 }}><div className="spinner" style={{ width:32, height:32 }} /></div>

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Credit Management</h1>
          <p className="page-subtitle">{credits.filter(c => c.status==='outstanding').length} outstanding · {fmt(totalOutstanding, currency)}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={() => setShowRules(true)}><Settings size={14} /> Collection Rules</button>
          <button className="btn btn-secondary" onClick={() => exportCreditsReport(credits, currency)}><FileDown size={14} /> Export</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> Manual Credit</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ marginBottom:20 }}>
        {[
          { label:'Total Outstanding', value:fmt(totalOutstanding,currency), icon:Clock,         color:'#f59e0b', bg:'rgba(245,158,11,0.12)' },
          { label:'Overdue',           value:fmt(totalOverdue,currency),     icon:AlertTriangle,  color:'#ef4444', bg:'rgba(239,68,68,0.12)', sub:`${overdue.length} account${overdue.length!==1?'s':''}` },
          { label:'Total Collected',   value:fmt(totalCollected,currency),   icon:DollarSign,     color:'#10b981', bg:'rgba(16,185,129,0.12)',sub:`${payments.length} payments` },
          { label:'Total Settled',     value:fmt(totalSettled,currency),     icon:Check,          color:'#3b82f6', bg:'rgba(59,130,246,0.12)',sub:`${credits.filter(c=>c.status==='settled').length} accounts` },
        ].map((k,i) => (
          <div key={i} className="stat-card" style={{ borderLeft:`3px solid ${k.color}` }}>
            <div className="stat-card-icon" style={{ background:k.bg }}><k.icon size={20} color={k.color} /></div>
            <div className="stat-card-value">{k.value}</div>
            <div className="stat-card-label">{k.label}</div>
            {k.sub && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <AlertTriangle size={15} color="var(--accent-red)" />
          <span style={{ fontSize:13, color:'var(--accent-red)', fontWeight:600, flex:1 }}>
            {overdue.length} account{overdue.length>1?'s are':' is'} overdue — {fmt(totalOverdue,currency)} total
          </span>
          <button className="btn btn-sm" onClick={async () => { await window.api.notifications.generateCreditAlerts({ businessId:bid }); toast.success('Alerts generated') }}
            style={{ background:'rgba(239,68,68,0.15)', color:'var(--accent-red)', border:'1px solid rgba(239,68,68,0.3)' }}>
            Generate Alerts
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => setTab('overdue')}>View Overdue →</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'var(--bg-secondary)', borderRadius:10, padding:4, width:'fit-content', marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`btn btn-sm ${tab===t.key?'btn-primary':'btn-ghost'}`}>
            {t.label}
            {t.key==='overdue' && overdue.length>0 && (
              <span style={{ background:'var(--accent-red)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:100, marginLeft:4 }}>{overdue.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab==='overview' && (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Client</th><th>Contact</th><th>Credit Limit</th><th>Outstanding</th><th>Overdue</th><th>Settled</th><th>Open</th><th>Latest Due</th></tr></thead>
            <tbody>
              {clientSummary.length===0
                ? <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No credit history yet</td></tr>
                : clientSummary.map(c => (
                  <tr key={c.id} style={{ borderLeft: c.overdue_credits>0 ? '3px solid var(--accent-red)' : undefined }}>
                    <td><div style={{ fontWeight:600 }}>{c.name}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.code}</div></td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}><div>{c.phone||'—'}</div><div>{c.email||''}</div></td>
                    <td>{c.credit_limit>0 ? fmt(c.credit_limit,currency) : <span style={{ color:'var(--text-muted)' }}>None</span>}</td>
                    <td>
                      <div style={{ fontWeight:700, color:c.outstanding>0?'var(--accent-yellow)':'var(--text-muted)' }}>{fmt(c.outstanding,currency)}</div>
                      {c.credit_limit>0 && c.outstanding>0 && (
                        <div className="progress-bar" style={{ width:80, marginTop:4 }}>
                          <div className="progress-fill" style={{ width:`${Math.min(100,c.outstanding/c.credit_limit*100)}%`, background: c.outstanding>=c.credit_limit?'var(--accent-red)':'var(--accent-yellow)' }} />
                        </div>
                      )}
                    </td>
                    <td style={{ color:c.overdue_credits>0?'var(--accent-red)':'var(--text-muted)', fontWeight:c.overdue_credits>0?600:400 }}>
                      {c.overdue_credits>0 ? `${c.overdue_credits} overdue` : '—'}
                    </td>
                    <td style={{ color:'var(--accent-green)' }}>{fmt(c.total_settled,currency)}</td>
                    <td>{c.open_credits}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{fmtDate(c.latest_due)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ALL CREDITS ── */}
      {tab==='all' && (
        <>
          <div className="filter-bar">
            <div className="search-wrapper">
              <Search size={14} className="search-icon" />
              <input className="search-input" placeholder="Search client, order..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {[{v:'',l:'All'},{v:'outstanding',l:'Outstanding'},{v:'overdue',l:'Overdue'},{v:'settled',l:'Settled'},{v:'written_off',l:'Written Off'}].map(s => (
                <button key={s.v} className={`btn btn-sm ${statusFilter===s.v?'btn-primary':'btn-secondary'}`} onClick={() => setStatusFilter(s.v)}>{s.l}</button>
              ))}
            </div>
          </div>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Client</th><th>Order #</th><th>Type</th><th>Original</th><th>Balance</th><th>Due Date</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length===0
                  ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No credits found</td></tr>
                  : filtered.map(c => (
                    <tr key={c.id} style={{ borderLeft: c.computed_status==='overdue'?'3px solid var(--accent-red)':c.status==='settled'?'3px solid var(--accent-green)':undefined }}>
                      <td><div style={{ fontWeight:600 }}>{c.client_name}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.client_code}</div></td>
                      <td style={{ fontFamily:'monospace', fontSize:12, color:'var(--accent-blue)' }}>{c.order_number||<span style={{ color:'var(--text-muted)' }}>Manual</span>}</td>
                      <td><span className="badge badge-gray" style={{ fontSize:11 }}>{c.credit_type||'sale'}</span></td>
                      <td style={{ fontWeight:600 }}>{fmt(c.amount,currency)}</td>
                      <td>
                        <div style={{ fontWeight:700, color:c.balance>0?'var(--accent-yellow)':'var(--accent-green)' }}>{fmt(c.balance,currency)}</div>
                        {c.payment_count>0 && <div style={{ fontSize:10, color:'var(--text-muted)' }}>{c.payment_count} payment{c.payment_count>1?'s':''}</div>}
                      </td>
                      <td><div style={{ fontSize:12 }}>{fmtDate(c.due_date)}</div><div style={{ marginTop:2 }}><DueBadge c={c} /></div></td>
                      <td><CreditActions c={c} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── OVERDUE ── */}
      {tab==='overdue' && (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Client</th><th>Contact</th><th>Order #</th><th>Balance Due</th><th>Due Date</th><th>Days Overdue</th><th>Actions</th></tr></thead>
            <tbody>
              {overdue.length===0
                ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40 }}><Check size={32} color="var(--accent-green)" style={{ margin:'0 auto 8px' }} /><div style={{ color:'var(--accent-green)', fontWeight:600 }}>No overdue accounts</div></td></tr>
                : overdue.map(c => (
                  <tr key={c.id} style={{ borderLeft:'3px solid var(--accent-red)' }}>
                    <td><div style={{ fontWeight:600 }}>{c.client_name}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.client_code}</div></td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}><div>{c.phone||'—'}</div><div style={{ fontSize:11 }}>{c.email||''}</div></td>
                    <td style={{ fontFamily:'monospace', fontSize:12, color:'var(--accent-blue)' }}>{c.order_number||'Manual'}</td>
                    <td style={{ fontWeight:700, color:'var(--accent-red)', fontSize:15 }}>{fmt(c.balance,currency)}</td>
                    <td style={{ color:'var(--text-secondary)' }}>{fmtDate(c.due_date)}</td>
                    <td>
                      <span style={{ fontWeight:700, fontSize:13, color:c.days_overdue>90?'#dc2626':c.days_overdue>60?'var(--accent-red)':c.days_overdue>30?'var(--accent-orange)':'var(--accent-yellow)', background:c.days_overdue>90?'rgba(239,68,68,0.2)':'rgba(239,68,68,0.1)', padding:'3px 10px', borderRadius:100 }}>
                        {c.days_overdue}d
                      </span>
                    </td>
                    <td><CreditActions c={c} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AGING REPORT ── */}
      {tab==='aging' && aging && (
        <>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="btn btn-secondary" onClick={exportAging}><FileDown size={14} /> Export Aging</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:16 }}>
            {[
              { label:'Current',   value:aging.totals.current_amount, color:'#10b981' },
              { label:'1–30 Days', value:aging.totals.days_1_30,      color:'#f59e0b' },
              { label:'31–60 Days',value:aging.totals.days_31_60,     color:'#f97316' },
              { label:'61–90 Days',value:aging.totals.days_61_90,     color:'#ef4444' },
              { label:'90+ Days',  value:aging.totals.days_over_90,   color:'#7f1d1d' },
            ].map(b => (
              <div key={b.label} style={{ background:'var(--bg-card)', border:`1px solid ${b.color}44`, borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{b.label}</div>
                <div style={{ fontSize:17, fontWeight:800, color:b.color }}>{fmt(b.value,currency)}</div>
              </div>
            ))}
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th style={{ color:'#10b981' }}>Current</th>
                  <th style={{ color:'#f59e0b' }}>1–30 Days</th>
                  <th style={{ color:'#f97316' }}>31–60 Days</th>
                  <th style={{ color:'#ef4444' }}>61–90 Days</th>
                  <th style={{ color:'#7f1d1d' }}>90+ Days</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {aging.rows.length===0
                  ? <tr><td colSpan={7} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No outstanding credits</td></tr>
                  : aging.rows.map(r => (
                    <tr key={r.client_id} style={{ borderLeft:r.days_over_90>0?'3px solid #7f1d1d':r.days_61_90>0?'3px solid var(--accent-red)':undefined }}>
                      <td><div style={{ fontWeight:600 }}>{r.client_name}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{r.client_code}</div></td>
                      <td style={{ color:'#10b981' }}>{r.current_amount>0?fmt(r.current_amount,currency):'—'}</td>
                      <td style={{ color:'#f59e0b', fontWeight:r.days_1_30>0?600:400 }}>{r.days_1_30>0?fmt(r.days_1_30,currency):'—'}</td>
                      <td style={{ color:'#f97316', fontWeight:r.days_31_60>0?600:400 }}>{r.days_31_60>0?fmt(r.days_31_60,currency):'—'}</td>
                      <td style={{ color:'#ef4444', fontWeight:r.days_61_90>0?600:400 }}>{r.days_61_90>0?fmt(r.days_61_90,currency):'—'}</td>
                      <td style={{ color:'#dc2626', fontWeight:r.days_over_90>0?700:400 }}>{r.days_over_90>0?fmt(r.days_over_90,currency):'—'}</td>
                      <td style={{ fontWeight:700 }}>{fmt(r.total_outstanding,currency)}</td>
                    </tr>
                  ))}
                <tr style={{ background:'var(--bg-secondary)', fontWeight:700 }}>
                  <td>TOTALS</td>
                  <td style={{ color:'#10b981' }}>{fmt(aging.totals.current_amount,currency)}</td>
                  <td style={{ color:'#f59e0b' }}>{fmt(aging.totals.days_1_30,currency)}</td>
                  <td style={{ color:'#f97316' }}>{fmt(aging.totals.days_31_60,currency)}</td>
                  <td style={{ color:'#ef4444' }}>{fmt(aging.totals.days_61_90,currency)}</td>
                  <td style={{ color:'#dc2626' }}>{fmt(aging.totals.days_over_90,currency)}</td>
                  <td style={{ fontSize:15 }}>{fmt(aging.totals.total_outstanding,currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PAYMENT HISTORY ── */}
      {tab==='payments' && (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Date</th><th>Client</th><th>Order #</th><th>Amount</th><th>Method</th><th>Reference</th><th>Recorded By</th><th>Notes</th></tr></thead>
            <tbody>
              {payments.length===0
                ? <tr><td colSpan={8} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>No payments recorded yet</td></tr>
                : payments.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{fmtDateTime(p.paid_at)}</td>
                    <td style={{ fontWeight:600 }}>{p.client_name}</td>
                    <td style={{ fontFamily:'monospace', fontSize:12, color:'var(--accent-blue)' }}>{p.order_number||'Manual'}</td>
                    <td style={{ fontWeight:700, color:'var(--accent-green)', fontSize:14 }}>{fmt(p.amount,currency)}</td>
                    <td style={{ fontSize:12 }}>{p.payment_method?.replace('_',' ')}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{p.reference||'—'}</td>
                    <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{p.recorded_by_name||'—'}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)', maxWidth:160 }} className="truncate">{p.notes||'—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: Record Payment ── */}
      {showPayment && (
        <div className="modal-overlay" onClick={() => setShowPayment(null)}>
          <div className="modal" style={{ maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Record Payment</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowPayment(null)}><X size={18} /></button>
            </div>
            <div style={{ background:'var(--bg-primary)', borderRadius:10, padding:14, marginBottom:18 }}>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>{showPayment.client_name}</div>
              {[['Original',fmt(showPayment.amount,currency)],['Balance due',fmt(showPayment.balance,currency),'var(--accent-yellow)'],['Due date',fmtDate(showPayment.due_date)],['Order',showPayment.order_number||'Manual']].map(([l,v,c]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                  <span style={{ color:'var(--text-muted)' }}>{l}</span>
                  <span style={{ fontWeight:600, color:c||'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div className="form-group">
                <label className="form-label">Amount Paid ({currency})</label>
                <input type="number" className="input" min={0} step={0.01} value={payment.amount}
                  onChange={e => setPayment(p => ({ ...p, amount:e.target.value }))} />
                {payment.amount!=='' && Number(payment.amount)>=showPayment.balance && (
                  <div style={{ fontSize:11, color:'var(--accent-green)', marginTop:3 }}>✓ Will settle this account fully</div>
                )}
                {payment.amount!=='' && Number(payment.amount)>0 && Number(payment.amount)<showPayment.balance && (
                  <div style={{ fontSize:11, color:'var(--accent-yellow)', marginTop:3 }}>Remaining: {fmt(showPayment.balance-Number(payment.amount),currency)}</div>
                )}
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Payment Date</label>
                  <input type="date" className="input" value={payment.payment_date}
                    onChange={e => setPayment(p => ({ ...p, payment_date:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Method</label>
                  <select className="select" value={payment.method} onChange={e => setPayment(p => ({ ...p, method:e.target.value }))}>
                    {['cash','card','bank_transfer','mobile_money','cheque','other'].map(m => (
                      <option key={m} value={m}>{m.replace('_',' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reference / Cheque #</label>
                <input className="input" placeholder="Optional" value={payment.reference}
                  onChange={e => setPayment(p => ({ ...p, reference:e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="textarea" style={{ minHeight:55 }} value={payment.notes}
                  onChange={e => setPayment(p => ({ ...p, notes:e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPayment(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleRecordPayment}><Check size={15} /> Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Payment History per credit ── */}
      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Payments — {showHistory.client_name}</h3>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Original: {fmt(showHistory.amount,currency)} · Balance: {fmt(showHistory.balance,currency)}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowHistory(null)}><X size={18} /></button>
            </div>
            {historyData.length===0
              ? <div className="empty-state" style={{ padding:'30px 0' }}><DollarSign size={28} /><h3>No payments yet</h3></div>
              : <div className="table-container">
                  <table className="table">
                    <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Recorded By</th><th>Notes</th></tr></thead>
                    <tbody>
                      {historyData.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{fmtDateTime(p.paid_at)}</td>
                          <td style={{ fontWeight:700, color:'var(--accent-green)' }}>{fmt(p.amount,currency)}</td>
                          <td style={{ fontSize:12 }}>{p.payment_method?.replace('_',' ')}</td>
                          <td style={{ fontSize:12, color:'var(--text-muted)' }}>{p.reference||'—'}</td>
                          <td style={{ fontSize:12, color:'var(--text-secondary)' }}>{p.recorded_by_name||'—'}</td>
                          <td style={{ fontSize:12, color:'var(--text-muted)' }}>{p.notes||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
            <div style={{ background:'var(--bg-primary)', borderRadius:10, padding:14, marginTop:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                <span style={{ color:'var(--text-muted)' }}>Total paid</span>
                <span style={{ fontWeight:700, color:'var(--accent-green)' }}>{fmt(historyData.reduce((s,p)=>s+p.amount,0),currency)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                <span style={{ color:'var(--text-muted)' }}>Remaining balance</span>
                <span style={{ fontWeight:700, color:showHistory.balance>0?'var(--accent-yellow)':'var(--accent-green)' }}>{fmt(showHistory.balance,currency)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Edit Credit ── */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(null)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Credit</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowEdit(null)}><X size={18} /></button>
            </div>
            <div style={{ marginBottom:14, padding:12, background:'var(--bg-primary)', borderRadius:8, fontSize:13 }}>
              <div style={{ fontWeight:600 }}>{showEdit.client_name}</div>
              <div style={{ color:'var(--text-muted)' }}>Balance: {fmt(showEdit.balance,currency)}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input type="date" className="input" value={editForm.due_date}
                  onChange={e => setEditForm(f => ({ ...f, due_date:e.target.value }))} />
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>Extend if additional time is granted</div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="textarea" value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes:e.target.value }))}
                  placeholder="Payment arrangement, contact notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEdit(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEdit}><Pencil size={14} /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Write Off ── */}
      {showWriteOff && (
        <div className="modal-overlay" onClick={() => setShowWriteOff(null)}>
          <div className="modal" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color:'var(--accent-red)' }}>Write Off Credit</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowWriteOff(null)}><X size={18} /></button>
            </div>
            <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:14, marginBottom:16 }}>
              <div style={{ fontSize:13, color:'var(--accent-red)', fontWeight:600, marginBottom:6 }}>⚠ This action cannot be undone</div>
              <div style={{ fontSize:13, color:'var(--text-secondary)' }}>
                Writing off <strong>{fmt(showWriteOff.balance,currency)}</strong> owed by <strong>{showWriteOff.client_name}</strong> as a bad debt.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Reason for Write-Off</label>
              <textarea className="textarea" placeholder="e.g. Client declared bankruptcy, uncontactable..."
                value={writeOffNote} onChange={e => setWriteOffNote(e.target.value)} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowWriteOff(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleWriteOff}><Ban size={14} /> Write Off {fmt(showWriteOff.balance,currency)}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Manual Credit ── */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" style={{ maxWidth:460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Manual Credit Entry</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:18 }}>Record a credit not linked to a sales order — e.g. advance, deferred payment, or adjustment.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select className="select" value={newForm.client_id} onChange={e => setNewForm(f => ({ ...f, client_id:e.target.value }))}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.code?`(${c.code})`:''}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Amount ({currency}) *</label>
                  <input type="number" className="input" min={0.01} step={0.01} placeholder="0.00"
                    value={newForm.amount} onChange={e => setNewForm(f => ({ ...f, amount:e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input type="date" className="input" value={newForm.due_date}
                    onChange={e => setNewForm(f => ({ ...f, due_date:e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Credit Type</label>
                <select className="select" value={newForm.credit_type} onChange={e => setNewForm(f => ({ ...f, credit_type:e.target.value }))}>
                  {['manual','advance','adjustment','loan','deferred_payment','other'].map(t => (
                    <option key={t} value={t}>{t.replace('_',' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="textarea" placeholder="Reason for credit entry..."
                  value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes:e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateManual}><Plus size={14} /> Create Credit Entry</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Collection Rules ── */}
      {showRules && (
        <div className="modal-overlay" onClick={() => setShowRules(false)}>
          <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Debt Collection Rules</h3>
                <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Automatic in-app alerts based on due date. Negative days = advance reminder.</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowRules(false)}><X size={18} /></button>
            </div>
            <div style={{ marginBottom:16 }}>
              {rules.map((rule, idx) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'1.2fr 90px 120px 2fr 70px auto', gap:10, alignItems:'start', marginBottom:10, background:'var(--bg-primary)', padding:12, borderRadius:10 }}>
                  <div className="form-group">
                    <label className="form-label">Rule Name</label>
                    <input className="input" value={rule.name} placeholder="e.g. 7-day reminder" onChange={e => updateRule(idx,'name',e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Days</label>
                    <input type="number" className="input" value={rule.days_overdue} onChange={e => updateRule(idx,'days_overdue',Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Action</label>
                    <select className="select" value={rule.action_type} onChange={e => updateRule(idx,'action_type',e.target.value)}>
                      {['reminder','due','demand','escalate','final_notice'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message ({'{amount}'}, {'{client}'}, {'{days}'})</label>
                    <textarea className="textarea" style={{ minHeight:50, fontSize:12 }} value={rule.message_template}
                      onChange={e => updateRule(idx,'message_template',e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginTop:18 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12 }}>
                      <input type="checkbox" checked={!!rule.is_active} onChange={e => updateRule(idx,'is_active',e.target.checked)} />
                      Active
                    </label>
                  </div>
                  <div style={{ marginTop:18 }}>
                    <button className="btn btn-ghost btn-sm" style={{ color:'var(--accent-red)' }} onClick={() => setRules(r => r.filter((_,i)=>i!==idx))}>Remove</button>
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
