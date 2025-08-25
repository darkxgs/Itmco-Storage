import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import * as XLSX from 'xlsx-js-style'
import html2canvas from 'html2canvas'

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

export interface ExportData {
  id: number
  date: string
  productName: string
  category?: string
  partNumber?: string
  brand?: string
  model?: string
  customerName: string
  branch: string
  quantity: number
  engineer: string
  serialNumber?: string
  notes?: string
}

export interface ExportOptions {
  data: ExportData[]
  title?: string
  filename: string
  includeCharts?: boolean
  filters?: {
    startDate?: string
    endDate?: string
    branch?: string
    category?: string
    productName?: string
    engineer?: string
    customer?: string
  }
  summaryStats?: any
}

// Enhanced CSV Export
export function exportToCSV(options: ExportOptions): void {
  const { data, title = 'تقرير الإصدارات', filename, filters, summaryStats } = options
  const headers = [
    'رقم الإصدار',
    'التاريخ',
    'اسم المنتج',
    'الفئة',
    'رقم القطعة',
    'الماركة',
    'الموديل',
    'اسم العميل',
    'الفرع',
    'الكمية',
    'المهندس',
    'الرقم التسلسلي',
    'ملاحظات'
  ]

  const csvData = [
    headers,
    ...data.map(item => [
      item.id.toString(),
      new Date(item.date).toLocaleDateString('ar-SA'),
      item.productName || '',
      item.category || '',
      item.partNumber || '',
      item.brand || '',
      item.model || '',
      item.customerName || '',
      item.branch || '',
      item.quantity.toString(),
      item.engineer || '',
      item.serialNumber || '',
      item.notes || ''
    ])
  ]

  // Add filter information as header
  const filterInfo: string[] = []
  const safeFilters = filters || {}
  if (safeFilters.startDate) filterInfo.push(`من تاريخ: ${safeFilters.startDate}`)
  if (safeFilters.endDate) filterInfo.push(`إلى تاريخ: ${safeFilters.endDate}`)
  if (safeFilters.branch && safeFilters.branch !== 'all') filterInfo.push(`الفرع: ${safeFilters.branch}`)
  if (safeFilters.category && safeFilters.category !== 'all') filterInfo.push(`الفئة: ${safeFilters.category}`)
  if (safeFilters.productName) filterInfo.push(`المنتج: ${safeFilters.productName}`)
  if (safeFilters.engineer) filterInfo.push(`المهندس: ${safeFilters.engineer}`)
  if (safeFilters.customer) filterInfo.push(`العميل: ${safeFilters.customer}`)

  const finalCsvData = [
    [title],
    [`تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}`],
    [`عدد السجلات: ${data.length}`],
    ...(filterInfo.length > 0 ? [['الفلاتر المطبقة:'], ...filterInfo.map(f => [f])] : []),
    [''], // Empty row
    ...csvData
  ]

  const csvContent = finalCsvData
    .filter(row => Array.isArray(row))
    .map(row => row.map(cell => `"${cell || ''}"`).join(','))
    .join('\n')

  // Add BOM for proper Arabic encoding
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Enhanced PDF Export
export function exportToPDF(options: ExportOptions & { chartData?: any }): void {
  const { data, title = 'تقرير الإصدارات', filename, filters, summaryStats } = options

  // Build an offscreen HTML document to guarantee correct Arabic shaping
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '794px' // approximately A4 width in px at 96 DPI
  container.style.padding = '16px'
  container.style.background = '#ffffff'
  container.style.fontFamily = "'Tahoma','Segoe UI',Arial,sans-serif"
  container.style.direction = 'rtl'
  container.style.textAlign = 'right'
  container.style.color = '#111827' // ensure dark text color
  container.style.lineHeight = '1.4'

  const safeFilters = filters || {}

  // Header HTML
  const headerHtml = `
    <div style="text-align:center;margin-bottom:8px;">
      <div style="font-size:20px;font-weight:700">ITMCO - نظام إدارة المخزون</div>
      <div style="font-size:16px;margin-top:4px;">${title}</div>
    </div>
    <div style="font-size:12px;margin-bottom:8px;">
      <div>تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}</div>
      <div>عدد السجلات: ${data.length}</div>
    </div>
  `

  // Filters HTML
  let filtersHtml = ''
  if (safeFilters.startDate || safeFilters.endDate || safeFilters.branch || safeFilters.category || safeFilters.productName || safeFilters.engineer || safeFilters.customer) {
    const parts: string[] = []
    if (safeFilters.startDate) parts.push(`من تاريخ: ${safeFilters.startDate}`)
    if (safeFilters.endDate) parts.push(`إلى تاريخ: ${safeFilters.endDate}`)
    if (safeFilters.branch && safeFilters.branch !== 'all') parts.push(`الفرع: ${safeFilters.branch}`)
    if (safeFilters.category && safeFilters.category !== 'all') parts.push(`الفئة: ${safeFilters.category}`)
    if (safeFilters.productName) parts.push(`المنتج: ${safeFilters.productName}`)
    if (safeFilters.engineer) parts.push(`المهندس: ${safeFilters.engineer}`)
    if (safeFilters.customer) parts.push(`العميل: ${safeFilters.customer}`)

    filtersHtml = `
      <div style="font-size:12px;margin:8px 0;">
        <div style="font-weight:600;margin-bottom:4px;">الفلاتر المطبقة:</div>
        <div>${parts.map(p => `<span style='margin-left:12px'>• ${p}</span>`).join('')}</div>
      </div>
    `
  }

  // Table headers and rows
  const tableHeaders = [
    'رقم الإصدار',
    'التاريخ',
    'المنتج',
    'الفئة',
    'رقم القطعة',
    'الماركة',
    'العميل',
    'الفرع',
    'الكمية',
    'المهندس',
    'الرقم التسلسلي',
    'ملاحظات'
  ]

  const cellStyle = "style=\"border:1px solid #e5e7eb;padding:6px;color:#111827;vertical-align:middle;\""

  const rowsHtml = data.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td ${cellStyle}>${item.id ?? ''}</td>
      <td ${cellStyle}>${new Date(item.date).toLocaleDateString('ar-SA')}</td>
      <td ${cellStyle}>${item.productName ?? ''}</td>
      <td ${cellStyle}>${item.category ?? ''}</td>
      <td ${cellStyle}>${item.partNumber ?? ''}</td>
      <td ${cellStyle}>${item.brand ?? ''}</td>
      <td ${cellStyle}>${item.customerName ?? ''}</td>
      <td ${cellStyle}>${item.branch ?? ''}</td>
      <td ${cellStyle}>${item.quantity ?? ''}</td>
      <td ${cellStyle}>${item.engineer ?? ''}</td>
      <td ${cellStyle}>${item.serialNumber ?? ''}</td>
      <td ${cellStyle}>${item.notes ?? ''}</td>
    </tr>
  `).join('')

  const tableHtml = `
    <table style="width:100%;border-collapse:collapse;font-size:11px;border:1px solid #e5e7eb;table-layout:fixed;">
      <thead>
        <tr>
          ${tableHeaders.map(h => `<th style='border:1px solid #e5e7eb;background:#2563eb;color:#ffffff;padding:6px;text-align:center;'>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `

  container.innerHTML = headerHtml + filtersHtml + tableHtml
  document.body.appendChild(container)

  const runCapture = () => html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const imgWidth = pageWidth - 20
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 10

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight)
    heightLeft -= (pageHeight - 20)

    while (heightLeft > 0) {
      pdf.addPage()
      position = 10
      pdf.addImage(imgData, 'PNG', 10, position - (imgHeight - heightLeft), imgWidth, imgHeight)
      heightLeft -= (pageHeight - 20)
    }

    // Add page numbers footer
    const pageCount = pdf.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      // Use numbers-only to avoid glyph shaping issues with Arabic in jsPDF built-in fonts
      pdf.text(`${i} / ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    }

    pdf.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`)

    // Cleanup
    document.body.removeChild(container)
  }).catch(() => {
    // Cleanup on error as well
    if (container.parentElement) document.body.removeChild(container)
  })

  if ((document as any).fonts && (document as any).fonts.ready) {
    ;(document as any).fonts.ready.then(runCapture)
  } else {
    setTimeout(runCapture, 50)
  }
}

