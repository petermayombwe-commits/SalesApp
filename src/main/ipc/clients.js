import { getDb } from '../database'
import { v4 as uuidv4 } from 'uuid'

export function registerClientHandlers(ipcMain) {
  ipcMain.handle('clients:list', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT c.*,
             COUNT(DISTINCT o.id) as total_orders,
             COALESCE(SUM(o.total_amount), 0) as total_sales,
             COALESCE(SUM(cr.balance), 0) as outstanding_credit
      FROM clients c
      LEFT JOIN orders o ON c.id = o.client_id AND o.status != 'cancelled'
      LEFT JOIN credits cr ON c.id = cr.client_id AND cr.status = 'outstanding'
      WHERE c.business_id = ?
      GROUP BY c.id
      ORDER BY c.name
    `).all(businessId)
  })

  ipcMain.handle('clients:get', async (_, { id }) => {
    const db = getDb()
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id)
    if (!client) return null

    const orders = db.prepare(`
      SELECT o.*, COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.client_id = ?
      GROUP BY o.id
      ORDER BY o.created_at DESC LIMIT 20
    `).all(id)

    const credits = db.prepare(`
      SELECT * FROM credits WHERE client_id = ? ORDER BY created_at DESC
    `).all(id)

    return { ...client, orders, credits }
  })

  ipcMain.handle('clients:create', async (_, { businessId, data }) => {
    const db = getDb()
    try {
      const id = uuidv4()
      const code = data.code || `CLT-${Date.now().toString().slice(-6)}`
      db.prepare(`
        INSERT INTO clients (id, business_id, code, name, company, email, phone, address, credit_limit, credit_terms, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, businessId, code, data.name, data.company, data.email, data.phone, data.address,
             data.credit_limit || 0, data.credit_terms || 30, data.notes)
      return { success: true, id }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('clients:update', async (_, { id, data }) => {
    const db = getDb()
    try {
      db.prepare(`
        UPDATE clients SET
          name = ?, company = ?, email = ?, phone = ?, address = ?,
          credit_limit = ?, credit_terms = ?, notes = ?, is_active = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(data.name, data.company, data.email, data.phone, data.address,
             data.credit_limit, data.credit_terms, data.notes, data.is_active ? 1 : 0, id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('clients:ledger', async (_, { clientId }) => {
    const db = getDb()
    const orders = db.prepare(`
      SELECT 'order' as type, o.order_number as ref, o.order_date as date,
             o.total_amount as debit, o.paid_amount as credit,
             o.total_amount - o.paid_amount as balance, o.status
      FROM orders o WHERE o.client_id = ?
      ORDER BY o.order_date DESC
    `).all(clientId)

    const payments = db.prepare(`
      SELECT 'payment' as type, cp.reference as ref, cp.paid_at as date,
             0 as debit, cp.amount as credit, 0 as balance, 'paid' as status
      FROM credit_payments cp
      JOIN credits cr ON cp.credit_id = cr.id
      WHERE cr.client_id = ?
      ORDER BY cp.paid_at DESC
    `).all(clientId)

    return [...orders, ...payments].sort((a, b) => new Date(b.date) - new Date(a.date))
  })
}
