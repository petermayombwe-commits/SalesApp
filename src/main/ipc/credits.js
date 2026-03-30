import { getDb } from '../database'
import { v4 as uuidv4 } from 'uuid'

export function registerCreditHandlers(ipcMain) {

  // ── List all credits ────────────────────────────────────────────────────────
  ipcMain.handle('credits:list', async (_, { businessId, status, clientId }) => {
    const db = getDb()
    let sql = `
      SELECT cr.*,
             c.name as client_name, c.code as client_code,
             c.phone as client_phone, c.email as client_email,
             c.credit_limit,
             o.order_number,
             (SELECT COUNT(*) FROM credit_payments cp WHERE cp.credit_id = cr.id) as payment_count,
             (SELECT COALESCE(SUM(cp.amount),0) FROM credit_payments cp WHERE cp.credit_id = cr.id) as total_paid,
             CASE
               WHEN cr.status = 'settled' THEN 'settled'
               WHEN cr.status = 'written_off' THEN 'written_off'
               WHEN cr.due_date IS NOT NULL AND date(cr.due_date) < date('now') THEN 'overdue'
               ELSE 'outstanding'
             END as computed_status,
             CAST(julianday('now') - julianday(cr.due_date) AS INTEGER) as days_overdue
      FROM credits cr
      JOIN clients c ON cr.client_id = c.id
      LEFT JOIN orders o ON cr.order_id = o.id
      WHERE cr.business_id = ?
    `
    const params = [businessId]
    if (status === 'overdue') {
      sql += ` AND cr.status = 'outstanding' AND date(cr.due_date) < date('now')`
    } else if (status === 'outstanding') {
      sql += ` AND cr.status = 'outstanding'`
    } else if (status === 'settled') {
      sql += ` AND cr.status = 'settled'`
    } else if (status === 'written_off') {
      sql += ` AND cr.status = 'written_off'`
    }
    if (clientId) { sql += ' AND cr.client_id = ?'; params.push(clientId) }
    sql += ' ORDER BY cr.due_date ASC, cr.created_at DESC'
    return db.prepare(sql).all(...params)
  })

  // ── Create manual credit ────────────────────────────────────────────────────
  ipcMain.handle('credits:create', async (_, { businessId, data }) => {
    const db = getDb()
    try {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO credits
          (id, business_id, client_id, order_id, credit_type, amount, balance, due_date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'outstanding', ?)
      `).run(
        id, businessId,
        data.client_id,
        data.order_id || null,
        data.credit_type || 'manual',
        Number(data.amount),
        Number(data.amount),
        data.due_date || null,
        data.notes || null
      )
      // Update client balance
      db.prepare('UPDATE clients SET current_balance = current_balance + ? WHERE id = ?')
        .run(Number(data.amount), data.client_id)
      return { success: true, id }
    } catch (err) {
      console.error('[credits:create]', err)
      return { success: false, error: err.message }
    }
  })

  // ── Update credit (due date, notes) ────────────────────────────────────────
  ipcMain.handle('credits:update', async (_, { id, data }) => {
    const db = getDb()
    try {
      db.prepare(`
        UPDATE credits SET
          due_date = ?, notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(data.due_date || null, data.notes || null, id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Record payment ──────────────────────────────────────────────────────────
  ipcMain.handle('credits:record-payment', async (_, { creditId, amount, method, reference, notes, recordedBy, paymentDate }) => {
    const db = getDb()
    try {
      const credit = db.prepare('SELECT * FROM credits WHERE id = ?').get(creditId)
      if (!credit) return { success: false, error: 'Credit not found' }
      if (credit.status === 'written_off') return { success: false, error: 'Cannot record payment on a written-off credit' }

      const payAmt     = Number(amount)
      const newBalance = Math.max(0, credit.balance - payAmt)
      const newStatus  = newBalance <= 0.01 ? 'settled' : 'outstanding'

      db.prepare(`
        INSERT INTO credit_payments (id, credit_id, amount, payment_method, reference, notes, paid_at, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), creditId, payAmt, method,
        reference || null, notes || null,
        paymentDate || new Date().toISOString(),
        recordedBy || null
      )

      db.prepare(`UPDATE credits SET balance = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(newBalance, newStatus, creditId)

      db.prepare('UPDATE clients SET current_balance = MAX(0, current_balance - ?) WHERE id = ?')
        .run(payAmt, credit.client_id)

      return { success: true, newBalance, newStatus }
    } catch (err) {
      console.error('[credits:record-payment]', err)
      return { success: false, error: err.message }
    }
  })

  // ── Payment history for one credit ─────────────────────────────────────────
  ipcMain.handle('credits:payment-history', async (_, { creditId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT cp.*, u.full_name as recorded_by_name
      FROM credit_payments cp
      LEFT JOIN users u ON cp.recorded_by = u.id
      WHERE cp.credit_id = ?
      ORDER BY cp.paid_at DESC
    `).all(creditId)
  })

  // ── All payments across business ────────────────────────────────────────────
  ipcMain.handle('credits:all-payments', async (_, { businessId, limit = 100 }) => {
    const db = getDb()
    return db.prepare(`
      SELECT cp.*, cr.amount as credit_amount, cr.due_date,
             c.name as client_name, c.code as client_code,
             o.order_number, u.full_name as recorded_by_name
      FROM credit_payments cp
      JOIN credits cr ON cp.credit_id = cr.id
      JOIN clients c ON cr.client_id = c.id
      LEFT JOIN orders o ON cr.order_id = o.id
      LEFT JOIN users u ON cp.recorded_by = u.id
      WHERE cr.business_id = ?
      ORDER BY cp.paid_at DESC
      LIMIT ?
    `).all(businessId, limit)
  })

  // ── Write off ───────────────────────────────────────────────────────────────
  ipcMain.handle('credits:write-off', async (_, { creditId, notes }) => {
    const db = getDb()
    try {
      const credit = db.prepare('SELECT * FROM credits WHERE id = ?').get(creditId)
      if (!credit) return { success: false, error: 'Credit not found' }

      db.prepare(`
        UPDATE credits SET status = 'written_off', notes = ?, updated_at = datetime('now') WHERE id = ?
      `).run((credit.notes ? credit.notes + '\n' : '') + `Written off: ${notes || 'Bad debt'}`, creditId)

      // Remove from client's active balance
      db.prepare('UPDATE clients SET current_balance = MAX(0, current_balance - ?) WHERE id = ?')
        .run(credit.balance, credit.client_id)

      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Overdue ─────────────────────────────────────────────────────────────────
  ipcMain.handle('credits:overdue', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT cr.*, c.name as client_name, c.phone, c.email, c.code as client_code,
             o.order_number,
             CAST(julianday('now') - julianday(cr.due_date) AS INTEGER) as days_overdue
      FROM credits cr
      JOIN clients c ON cr.client_id = c.id
      LEFT JOIN orders o ON cr.order_id = o.id
      WHERE cr.business_id = ? AND cr.status = 'outstanding'
        AND date(cr.due_date) < date('now')
      ORDER BY days_overdue DESC
    `).all(businessId)
  })

  // ── Aging report ────────────────────────────────────────────────────────────
  ipcMain.handle('credits:aging', async (_, { businessId }) => {
    const db = getDb()
    const rows = db.prepare(`
      SELECT
        c.id as client_id, c.name as client_name, c.code as client_code,
        c.phone, c.email, c.credit_limit,
        COALESCE(SUM(CASE WHEN cr.status='outstanding' THEN cr.balance ELSE 0 END), 0) as total_outstanding,
        COALESCE(SUM(CASE WHEN cr.status='outstanding' AND (cr.due_date IS NULL OR date(cr.due_date) >= date('now')) THEN cr.balance ELSE 0 END), 0) as current_amount,
        COALESCE(SUM(CASE WHEN cr.status='outstanding' AND julianday('now') - julianday(cr.due_date) BETWEEN 1  AND 30  THEN cr.balance ELSE 0 END), 0) as days_1_30,
        COALESCE(SUM(CASE WHEN cr.status='outstanding' AND julianday('now') - julianday(cr.due_date) BETWEEN 31 AND 60  THEN cr.balance ELSE 0 END), 0) as days_31_60,
        COALESCE(SUM(CASE WHEN cr.status='outstanding' AND julianday('now') - julianday(cr.due_date) BETWEEN 61 AND 90  THEN cr.balance ELSE 0 END), 0) as days_61_90,
        COALESCE(SUM(CASE WHEN cr.status='outstanding' AND julianday('now') - julianday(cr.due_date) > 90 THEN cr.balance ELSE 0 END), 0) as days_over_90,
        COUNT(CASE WHEN cr.status='outstanding' THEN 1 END) as open_credits
      FROM clients c
      LEFT JOIN credits cr ON c.id = cr.client_id
      WHERE c.business_id = ?
      GROUP BY c.id
      HAVING total_outstanding > 0
      ORDER BY total_outstanding DESC
    `).all(businessId)

    // Totals row
    const totals = rows.reduce((acc, r) => ({
      total_outstanding: acc.total_outstanding + r.total_outstanding,
      current_amount:    acc.current_amount    + r.current_amount,
      days_1_30:         acc.days_1_30         + r.days_1_30,
      days_31_60:        acc.days_31_60        + r.days_31_60,
      days_61_90:        acc.days_61_90        + r.days_61_90,
      days_over_90:      acc.days_over_90      + r.days_over_90
    }), { total_outstanding: 0, current_amount: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_over_90: 0 })

    return { rows, totals }
  })

  // ── Client credit summary ───────────────────────────────────────────────────
  ipcMain.handle('credits:client-summary', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT c.id, c.name, c.code, c.phone, c.email, c.credit_limit, c.credit_terms,
             COALESCE(SUM(CASE WHEN cr.status='outstanding' THEN cr.balance ELSE 0 END), 0) as outstanding,
             COALESCE(SUM(CASE WHEN cr.status='settled'     THEN cr.amount  ELSE 0 END), 0) as total_settled,
             COUNT(CASE WHEN cr.status='outstanding' THEN 1 END) as open_credits,
             COUNT(CASE WHEN cr.status='outstanding' AND date(cr.due_date) < date('now') THEN 1 END) as overdue_credits,
             MAX(cr.due_date) as latest_due
      FROM clients c
      LEFT JOIN credits cr ON c.id = cr.client_id
      WHERE c.business_id = ?
      GROUP BY c.id
      HAVING outstanding > 0 OR total_settled > 0
      ORDER BY outstanding DESC
    `).all(businessId)
  })

  // ── Collection rules ────────────────────────────────────────────────────────
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
