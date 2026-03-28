import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'

const DB_VERSION = 1
let db

export function getDb() {
  return db
}

export async function initDatabase() {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

  const dbPath = join(dbDir, 'salesflow.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  seedDefaultData()
  return db
}

function createTables() {
  db.exec(`
    -- Businesses / Tenants
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

    -- Users / Staff
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

    -- Products
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

    -- Inventory
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

    -- Inventory Movements
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

    -- Clients
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

    -- Orders
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

    -- Order Items
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

    -- Credits / Ledger
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

    -- Credit Payments
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

    -- Notifications / Reminders
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

    -- Debt Collection Rules
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

    -- Forecasting Cache
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
  const bizExists = db.prepare('SELECT id FROM businesses LIMIT 1').get()
  if (bizExists) return

  const bizId = uuidv4()
  const adminId = uuidv4()
  const hash = bcrypt.hashSync('admin123', 10)

  db.prepare(`
    INSERT INTO businesses (id, name, address, phone, email, currency)
    VALUES (?, 'My Business', '123 Main Street', '+1 555-0100', 'admin@mybusiness.com', 'USD')
  `).run(bizId)

  db.prepare(`
    INSERT INTO users (id, business_id, username, email, password_hash, full_name, role, permissions)
    VALUES (?, ?, 'admin', 'admin@mybusiness.com', ?, 'Administrator', 'admin', '{"all": true}')
  `).run(adminId, bizId, hash)

  // Default collection rules
  const rules = [
    { days: 7,  type: 'reminder', msg: 'This is a friendly reminder that payment of {amount} is due in 7 days.' },
    { days: 0,  type: 'due',      msg: 'Your payment of {amount} is due today. Please arrange settlement.' },
    { days: 14, type: 'demand',   msg: 'FINAL DEMAND: Your account is 14 days overdue. Immediate payment of {amount} required.' },
    { days: 30, type: 'escalate', msg: 'ESCALATION: Your account is 30 days overdue. Legal action may be taken.' }
  ]

  const ruleStmt = db.prepare(`
    INSERT INTO collection_rules (id, business_id, name, days_overdue, action_type, message_template)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const r of rules) {
    ruleStmt.run(uuidv4(), bizId, `${r.days}d ${r.type}`, r.days, r.type, r.msg)
  }

  // Sample products
  const products = [
    { name: 'Widget A',   sku: 'WID-001', cat: 'Widgets',    cost: 10,  price: 25,  reorder: 50 },
    { name: 'Widget B',   sku: 'WID-002', cat: 'Widgets',    cost: 15,  price: 35,  reorder: 30 },
    { name: 'Gadget Pro', sku: 'GAD-001', cat: 'Gadgets',    cost: 50,  price: 120, reorder: 20 },
    { name: 'Service X',  sku: 'SRV-001', cat: 'Services',   cost: 0,   price: 200, reorder: 0  },
    { name: 'Part Alpha', sku: 'PRT-001', cat: 'Parts',      cost: 5,   price: 12,  reorder: 100 }
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
    invStmt.run(uuidv4(), bizId, pid, Math.floor(Math.random() * 200) + 20)
  }
}