// Excel Export Function
export function exportToExcel(options: ExportOptions): void {
  const { data, title = 'تقرير الإصدارات', filename, filters } = options
  const safeFilters = filters || {}

  const workbook = XLSX.utils.book_new()

  const headerInfo = [
    ['ITMCO - نظام إدارة المخزون'],
    [title],
    [''],
    [`تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}`],
    [`عدد السجلات: ${data.length}`],
    ['']
  ]

  if (safeFilters.startDate || safeFilters.endDate || safeFilters.branch || safeFilters.category || safeFilters.productName || safeFilters.engineer || safeFilters.customer) {
    headerInfo.push(['الفلاتر المطبقة:'])
    if (safeFilters.startDate) headerInfo.push([`من تاريخ: ${safeFilters.startDate}`])
    if (safeFilters.endDate) headerInfo.push([`إلى تاريخ: ${safeFilters.endDate}`])
    if (safeFilters.branch && safeFilters.branch !== 'all') headerInfo.push([`الفرع: ${safeFilters.branch}`])
    if (safeFilters.category && safeFilters.category !== 'all') headerInfo.push([`الفئة: ${safeFilters.category}`])
    if (safeFilters.productName) headerInfo.push([`المنتج: ${safeFilters.productName}`])
    if (safeFilters.engineer) headerInfo.push([`المهندس: ${safeFilters.engineer}`])
    if (safeFilters.customer) headerInfo.push([`العميل: ${safeFilters.customer}`])
    headerInfo.push([''])
  }

  const tableHeaders = [
    'رقم الإصدار',
    'التاريخ',
    'المنتج',
    'الفئة',
    'رقم القطعة',
    'الماركة',
    'العميل',
    'الفرع',
    'الكمية',
    'المهندس',
    'الرقم التسلسلي',
    'ملاحظات'
  ]

  // Build rows
  const tableData = data.map(item => [
    item.id,
    new Date(item.date).toLocaleDateString('ar-SA'),
    item.productName || '',
    item.category || '',
    item.partNumber || '',
    item.brand || '',
    item.customerName || '',
    item.branch || '',
    item.quantity,
    item.engineer || '',
    item.serialNumber || '',
    item.notes || ''
  ])

  // Add left margin column (column A) for better visual spacing in RTL
  const headerInfoWithMargin = headerInfo.map(r => ['', ...r])
  const headersWithMargin = ['', ...tableHeaders]
  const tableDataWithMargin = tableData.map(r => ['', ...r])

  const worksheetData = [
    ...headerInfoWithMargin,
    headersWithMargin,
    ...tableDataWithMargin
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  // Force sheet Right-to-Left view for better Arabic UX
  ;(worksheet as any)['!sheetViews'] = [{ rightToLeft: true }]

  // Column widths (include margin col A)
  const columnWidths = [
    { wch: 3 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 30 }
  ]
  worksheet['!cols'] = columnWidths

  // Merge header rows across columns B..last
  const totalCols = tableHeaders.length + 1
  const lastCol = XLSX.utils.encode_col(totalCols - 1)
  worksheet['!merges'] = worksheet['!merges'] || []
  for (let r = 0; r < headerInfo.length; r++) {
    worksheet['!merges'].push({ s: { r, c: 1 }, e: { r, c: totalCols - 1 } })
  }
  
  // Freeze panes: keep margin col and header rows
  const freezeRows = headerInfo.length + 1
  ;(worksheet as any)['!freeze'] = { ySplit: freezeRows, xSplit: 1 }
  
  // Add auto filter across the data table (from column B)
  const headerRowIndex = headerInfo.length // zero-based index where headers row is placed
  const firstRowNumber = headerRowIndex + 1 // Excel row number (1-based)
  const lastRowNumber = headerInfo.length + 1 + tableData.length
  worksheet['!autofilter'] = { ref: `B${firstRowNumber}:${lastCol}${lastRowNumber}` }
  
  // Styling: header row (blue background, white bold text) and data borders
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FF2563EB' } },
    alignment: { horizontal: 'center', vertical: 'center' as const },
    border: {
      top: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { rgb: 'FFE5E7EB' } }
    }
  }

  const dataStyle = {
    alignment: { horizontal: 'center', vertical: 'center' as const },
    border: {
      top: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      left: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
      right: { style: 'thin', color: { rgb: 'FFE5E7EB' } }
    }
  }

  const zebraFill = (odd: boolean) => (odd ? undefined : { patternType: 'solid', fgColor: { rgb: 'FFF8FAFC' } })

  // Apply styles to header row B..last
  for (let c = 1; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIndex, c })
    if ((worksheet as any)[addr]) {
      ;(worksheet as any)[addr].s = headerStyle
    }
  }

  // Apply styles and zebra to data cells
  for (let r = headerRowIndex + 1; r < headerRowIndex + 1 + tableData.length; r++) {
    const isOdd = (r - (headerRowIndex + 1)) % 2 === 0
    for (let c = 1; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if ((worksheet as any)[addr]) {
        const base = (worksheet as any)[addr].s || {}
        ;(worksheet as any)[addr].s = { ...dataStyle, fill: zebraFill(isOdd), ...base }
      }
    }
  }

  // Add summary row for total quantity (consider margin col)
  const quantityColIndex = 9 // zero-based index including margin for 'الكمية'
  const summaryRowNumber = lastRowNumber + 1 // Excel 1-based row number
  const dataFirstRow = headerInfo.length + 2
  const quantityColLetter = XLSX.utils.encode_col(quantityColIndex)
  const sumRange = `${quantityColLetter}${dataFirstRow}:${quantityColLetter}${lastRowNumber}`
  const summaryLabelCell = XLSX.utils.encode_cell({ r: summaryRowNumber - 1, c: 1 })
  const summaryValueCell = XLSX.utils.encode_cell({ r: summaryRowNumber - 1, c: quantityColIndex })
  ;(worksheet as any)[summaryLabelCell] = { t: 's', v: 'إجمالي الكمية', s: { font: { bold: true }, alignment: { horizontal: 'right' } } }
  ;(worksheet as any)[summaryValueCell] = { t: 'n', f: `SUM(${sumRange})`, s: { font: { bold: true } } }
 
   XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير الإصدارات')
   XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// Summary statistics for reports
