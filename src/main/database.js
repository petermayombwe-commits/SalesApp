import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

let db = null

export function getDb() {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}

export function initDatabase() {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'salesflow.db')
  console.log('[DB] Opening database at:', dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  seedDefaultData()

  console.log('[DB] Ready')
  return db
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      logo_path TEXT,
      currency TEXT DEFAULT 'USD',
      tax_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      permissions TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      UNIQUE(business_id, username),
      UNIQUE(business_id, email)
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      sku TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      unit TEXT DEFAULT 'pcs',
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      reorder_level INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity_on_hand REAL DEFAULT 0,
      quantity_reserved REAL DEFAULT 0,
      location TEXT,
      last_updated TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(business_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      credit_limit REAL DEFAULT 0,
      credit_terms INTEGER DEFAULT 30,
      current_balance REAL DEFAULT 0,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      order_number TEXT NOT NULL,
      client_id TEXT,
      status TEXT DEFAULT 'pending',
      order_date TEXT DEFAULT (datetime('now')),
      due_date TEXT,
      subtotal REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      payment_method TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount_pct REAL DEFAULT 0,
      line_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS credits (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      order_id TEXT,
      credit_type TEXT DEFAULT 'sale',
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'outstanding',
      demand_sent_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS credit_payments (
      id TEXT PRIMARY KEY,
      credit_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      reference TEXT,
      notes TEXT,
      paid_at TEXT DEFAULT (datetime('now')),
      recorded_by TEXT,
      FOREIGN KEY (credit_id) REFERENCES credits(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      reference_id TEXT,
      reference_type TEXT,
      is_read INTEGER DEFAULT 0,
      scheduled_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS collection_rules (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      days_overdue INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      message_template TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      category_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      expense_date TEXT DEFAULT (datetime('now')),
      payment_method TEXT DEFAULT 'cash',
      vendor TEXT,
      reference TEXT,
      receipt_note TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurrence TEXT,
      recorded_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS forecast_cache (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      product_id TEXT,
      forecast_date TEXT NOT NULL,
      forecast_type TEXT NOT NULL,
      predicted_value REAL,
      confidence REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
    );
  `)
}

function seedDefaultData() {
  // Only seed if no businesses exist
  const existing = db.prepare('SELECT id FROM businesses LIMIT 1').get()
  if (existing) {
    console.log('[DB] Existing data found — skipping seed')
    return
  }

  console.log('[DB] Seeding default business and admin account...')

  const bizId   = uuidv4()
  const adminId = uuidv4()
  const hash    = bcrypt.hashSync('admin123', 10)

  db.prepare(`
    INSERT INTO businesses (id, name, address, phone, email, currency, tax_rate)
    VALUES (?, 'My Business', '123 Main Street', '+1 555-0100', 'admin@mybusiness.com', 'USD', 0)
  `).run(bizId)

  db.prepare(`
    INSERT INTO users (id, business_id, username, email, password_hash, full_name, role, permissions)
    VALUES (?, ?, 'admin', 'admin@mybusiness.com', ?, 'Administrator', 'admin', '{"all":true}')
  `).run(adminId, bizId, hash)

  // Default collection rules
  const rules = [
    { days: -7,  type: 'reminder', msg: 'Friendly reminder: payment of {amount} for {client} is due in 7 days.' },
    { days: 0,   type: 'due',      msg: 'Payment of {amount} is due TODAY for {client}. Please arrange settlement.' },
    { days: 14,  type: 'demand',   msg: 'FINAL DEMAND: {client} account is 14 days overdue. Immediate payment of {amount} required.' },
    { days: 30,  type: 'escalate', msg: 'ESCALATION NOTICE: {client} account is 30 days overdue. Legal action may commence.' }
  ]

  const ruleStmt = db.prepare(`
    INSERT INTO collection_rules (id, business_id, name, days_overdue, action_type, message_template)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const r of rules) {
    ruleStmt.run(uuidv4(), bizId, `${r.type} (${r.days}d)`, r.days, r.type, r.msg)
  }

  // Sample products with inventory
  const products = [
    { name: 'Widget A',    sku: 'WID-001', cat: 'Widgets',  cost: 10,  price: 25,  reorder: 50,  stock: 150 },
    { name: 'Widget B',    sku: 'WID-002', cat: 'Widgets',  cost: 15,  price: 35,  reorder: 30,  stock: 80  },
    { name: 'Gadget Pro',  sku: 'GAD-001', cat: 'Gadgets',  cost: 50,  price: 120, reorder: 20,  stock: 45  },
    { name: 'Service X',   sku: 'SRV-001', cat: 'Services', cost: 0,   price: 200, reorder: 0,   stock: 999 },
    { name: 'Part Alpha',  sku: 'PRT-001', cat: 'Parts',    cost: 5,   price: 12,  reorder: 100, stock: 8   }
  ]

  const prodStmt = db.prepare(`
    INSERT INTO products (id, business_id, sku, name, category, cost_price, selling_price, reorder_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const invStmt = db.prepare(`
    INSERT INTO inventory (id, business_id, product_id, quantity_on_hand)
    VALUES (?, ?, ?, ?)
  `)

  for (const p of products) {
    const pid = uuidv4()
    prodStmt.run(pid, bizId, p.sku, p.name, p.cat, p.cost, p.price, p.reorder)
    invStmt.run(uuidv4(), bizId, pid, p.stock)
  }


  // Default expense categories
  const catStmt = db.prepare(`
    INSERT INTO expense_categories (id, business_id, name, color)
    VALUES (?, ?, ?, ?)
  `)
  const expCats = [
    { name: 'Rent & Utilities',   color: '#3b82f6' },
    { name: 'Salaries & Wages',   color: '#8b5cf6' },
    { name: 'Inventory Purchase', color: '#10b981' },
    { name: 'Transport',          color: '#f59e0b' },
    { name: 'Marketing',          color: '#ef4444' },
    { name: 'Office Supplies',    color: '#06b6d4' },
    { name: 'Maintenance',        color: '#f97316' },
    { name: 'Miscellaneous',      color: '#64748b' }
  ]
  for (const cat of expCats) {
    catStmt.run(uuidv4(), bizId, cat.name, cat.color)
  }

  console.log('[DB] Seed complete — login: admin / admin123')

}
