# SalesFlow Pro 🚀

A professional macOS sales management application built with Electron, React, and SQLite.

![SalesFlow Pro](https://img.shields.io/badge/Platform-macOS-blue) ![Version](https://img.shields.io/badge/Version-1.0.0-green) ![Offline](https://img.shields.io/badge/Works-Offline-orange)

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Analytics Dashboard** | Real-time KPIs, revenue charts, top products/clients |
| 📦 **Inventory Tracking** | Live stock levels, reorder alerts, adjustment history |
| 🛒 **Sales & Orders** | Full order lifecycle with multi-item support |
| 💳 **Credit Management** | Outstanding balances, due-date reminders, payment tracking |
| 📋 **Client Ledger** | Full debit/credit history per client |
| 🔮 **Demand Forecasting** | 30-day demand & 3-month revenue predictions |
| 👥 **Staff Accounts** | Role-based access with granular permissions |
| 🏢 **Multi-Business** | Support for multiple independent businesses |
| 🔔 **Smart Notifications** | Automated credit alerts and debt collection rules |
| 📁 **Excel Export** | Export all reports to formatted .xlsx files |
| 🔒 **Offline-First** | Fully functional without internet connection |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- macOS (for DMG build)

### Development
```bash
npm install
npm run dev
```

### Build DMG
```bash
npm run dist:mac
```

The DMG will be output to `dist/`

## 🏗 Architecture

```
salesflow-pro/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.js       # App entry point
│   │   ├── database.js    # SQLite schema & seeding
│   │   └── ipc/           # All IPC handlers (auth, orders, etc.)
│   ├── preload/
│   │   └── index.js       # Secure IPC bridge
│   └── renderer/
│       └── src/
│           ├── pages/     # React page components
│           ├── components/ # Shared UI components
│           ├── utils/     # Formatters, Excel export
│           └── styles/    # Global CSS design system
├── .github/workflows/
│   └── build.yml          # Automated macOS DMG builder
└── resources/             # App icons
```

## 🔑 Default Login

After first run:
- **Business:** My Business (auto-selected)
- **Username:** `admin`
- **Password:** `admin123`

## 🤖 Auto-Build (GitHub Actions)

Push a tag to trigger automatic DMG build:
```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build universal DMG (x64 + arm64) and attach to the release.

## 📋 Permissions System

| Role | Access |
|---|---|
| `admin` | Full access to all features |
| `manager` | Configurable per-module access |
| `staff` | Restricted to permitted modules only |

## 🗄 Database

SQLite stored in `~/Library/Application Support/salesflow-pro/data/salesflow.db`

Fully offline — no cloud required.

## 📦 Tech Stack

- **Frontend:** React 18, React Router, Recharts
- **Backend:** Electron 29, Node.js
- **Database:** SQLite via better-sqlite3
- **Build:** electron-builder, electron-vite
- **Export:** SheetJS (xlsx)
- **Auth:** bcryptjs

## License

MIT © SalesFlow Pro
