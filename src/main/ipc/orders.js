import { getDb } from '../database'
import { v4 as uuidv4 } from 'uuid'

export function registerOrderHandlers(ipcMain) {
  ipcMain.handle('orders:list', async (_, { businessId, status, clientId, limit = 100 }) => {
    const db = getDb()
    let sql = `
      SELECT o.*, c.name as client_name, c.code as client_code,
             COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.business_id = ?
    `
    const params = [businessId]
    if (status) { sql += ' AND o.status = ?'; params.push(status) }
    if (clientId) { sql += ' AND o.client_id = ?'; params.push(clientId) }
    sql += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT ?`
    params.push(limit)
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('orders:get', async (_, { id }) => {
    const db = getDb()
    const order = db.prepare(`
      SELECT o.*, c.name as client_name, c.email as client_email, c.phone as client_phone
      FROM orders o LEFT JOIN clients c ON o.client_id = c.id
      WHERE o.id = ?
    `).get(id)
    if (!order) return null

    order.items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.sku, p.unit
      FROM order_items oi JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(id)

    return order
  })

  ipcMain.handle('orders:create', async (_, { businessId, data }) => {
    const db = getDb()
    try {
      const id = uuidv4()
      const orderNumber = `ORD-${Date.now().toString().slice(-8)}`

      // Calculate totals
      let subtotal = 0
      for (const item of data.items) {
        const lineTotal = item.quantity * item.unit_price * (1 - (item.discount_pct || 0) / 100)
        subtotal += lineTotal
        item.line_total = lineTotal
      }

      const biz = db.prepare('SELECT tax_rate FROM businesses WHERE id = ?').get(businessId)
      const taxAmount = subtotal * ((biz?.tax_rate || 0) / 100)
      const total = subtotal + taxAmount - (data.discount_amount || 0)

      const createOrder = db.transaction(() => {
        db.prepare(`
          INSERT INTO orders (id, business_id, order_number, client_id, status, order_date, due_date,
            subtotal, tax_amount, discount_amount, total_amount, paid_amount, payment_method, notes, created_by)
          VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, businessId, orderNumber, data.client_id || null, data.status || 'completed',
               data.due_date || null, subtotal, taxAmount, data.discount_amount || 0,
               total, data.paid_amount || 0, data.payment_method, data.notes, data.created_by)

        const itemStmt = db.prepare(`
          INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, discount_pct, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)

        for (const item of data.items) {
          itemStmt.run(uuidv4(), id, item.product_id, item.quantity, item.unit_price, item.discount_pct || 0, item.line_total)

          // Deduct inventory
          db.prepare(`
            UPDATE inventory SET
              quantity_on_hand = quantity_on_hand - ?,
              last_updated = datetime('now')
            WHERE business_id = ? AND product_id = ?
          `).run(item.quantity, businessId, item.product_id)

          db.prepare(`
            INSERT INTO inventory_movements (id, business_id, product_id, movement_type, quantity, reference_id, reference_type, notes)
            VALUES (?, ?, ?, 'sale', ?, ?, 'order', ?)
          `).run(uuidv4(), businessId, item.product_id, item.quantity, id, `Sale: ${orderNumber}`)
        }

        // If credit sale
        const unpaid = total - (data.paid_amount || 0)
        if (unpaid > 0 && data.client_id) {
          const client = db.prepare('SELECT credit_terms FROM clients WHERE id = ?').get(data.client_id)
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + (client?.credit_terms || 30))

          db.prepare(`
            INSERT INTO credits (id, business_id, client_id, order_id, amount, balance, due_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'outstanding')
          `).run(uuidv4(), businessId, data.client_id, id, unpaid, unpaid, dueDate.toISOString())

          db.prepare('UPDATE clients SET current_balance = current_balance + ? WHERE id = ?').run(unpaid, data.client_id)
        }
      })

      createOrder()
      return { success: true, id, orderNumber }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('orders:update-status', async (_, { id, status }) => {
    const db = getDb()
    try {
      db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('orders:summary', async (_, { businessId, period = 'month' }) => {
    const db = getDb()
    let dateFilter
    if (period === 'today') dateFilter = "date(o.order_date) = date('now')"
    else if (period === 'week') dateFilter = "o.order_date >= date('now', '-7 days')"
    else if (period === 'month') dateFilter = "o.order_date >= date('now', '-30 days')"
    else if (period === 'year') dateFilter = "o.order_date >= date('now', '-365 days')"
    else dateFilter = '1=1'

    return db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(total_amount - paid_amount), 0) as total_outstanding,
        COALESCE(AVG(total_amount), 0) as avg_order_value
      FROM orders o
      WHERE o.business_id = ? AND o.status != 'cancelled' AND ${dateFilter}
    `).get(businessId)
  })
}
