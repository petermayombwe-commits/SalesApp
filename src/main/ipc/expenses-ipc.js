import { getDb } from '../database'
import { v4 as uuidv4 } from 'uuid'

export function registerExpenseHandlers(ipcMain) {

  // ── Categories ─────────────────────────────────────────────────────────────
  ipcMain.handle('expenses:categories-list', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT ec.*, COUNT(e.id) as expense_count,
             COALESCE(SUM(e.amount), 0) as total_spent
      FROM expense_categories ec
      LEFT JOIN expenses e ON ec.id = e.category_id
      WHERE ec.business_id = ? AND ec.is_active = 1
      GROUP BY ec.id ORDER BY ec.name
    `).all(businessId)
  })

  ipcMain.handle('expenses:categories-save', async (_, { businessId, categories }) => {
    const db = getDb()
    try {
      const stmt = db.prepare(`
        INSERT INTO expense_categories (id, business_id, name, color)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color
      `)
      for (const cat of categories) {
        stmt.run(cat.id || uuidv4(), businessId, cat.name, cat.color || '#6366f1')
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('expenses:categories-delete', async (_, { id }) => {
    const db = getDb()
    try {
      db.prepare('UPDATE expense_categories SET is_active = 0 WHERE id = ?').run(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Expenses CRUD ──────────────────────────────────────────────────────────
  ipcMain.handle('expenses:list', async (_, { businessId, categoryId, from, to, limit = 200 }) => {
    const db = getDb()
    let sql = `
      SELECT e.*, ec.name as category_name, ec.color as category_color
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.business_id = ?
    `
    const params = [businessId]
    if (categoryId) { sql += ' AND e.category_id = ?'; params.push(categoryId) }
    if (from)       { sql += ' AND date(e.expense_date) >= ?'; params.push(from) }
    if (to)         { sql += ' AND date(e.expense_date) <= ?'; params.push(to) }
    sql += ' ORDER BY e.expense_date DESC LIMIT ?'
    params.push(limit)
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('expenses:create', async (_, { businessId, data }) => {
    const db = getDb()
    try {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO expenses
          (id, business_id, category_id, title, description, amount, currency,
           expense_date, payment_method, vendor, reference, receipt_note,
           is_recurring, recurrence, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, businessId,
        data.category_id || null,
        data.title, data.description || null,
        Number(data.amount), data.currency || 'USD',
        data.expense_date || new Date().toISOString().slice(0, 10),
        data.payment_method || 'cash',
        data.vendor || null, data.reference || null, data.receipt_note || null,
        data.is_recurring ? 1 : 0,
        data.recurrence || null,
        data.recorded_by || null
      )
      return { success: true, id }
    } catch (err) {
      console.error('[expenses:create]', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('expenses:update', async (_, { id, data }) => {
    const db = getDb()
    try {
      db.prepare(`
        UPDATE expenses SET
          category_id = ?, title = ?, description = ?, amount = ?,
          expense_date = ?, payment_method = ?, vendor = ?,
          reference = ?, receipt_note = ?, is_recurring = ?, recurrence = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        data.category_id || null, data.title, data.description || null,
        Number(data.amount), data.expense_date,
        data.payment_method, data.vendor || null,
        data.reference || null, data.receipt_note || null,
        data.is_recurring ? 1 : 0, data.recurrence || null,
        id
      )
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('expenses:delete', async (_, { id }) => {
    const db = getDb()
    try {
      db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Summary / Analytics ───────────────────────────────────────────────────
  ipcMain.handle('expenses:summary', async (_, { businessId, period = 'month' }) => {
    const db = getDb()
    let dateFilter
    if (period === 'today') dateFilter = "date(expense_date) = date('now')"
    else if (period === 'week')  dateFilter = "expense_date >= date('now', '-7 days')"
    else if (period === 'month') dateFilter = "expense_date >= date('now', '-30 days')"
    else if (period === 'year')  dateFilter = "expense_date >= date('now', '-365 days')"
    else dateFilter = '1=1'

    return db.prepare(`
      SELECT
        COUNT(*)                    as total_count,
        COALESCE(SUM(amount), 0)   as total_amount,
        COALESCE(AVG(amount), 0)   as avg_amount,
        COALESCE(MAX(amount), 0)   as max_amount
      FROM expenses
      WHERE business_id = ? AND ${dateFilter}
    `).get(businessId)
  })

  ipcMain.handle('expenses:by-category', async (_, { businessId, period = 'month' }) => {
    const db = getDb()
    let dateFilter
    if (period === 'month') dateFilter = "e.expense_date >= date('now', '-30 days')"
    else if (period === 'year') dateFilter = "e.expense_date >= date('now', '-365 days')"
    else dateFilter = '1=1'

    return db.prepare(`
      SELECT ec.name as category, ec.color,
             COUNT(e.id) as count,
             COALESCE(SUM(e.amount), 0) as total
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      WHERE e.business_id = ? AND ${dateFilter}
      GROUP BY e.category_id
      ORDER BY total DESC
    `).all(businessId)
  })

  ipcMain.handle('expenses:over-time', async (_, { businessId, days = 30 }) => {
    const db = getDb()
    return db.prepare(`
      SELECT date(expense_date) as date,
             COUNT(*)           as count,
             SUM(amount)        as total
      FROM expenses
      WHERE business_id = ?
        AND expense_date >= date('now', ? || ' days')
      GROUP BY date(expense_date)
      ORDER BY date
    `).all(businessId, `-${days}`)
  })

  ipcMain.handle('expenses:profit-loss', async (_, { businessId, period = 'month' }) => {
    const db = getDb()
    let dateFilter
    if (period === 'month') dateFilter = "-30 days"
    else if (period === 'year') dateFilter = "-365 days"
    else if (period === 'week') dateFilter = "-7 days"
    else dateFilter = "-30 days"

    const revenue = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue,
             COALESCE(SUM(paid_amount), 0)  as collected
      FROM orders
      WHERE business_id = ? AND status != 'cancelled'
        AND order_date >= date('now', ?)
    `).get(businessId, dateFilter)

    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE business_id = ?
        AND expense_date >= date('now', ?)
    `).get(businessId, dateFilter)

    const cogs = db.prepare(`
      SELECT COALESCE(SUM(oi.quantity * p.cost_price), 0) as cogs
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.business_id = ? AND o.status != 'cancelled'
        AND o.order_date >= date('now', ?)
    `).get(businessId, dateFilter)

    const grossProfit    = revenue.revenue - cogs.cogs
    const netProfit      = grossProfit - expenses.total
    const grossMarginPct = revenue.revenue > 0 ? (grossProfit / revenue.revenue * 100) : 0
    const netMarginPct   = revenue.revenue > 0 ? (netProfit   / revenue.revenue * 100) : 0

    return {
      revenue:        revenue.revenue,
      collected:      revenue.collected,
      cogs:           cogs.cogs,
      gross_profit:   grossProfit,
      expenses:       expenses.total,
      net_profit:     netProfit,
      gross_margin:   grossMarginPct,
      net_margin:     netMarginPct
    }
  })
}