export function generateSummaryStats(data: ExportData[]) {
  const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0)
  const uniqueProducts = new Set(data.map(item => item.productName)).size
  const uniqueCustomers = new Set(data.map(item => item.customerName)).size
  const uniqueBranches = new Set(data.map(item => item.branch)).size
  
  // Top products
  const productFreq = data.reduce((acc: any, item) => {
    acc[item.productName] = (acc[item.productName] || 0) + item.quantity
    return acc
  }, {})
  
  const topProducts = Object.entries(productFreq)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))
  
  // Top branches
  const branchFreq = data.reduce((acc: any, item) => {
    acc[item.branch] = (acc[item.branch] || 0) + item.quantity
    return acc
  }, {})
  
  const topBranches = Object.entries(branchFreq)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))
  
  return {
    totalRecords: data.length,
    totalQuantity,
    uniqueProducts,
    uniqueCustomers,
    uniqueBranches,
    topProducts,
    topBranches
  }
}

// Validate export data
export function validateExportData(data: any[]): { isValid: boolean; errors: string[]; data: ExportData[] } {
  const errors: string[] = []
  
  if (!Array.isArray(data)) {
    errors.push('البيانات يجب أن تكون مصفوفة')
    return { isValid: false, errors, data: [] }
  }
  
  if (data.length === 0) {
    errors.push('لا توجد بيانات للتصدير')
    return { isValid: false, errors, data: [] }
  }
  
  const validatedData = data.map(item => ({
    id: item.id || 0,
    date: item.date || item.created_at || new Date().toISOString(),
    productName: item.productName || item.product_name || '',
    category: item.productDetails?.category || item.category || '',
    partNumber: item.productDetails?.partNumber || item.part_number || '',
    brand: item.productDetails?.brand || item.brand || '',
    model: item.productDetails?.model || item.model || '',
    customerName: item.customerName || item.customer_name || '',
    branch: item.branch || '',
    quantity: item.quantity || 0,
    engineer: item.engineer || '',
    serialNumber: item.serialNumber || item.serial_number || '',
    notes: item.notes || ''
  }))
  
  return { isValid: true, errors: [], data: validatedData }
}