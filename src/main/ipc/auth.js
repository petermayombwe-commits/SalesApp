import { getDb } from '../database'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

export function registerAuthHandlers(ipcMain) {
  ipcMain.handle('auth:login', async (_, { businessId, username, password }) => {
    const db = getDb()
    try {
      const user = db.prepare(`
        SELECT u.*, b.name as business_name, b.currency, b.tax_rate
        FROM users u
        JOIN businesses b ON u.business_id = b.id
        WHERE u.business_id = ? AND u.username = ? AND u.is_active = 1
      `).get(businessId, username)

      if (!user) return { success: false, error: 'Invalid credentials' }

      const valid = bcrypt.compareSync(password, user.password_hash)
      if (!valid) return { success: false, error: 'Invalid credentials' }

      db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?').run(user.id)

      const { password_hash, ...safeUser } = user
      safeUser.permissions = JSON.parse(safeUser.permissions || '{}')
      return { success: true, user: safeUser }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('auth:list-businesses', async () => {
    const db = getDb()
    return db.prepare('SELECT id, name, email FROM businesses ORDER BY name').all()
  })

  ipcMain.handle('auth:create-business', async (_, data) => {
    const db = getDb()
    try {
      const bizId = uuidv4()
      const adminId = uuidv4()
      const hash = bcrypt.hashSync(data.adminPassword, 10)

      db.prepare(`
        INSERT INTO businesses (id, name, address, phone, email, currency, tax_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(bizId, data.name, data.address, data.phone, data.email, data.currency || 'USD', data.taxRate || 0)

      db.prepare(`
        INSERT INTO users (id, business_id, username, email, password_hash, full_name, role, permissions)
        VALUES (?, ?, ?, ?, ?, ?, 'admin', '{"all":true}')
      `).run(adminId, bizId, data.adminUsername, data.email, hash, data.adminName)

      return { success: true, businessId: bizId }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('auth:change-password', async (_, { userId, currentPassword, newPassword }) => {
    const db = getDb()
    try {
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId)
      if (!user) return { success: false, error: 'User not found' }

      if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
        return { success: false, error: 'Current password is incorrect' }
      }

      const newHash = bcrypt.hashSync(newPassword, 10)
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
