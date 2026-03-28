import { contextBridge, ipcRenderer } from 'electron'

// Expose secure IPC bridge to renderer
contextBridge.exposeInMainWorld('api', {
  // Auth
  auth: {
    login: (data) => ipcRenderer.invoke('auth:login', data),
    listBusinesses: () => ipcRenderer.invoke('auth:list-businesses'),
    createBusiness: (data) => ipcRenderer.invoke('auth:create-business', data),
    changePassword: (data) => ipcRenderer.invoke('auth:change-password', data)
  },

  // Products
  products: {
    list: (params) => ipcRenderer.invoke('products:list', params),
    get: (params) => ipcRenderer.invoke('products:get', params),
    create: (params) => ipcRenderer.invoke('products:create', params),
    update: (params) => ipcRenderer.invoke('products:update', params),
    delete: (params) => ipcRenderer.invoke('products:delete', params),
    categories: (params) => ipcRenderer.invoke('products:categories', params)
  },

  // Inventory
  inventory: {
    list: (params) => ipcRenderer.invoke('inventory:list', params),
    adjust: (params) => ipcRenderer.invoke('inventory:adjust', params),
    movements: (params) => ipcRenderer.invoke('inventory:movements', params),
    lowStock: (params) => ipcRenderer.invoke('inventory:low-stock', params)
  },

  // Clients
  clients: {
    list: (params) => ipcRenderer.invoke('clients:list', params),
    get: (params) => ipcRenderer.invoke('clients:get', params),
    create: (params) => ipcRenderer.invoke('clients:create', params),
    update: (params) => ipcRenderer.invoke('clients:update', params),
    ledger: (params) => ipcRenderer.invoke('clients:ledger', params)
  },

  // Orders
  orders: {
    list: (params) => ipcRenderer.invoke('orders:list', params),
    get: (params) => ipcRenderer.invoke('orders:get', params),
    create: (params) => ipcRenderer.invoke('orders:create', params),
    updateStatus: (params) => ipcRenderer.invoke('orders:update-status', params),
    summary: (params) => ipcRenderer.invoke('orders:summary', params)
  },

  // Credits
  credits: {
    list: (params) => ipcRenderer.invoke('credits:list', params),
    recordPayment: (params) => ipcRenderer.invoke('credits:record-payment', params),
    overdue: (params) => ipcRenderer.invoke('credits:overdue', params),
    rules: {
      list: (params) => ipcRenderer.invoke('collection-rules:list', params),
      save: (params) => ipcRenderer.invoke('collection-rules:save', params)
    }
  },

  // Staff
  staff: {
    list: (params) => ipcRenderer.invoke('staff:list', params),
    create: (params) => ipcRenderer.invoke('staff:create', params),
    update: (params) => ipcRenderer.invoke('staff:update', params)
  },

  // Reports
  reports: {
    salesOverTime: (params) => ipcRenderer.invoke('reports:sales-over-time', params),
    topProducts: (params) => ipcRenderer.invoke('reports:top-products', params),
    topClients: (params) => ipcRenderer.invoke('reports:top-clients', params),
    categoryBreakdown: (params) => ipcRenderer.invoke('reports:category-breakdown', params)
  },

  // Settings
  settings: {
    get: (params) => ipcRenderer.invoke('settings:get', params),
    update: (params) => ipcRenderer.invoke('settings:update', params)
  },

  // Forecast
  forecast: {
    demand: (params) => ipcRenderer.invoke('forecast:demand', params),
    revenue: (params) => ipcRenderer.invoke('forecast:revenue', params)
  },

  // Notifications
  notifications: {
    list: (params) => ipcRenderer.invoke('notifications:list', params),
    markRead: (params) => ipcRenderer.invoke('notifications:mark-read', params),
    markAllRead: (params) => ipcRenderer.invoke('notifications:mark-all-read', params),
    generateCreditAlerts: (params) => ipcRenderer.invoke('notifications:generate-credit-alerts', params)
  },

  // System
  showNotification: (data) => ipcRenderer.send('show-notification', data)
})
