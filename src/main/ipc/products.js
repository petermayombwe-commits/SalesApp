import { getDb } from '../database'
import { v4 as uuidv4 } from 'uuid'

export function registerProductHandlers(ipcMain) {
  ipcMain.handle('products:list', async (_, { businessId, includeInactive = false }) => {
    const db = getDb()
    const sql = `
      SELECT p.*, i.quantity_on_hand, i.quantity_reserved,
             (i.quantity_on_hand - COALESCE(i.quantity_reserved,0)) as available_qty
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id AND i.business_id = p.business_id
      WHERE p.business_id = ?
      ${!includeInactive ? "AND p.is_active = 1" : ""}
      ORDER BY p.category, p.name
    `
    return db.prepare(sql).all(businessId)
  })

  ipcMain.handle('products:get', async (_, { id }) => {
    const db = getDb()
    return db.prepare(`
      SELECT p.*, i.quantity_on_hand, i.quantity_reserved
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.id = ?
    `).get(id)
  })

  ipcMain.handle('products:create', async (_, { businessId, data }) => {
    const db = getDb()
    try {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO products (id, business_id, sku, name, description, category, unit, cost_price, selling_price, reorder_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, businessId, data.sku, data.name, data.description, data.category, data.unit || 'pcs',
             data.cost_price || 0, data.selling_price || 0, data.reorder_level || 10)

      db.prepare(`
        INSERT OR IGNORE INTO inventory (id, business_id, product_id, quantity_on_hand)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), businessId, id, data.initial_stock || 0)

      if (data.initial_stock > 0) {
        db.prepare(`
          INSERT INTO inventory_movements (id, business_id, product_id, movement_type, quantity, notes)
          VALUES (?, ?, ?, 'opening', ?, 'Opening stock')
        `).run(uuidv4(), businessId, id, data.initial_stock)
      }

      return { success: true, id }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('products:update', async (_, { id, data }) => {
    const db = getDb()
    try {
      db.prepare(`
        UPDATE products SET
          sku = ?, name = ?, description = ?, category = ?, unit = ?,
          cost_price = ?, selling_price = ?, reorder_level = ?, is_active = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(data.sku, data.name, data.description, data.category, data.unit,
             data.cost_price, data.selling_price, data.reorder_level, data.is_active ? 1 : 0, id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('products:delete', async (_, { id }) => {
    const db = getDb()
    try {
      db.prepare('UPDATE products SET is_active = 0, updated_at = datetime("now") WHERE id = ?').run(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('products:categories', async (_, { businessId }) => {
    const db = getDb()
    return db.prepare(`
      SELECT DISTINCT category FROM products
      WHERE business_id = ? AND category IS NOT NULL AND is_active = 1
      ORDER BY category
    `).all(businessId).map(r => r.category)
  })
}
