import { registerAuthHandlers } from './auth'
import { registerProductHandlers } from './products'
import { registerInventoryHandlers } from './inventory'
import { registerClientHandlers } from './clients'
import { registerOrderHandlers } from './orders'
import { registerCreditHandlers } from './credits'
import { registerStaffHandlers } from './staff'
import { registerReportHandlers } from './reports'
import { registerSettingsHandlers } from './settings'
import { registerForecastHandlers } from './forecast'
import { registerNotificationHandlers } from './notifications'

export function registerIpcHandlers(ipcMain) {
  registerAuthHandlers(ipcMain)
  registerProductHandlers(ipcMain)
  registerInventoryHandlers(ipcMain)
  registerClientHandlers(ipcMain)
  registerOrderHandlers(ipcMain)
  registerCreditHandlers(ipcMain)
  registerStaffHandlers(ipcMain)
  registerReportHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerForecastHandlers(ipcMain)
  registerNotificationHandlers(ipcMain)
}
