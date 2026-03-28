export function fmt(amount, currency = 'USD') {
  if (amount === null || amount === undefined || isNaN(amount)) return '-'
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`
  }
}

export function fmtDate(dateStr, opts = {}) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...opts })
  } catch { return dateStr }
}

export function fmtDateTime(dateStr) {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return dateStr }
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

export function statusBadge(status) {
  const map = {
    completed: 'badge-green', pending: 'badge-yellow',
    cancelled: 'badge-gray', outstanding: 'badge-yellow',
    settled: 'badge-green', overdue: 'badge-red',
    active: 'badge-green', inactive: 'badge-gray',
    purchase: 'badge-blue', sale: 'badge-purple',
    adjustment: 'badge-orange', opening: 'badge-cyan'
  }
  return map[status] || 'badge-gray'
}
