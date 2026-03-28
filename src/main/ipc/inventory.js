import { getDb } from '../database'
import { v4 as uuidv4 } from 'uuid'

export function registerInventoryHandlers(ipcMain) {
  ipcMain.handle('inventory:list', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT p.id as product_id, p.sku, p.name, p.category, p.unit,
             p.cost_price, p.selling_price, p.reorder_level,
             COALESCE(i.quantity_on_hand, 0) as quantity_on_hand,
             COALESCE(i.quantity_reserved, 0) as quantity_reserved,
             COALESCE(i.quantity_on_hand, 0) - COALESCE(i.quantity_reserved, 0) as available_qty,
             i.last_updated,
             CASE WHEN COALESCE(i.quantity_on_hand,0) <= p.reorder_level THEN 1 ELSE 0 END as needs_reorder
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id AND i.business_id = ?
      WHERE p.business_id = ? AND p.is_active = 1
      ORDER BY needs_reorder DESC, p.category, p.name
    `).all(businessId, businessId)
  })

  ipcMain.handle('inventory:adjust', async (_, { businessId, productId, quantity, type, notes, createdBy }) => {
    const db = getDb()
    try {
      const existing = db.prepare('SELECT * FROM inventory WHERE business_id = ? AND product_id = ?').get(businessId, productId)
      let newQty

      if (type === 'set') {
        newQty = quantity
      } else if (type === 'add') {
        newQty = (existing?.quantity_on_hand || 0) + quantity
      } else if (type === 'subtract') {
        newQty = (existing?.quantity_on_hand || 0) - quantity
        if (newQty < 0) return { success: false, error: 'Insufficient stock' }
      } else {
        return { success: false, error: 'Invalid adjustment type' }
      }

      if (existing) {
        db.prepare(`
          UPDATE inventory SET quantity_on_hand = ?, last_updated = datetime('now')
          WHERE business_id = ? AND product_id = ?
        `).run(newQty, businessId, productId)
      } else {
        db.prepare(`
          INSERT INTO inventory (id, business_id, product_id, quantity_on_hand)
          VALUES (?, ?, ?, ?)
        `).run(uuidv4(), businessId, productId, newQty)
      }

      db.prepare(`
        INSERT INTO inventory_movements (id, business_id, product_id, movement_type, quantity, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), businessId, productId, type === 'add' ? 'purchase' : type === 'subtract' ? 'adjustment' : 'set', quantity, notes, createdBy)

      return { success: true, newQuantity: newQty }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('inventory:movements', async (_, { businessId, productId, limit = 50 }) => {
    const db = getDb()
    const sql = productId
      ? `SELECT im.*, p.name as product_name, p.sku
         FROM inventory_movements im
         JOIN products p ON im.product_id = p.id
         WHERE im.business_id = ? AND im.product_id = ?
         ORDER BY im.created_at DESC LIMIT ?`
      : `SELECT im.*, p.name as product_name, p.sku
         FROM inventory_movements im
         JOIN products p ON im.product_id = p.id
         WHERE im.business_id = ?
         ORDER BY im.created_at DESC LIMIT ?`

    return productId
      ? db.prepare(sql).all(businessId, productId, limit)
      : db.prepare(sql).all(businessId, limit)
  })

  ipcMain.handle('inventory:low-stock', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT p.id, p.name, p.sku, p.category, p.reorder_level,
             COALESCE(i.quantity_on_hand, 0) as current_stock
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id AND i.business_id = ?
      WHERE p.business_id = ? AND p.is_active = 1
        AND COALESCE(i.quantity_on_hand, 0) <= p.reorder_level
      ORDER BY (COALESCE(i.quantity_on_hand,0) - p.reorder_level) ASC
    `).all(businessId, businessId)
  })
}
