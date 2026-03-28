import * as XLSX from 'xlsx'

export function exportToExcel(sheets, filename = 'export') {
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const { name, headers, rows, totals } = sheet

    // Build data array
    const data = [headers]
    for (const row of rows) {
      data.push(headers.map(h => row[h.key] ?? ''))
    }

    if (totals) {
      data.push([]) // blank row
      data.push(headers.map(h => totals[h.key] ?? ''))
    }

    const ws = XLSX.utils.aoa_to_sheet(data)

    // Column widths
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.label?.length || 10, 14) }))

    // Style header row (bold)
    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C })
      if (!ws[addr]) ws[addr] = { v: '' }
      ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: '1E3A5F' } } }
    }

    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  }

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportSalesReport(orders, currency = 'USD') {
  exportToExcel([{
    name: 'Sales Report',
    headers: [
      { key: 'order_number', label: 'Order #' },
      { key: 'order_date',   label: 'Date' },
      { key: 'client_name',  label: 'Client' },
      { key: 'status',       label: 'Status' },
      { key: 'total_amount', label: `Total (${currency})` },
      { key: 'paid_amount',  label: `Paid (${currency})` },
      { key: 'balance',      label: `Balance (${currency})` }
    ],
    rows: orders.map(o => ({
      ...o,
      order_date: new Date(o.order_date).toLocaleDateString(),
      balance: (o.total_amount - o.paid_amount).toFixed(2),
      total_amount: Number(o.total_amount).toFixed(2),
      paid_amount: Number(o.paid_amount).toFixed(2)
    }))
  }], 'Sales_Report')
}

export function exportInventoryReport(items, currency = 'USD') {
  exportToExcel([{
    name: 'Inventory',
    headers: [
      { key: 'sku',          label: 'SKU' },
      { key: 'name',         label: 'Product' },
      { key: 'category',     label: 'Category' },
      { key: 'quantity_on_hand', label: 'On Hand' },
      { key: 'available_qty', label: 'Available' },
      { key: 'reorder_level', label: 'Reorder At' },
      { key: 'cost_price',   label: `Cost (${currency})` },
      { key: 'selling_price', label: `Price (${currency})` },
      { key: 'stock_value',  label: `Stock Value (${currency})` }
    ],
    rows: items.map(i => ({
      ...i,
      stock_value: (i.quantity_on_hand * i.cost_price).toFixed(2),
      cost_price: Number(i.cost_price).toFixed(2),
      selling_price: Number(i.selling_price).toFixed(2)
    }))
  }], 'Inventory_Report')
}

export function exportCreditsReport(credits, currency = 'USD') {
  exportToExcel([{
    name: 'Credits Ledger',
    headers: [
      { key: 'client_name',  label: 'Client' },
      { key: 'order_number', label: 'Order #' },
      { key: 'amount',       label: `Amount (${currency})` },
      { key: 'balance',      label: `Balance (${currency})` },
      { key: 'due_date',     label: 'Due Date' },
      { key: 'status',       label: 'Status' },
      { key: 'days_overdue', label: 'Days Overdue' }
    ],
    rows: credits.map(c => ({
      ...c,
      due_date: c.due_date ? new Date(c.due_date).toLocaleDateString() : '-',
      amount: Number(c.amount).toFixed(2),
      balance: Number(c.balance).toFixed(2),
      days_overdue: c.due_date ? Math.max(0, Math.round((new Date() - new Date(c.due_date)) / 86400000)) : 0
    }))
  }], 'Credits_Report')
}

export function exportClientLedger(client, ledger, currency = 'USD') {
  exportToExcel([{
    name: 'Client Ledger',
    headers: [
      { key: 'type',    label: 'Type' },
      { key: 'ref',     label: 'Reference' },
      { key: 'date',    label: 'Date' },
      { key: 'debit',   label: `Debit (${currency})` },
      { key: 'credit',  label: `Credit (${currency})` },
      { key: 'status',  label: 'Status' }
    ],
    rows: ledger.map(l => ({
      ...l,
      date: l.date ? new Date(l.date).toLocaleDateString() : '-',
      debit: Number(l.debit || 0).toFixed(2),
      credit: Number(l.credit || 0).toFixed(2)
    }))
  }], `Ledger_${client?.name?.replace(/\s+/g, '_') || 'Client'}`)
}
