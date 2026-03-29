import { getDb } from '../database'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

// ─── Credits ──────────────────────────────────────────────────────────────────

export function registerCreditHandlers(ipcMain) {
  ipcMain.handle('credits:list', async (_, { businessId, status }) => {
    const db = getDb()
    let sql = `
      SELECT cr.*, c.name as client_name, c.code as client_code, c.phone as client_phone,
             o.order_number
      FROM credits cr
      JOIN clients c ON cr.client_id = c.id
      LEFT JOIN orders o ON cr.order_id = o.id
      WHERE cr.business_id = ?
    `
    const params = [businessId]
    if (status) { sql += ' AND cr.status = ?'; params.push(status) }
    sql += ' ORDER BY cr.due_date ASC'
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('credits:record-payment', async (_, { creditId, amount, method, reference, notes, recordedBy }) => {
    const db = getDb()
    try {
      const credit = db.prepare('SELECT * FROM credits WHERE id = ?').get(creditId)
      if (!credit) return { success: false, error: 'Credit not found' }

      const newBalance = credit.balance - amount
      const newStatus = newBalance <= 0.01 ? 'settled' : 'outstanding'

      db.prepare(`
        INSERT INTO credit_payments (id, credit_id, amount, payment_method, reference, notes, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), creditId, amount, method, reference, notes, recordedBy)

      db.prepare('UPDATE credits SET balance = ?, status = ?, updated_at = datetime("now") WHERE id = ?')
        .run(Math.max(0, newBalance), newStatus, creditId)

      db.prepare('UPDATE clients SET current_balance = current_balance - ? WHERE id = ?')
        .run(amount, credit.client_id)

      return { success: true, newBalance: Math.max(0, newBalance), newStatus }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('credits:overdue', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT cr.*, c.name as client_name, c.phone, c.email,
             julianday('now') - julianday(cr.due_date) as days_overdue
      FROM credits cr
      JOIN clients c ON cr.client_id = c.id
      WHERE cr.business_id = ? AND cr.status = 'outstanding'
        AND date(cr.due_date) < date('now')
      ORDER BY days_overdue DESC
    `).all(businessId)
  })

  ipcMain.handle('collection-rules:list', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare('SELECT * FROM collection_rules WHERE business_id = ? ORDER BY days_overdue').all(businessId)
  })

  ipcMain.handle('collection-rules:save', async (_, { businessId, rules }) => {
    const db = getDb()
    try {
      db.prepare('DELETE FROM collection_rules WHERE business_id = ?').run(businessId)
      const stmt = db.prepare(`
        INSERT INTO collection_rules (id, business_id, name, days_overdue, action_type, message_template, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      for (const r of rules) {
        stmt.run(r.id || uuidv4(), businessId, r.name, r.days_overdue, r.action_type, r.message_template, r.is_active ? 1 : 0)
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export function registerStaffHandlers(ipcMain) {
  ipcMain.handle('staff:list', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT id, username, email, full_name, role, permissions, is_active, last_login, created_at
      FROM users WHERE business_id = ? ORDER BY role, full_name
    `).all(businessId).map(u => ({ ...u, permissions: JSON.parse(u.permissions || '{}') }))
  })

  ipcMain.handle('staff:create', async (_, { businessId, data }) => {
    const db = getDb()
    try {
      const hash = bcrypt.hashSync(data.password, 10)
      const id = uuidv4()
      db.prepare(`
        INSERT INTO users (id, business_id, username, email, password_hash, full_name, role, permissions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, businessId, data.username, data.email, hash, data.full_name, data.role, JSON.stringify(data.permissions || {}))
      return { success: true, id }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('staff:update', async (_, { id, data }) => {
    const db = getDb()
    try {
      db.prepare(`
        UPDATE users SET full_name = ?, email = ?, role = ?, permissions = ?, is_active = ? WHERE id = ?
      `).run(data.full_name, data.email, data.role, JSON.stringify(data.permissions || {}), data.is_active ? 1 : 0, id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function registerReportHandlers(ipcMain) {
  ipcMain.handle('reports:sales-over-time', async (_, { businessId, days = 30 }) => {
    const db = getDb()
    return db.prepare(`
      SELECT date(order_date) as date,
             COUNT(*) as order_count,
             SUM(total_amount) as revenue,
             SUM(paid_amount) as collected
      FROM orders
      WHERE business_id = ? AND status != 'cancelled'
        AND order_date >= date('now', ? || ' days')
      GROUP BY date(order_date)
      ORDER BY date
    `).all(businessId, `-${days}`)
  })

  ipcMain.handle('reports:top-products', async (_, { businessId, limit = 10 }) => {
    const db = getDb()
    return db.prepare(`
      SELECT p.name, p.sku, p.category,
             SUM(oi.quantity) as total_qty,
             SUM(oi.line_total) as total_revenue,
             COUNT(DISTINCT o.id) as order_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.business_id = ? AND o.status != 'cancelled'
        AND o.order_date >= date('now', '-30 days')
      GROUP BY p.id
      ORDER BY total_revenue DESC LIMIT ?
    `).all(businessId, limit)
  })

  ipcMain.handle('reports:top-clients', async (_, { businessId, limit = 10 }) => {
    const db = getDb()
    return db.prepare(`
      SELECT c.name, c.code, c.company,
             COUNT(o.id) as order_count,
             SUM(o.total_amount) as total_value,
             SUM(o.paid_amount) as total_paid
      FROM clients c
      JOIN orders o ON c.id = o.client_id
      WHERE c.business_id = ? AND o.status != 'cancelled'
        AND o.order_date >= date('now', '-30 days')
      GROUP BY c.id
      ORDER BY total_value DESC LIMIT ?
    `).all(businessId, limit)
  })

  ipcMain.handle('reports:category-breakdown', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT p.category, SUM(oi.line_total) as revenue, SUM(oi.quantity) as qty
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.business_id = ? AND o.status != 'cancelled'
        AND o.order_date >= date('now', '-30 days')
      GROUP BY p.category ORDER BY revenue DESC
    `).all(businessId)
  })
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function registerSettingsHandlers(ipcMain) {
  ipcMain.handle('settings:get', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare('SELECT * FROM businesses WHERE id = ?').get(businessId)
  })

  ipcMain.handle('settings:update', async (_, { businessId, data }) => {
    const db = getDb()
    try {
      db.prepare(`
        UPDATE businesses SET name=?, address=?, phone=?, email=?, currency=?, tax_rate=?, updated_at=datetime('now')
        WHERE id=?
      `).run(data.name, data.address, data.phone, data.email, data.currency, data.tax_rate, businessId)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export function registerForecastHandlers(ipcMain) {
  ipcMain.handle('forecast:demand', async (_, { businessId, productId, days = 30 }) => {
    const db = getDb()
    const history = db.prepare(`
      SELECT date(o.order_date) as date, SUM(oi.quantity) as qty
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.business_id = ? AND oi.product_id = ? AND o.status != 'cancelled'
        AND o.order_date >= date('now', '-90 days')
      GROUP BY date(o.order_date)
      ORDER BY date
    `).all(businessId, productId)

    if (history.length < 7) return { success: false, error: 'Insufficient data (need 7+ days of sales)' }

    const avgDaily = history.reduce((s, r) => s + r.qty, 0) / history.length
    const forecast = []
    for (let i = 1; i <= days; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      forecast.push({
        date: d.toISOString().split('T')[0],
        predicted: Math.round(avgDaily * (0.9 + Math.random() * 0.2)),
        confidence: 0.75
      })
    }
    return { success: true, avgDaily, forecast, historyDays: history.length }
  })

  ipcMain.handle('forecast:revenue', async (_, { businessId }) => {
    const db = getDb()
    const monthly = db.prepare(`
      SELECT strftime('%Y-%m', order_date) as month,
             SUM(total_amount) as revenue
      FROM orders
      WHERE business_id = ? AND status != 'cancelled'
        AND order_date >= date('now', '-12 months')
      GROUP BY month ORDER BY month
    `).all(businessId)

    if (monthly.length < 2) return { success: false, forecast: [] }

    const avg = monthly.reduce((s, r) => s + r.revenue, 0) / monthly.length
    const trend = monthly.length >= 3
      ? (monthly[monthly.length - 1].revenue - monthly[0].revenue) / monthly.length
      : 0

    const forecast = []
    for (let i = 1; i <= 3; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() + i)
      forecast.push({ month: d.toISOString().slice(0, 7), predicted: Math.max(0, avg + trend * i) })
    }
    return { success: true, history: monthly, forecast }
  })
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function registerNotificationHandlers(ipcMain) {
  ipcMain.handle('notifications:list', async (_, { businessId, userId, unreadOnly = false }) => {
    const db = getDb()
    let sql = `
      SELECT * FROM notifications
      WHERE business_id = ? AND (user_id IS NULL OR user_id = ?)
    `
    if (unreadOnly) sql += ' AND is_read = 0'
    sql += ' ORDER BY created_at DESC LIMIT 50'
    return db.prepare(sql).all(businessId, userId)
  })

  ipcMain.handle('notifications:mark-read', async (_, { id }) => {
    const db = getDb()
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id)
    return { success: true }
  })

  ipcMain.handle('notifications:mark-all-read', async (_, { businessId, userId }) => {
    const db = getDb()
    db.prepare('UPDATE notifications SET is_read = 1 WHERE business_id = ? AND (user_id IS NULL OR user_id = ?)').run(businessId, userId)
    return { success: true }
  })

  ipcMain.handle('notifications:generate-credit-alerts', async (_, { businessId }) => {
    const db = getDb()
    const rules = db.prepare('SELECT * FROM collection_rules WHERE business_id = ? AND is_active = 1').all(businessId)
    const credits = db.prepare(`
      SELECT cr.*, c.name as client_name
      FROM credits cr JOIN clients c ON cr.client_id = c.id
      WHERE cr.business_id = ? AND cr.status = 'outstanding'
    `).all(businessId)

    let created = 0
    for (const credit of credits) {
      const dueDate = new Date(credit.due_date)
      const now = new Date()
      const daysUntilDue = Math.round((dueDate - now) / (1000 * 60 * 60 * 24))

      for (const rule of rules) {
        const ruleDays = -rule.days_overdue
        if (Math.abs(daysUntilDue - ruleDays) <= 1) {
          const existing = db.prepare(`
            SELECT id FROM notifications
            WHERE reference_id = ? AND type = ? AND date(created_at) = date('now')
          `).get(credit.id, rule.action_type)

          if (!existing) {
            const msg = rule.message_template
              .replace('{amount}', `$${credit.balance.toFixed(2)}`)
              .replace('{client}', credit.client_name)
              .replace('{days}', Math.abs(daysUntilDue))

            db.prepare(`
              INSERT INTO notifications (id, business_id, type, title, message, reference_id, reference_type)
              VALUES (?, ?, ?, ?, ?, ?, 'credit')
            `).run(uuidv4(), businessId, rule.action_type,
              `Credit ${rule.action_type}: ${credit.client_name}`, msg, credit.id)
            created++
          }
        }
      }
    }
    return { success: true, created }
  })
}
