import jsPDF from 'jspdf'
import 'jspdf-autotable'
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
  warrantyType?: string
  invoiceNumber?: string
  itemCode?: string
  warehouseId?: number
  warehouseName?: string
  purchasePrice?: number
  sellingPrice?: number
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
  const headers = TABLE_HEADERS

  const csvData = [
    headers,
    ...data.map(mapRowForStrings)
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
export function exportToPDF(options: ExportOptions & { chartData?: any; groupBy?: 'category' | 'branch' | 'none'; includeCharts?: boolean; pageSize?: number }): void {
  const { data, title = 'تقرير الإصدارات', filename, filters, summaryStats, groupBy = 'none', includeCharts = false, pageSize = 50 } = options

  // Build an offscreen HTML document to guarantee correct Arabic shaping
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '0'
  container.style.width = '794px' // approximately A4 width in px at 96 DPI
  container.style.padding = '20mm' // إضافة حدود للصفحة
  container.style.background = '#ffffff'
  container.style.fontFamily = "'Cairo','Amiri','Tahoma','Segoe UI',Arial,sans-serif" // Enhanced Arabic fonts
  container.style.direction = 'rtl'
  container.style.textAlign = 'right'
  container.style.color = '#1f2937' // Enhanced dark text color
  container.style.lineHeight = '1.5' // زيادة المسافة بين الصفوف

  const safeFilters = filters || {}

  // Generate enhanced summary statistics
  const stats = generateSummaryStats(data)
  
  // Generate simple charts if requested
  let chartsHtml = ''
  if (includeCharts && stats.topProducts.length > 0) {
    const maxCount = Math.max(...stats.topProducts.slice(0, 5).map(p => p.count))
    const productChartBars = stats.topProducts.slice(0, 5).map(product => {
      const percentage = (product.count / maxCount) * 100
      return `
        <div style="margin:5px 0;">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">
            <span>${product.name}</span>
            <span>${product.count}</span>
          </div>
          <div style="background:#e5e7eb;height:12px;border-radius:6px;overflow:hidden;">
            <div style="background:linear-gradient(90deg, #3b82f6, #1d4ed8);height:100%;width:${percentage}%;transition:width 0.3s;"></div>
          </div>
        </div>
      `
    }).join('')
    
    chartsHtml = `
      <div style="background:#f8fafc;padding:15px;margin:15px 0;border-radius:8px;border:1px solid #e2e8f0;">
        <h3 style="margin:0 0 10px 0;font-size:14px;color:#1f2937;text-align:center;">أكثر المنتجات مبيعاً</h3>
        ${productChartBars}
      </div>
    `
  }
  
  // Header HTML with enhanced styling
  const headerHtml = `
    <div style="text-align:center;margin-bottom:12px;background:linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);color:white;padding:16px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <div style="font-size:22px;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,0.3);">ITMCO - نظام إدارة المخزون</div>
      <div style="font-size:16px;margin-top:6px;opacity:0.95;">${title}</div>
    </div>
    <div style="font-size:11px;margin-bottom:12px;background:#f8fafc;padding:8px;border-radius:4px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span><strong>تاريخ التصدير:</strong> ${new Date().toLocaleDateString('ar-SA')}</span>
        <span><strong>عدد السجلات:</strong> ${stats.totalRecords}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span><strong>إجمالي الكمية:</strong> ${stats.totalQuantity}</span>
        <span><strong>عدد المنتجات المختلفة:</strong> ${stats.uniqueProducts}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span><strong>عدد العملاء:</strong> ${stats.uniqueCustomers}</span>
        <span><strong>عدد الفروع:</strong> ${stats.uniqueBranches}</span>
      </div>
      ${stats.topProducts.length > 0 ? `
        <div style="margin-top:6px;">
          <strong>أكثر منتج مبيعاً:</strong> ${stats.topProducts[0].name} (${stats.topProducts[0].count} قطعة)
        </div>
      ` : ''}
      ${stats.topBranches.length > 0 ? `
        <div style="margin-top:4px;">
          <strong>أكثر فرع نشاطاً:</strong> ${stats.topBranches[0].name} (${stats.topBranches[0].count} قطعة)
        </div>
      ` : ''}
    </div>
    ${chartsHtml}
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

  // Group data if requested
  let processedData = data
  let groupedSections: { title: string; data: ExportData[] }[] = []
  
  if (groupBy === 'category') {
    const grouped = data.reduce((acc, item) => {
      const key = item.category || 'غير محدد'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {} as Record<string, ExportData[]>)
    
    groupedSections = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b, 'ar'))
      .map(([category, items]) => ({ title: `الفئة: ${category}`, data: items }))
  } else if (groupBy === 'branch') {
    const grouped = data.reduce((acc, item) => {
      const key = item.branch || 'غير محدد'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    }, {} as Record<string, ExportData[]>)
    
    groupedSections = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b, 'ar'))
      .map(([branch, items]) => ({ title: `الفرع: ${branch}`, data: items }))
  }
  
  // Check if price columns have meaningful data
  const hasPurchasePrices = data.some(item => item.purchasePrice && item.purchasePrice > 0)
  const hasSellingPrices = data.some(item => item.sellingPrice && item.sellingPrice > 0)
  
  // Filter headers and create dynamic table structure
  const filteredHeaders = TABLE_HEADERS.filter((header, index) => {
    if (header === 'سعر الشراء' && !hasPurchasePrices) return false
    if (header === 'سعر البيع' && !hasSellingPrices) return false
    return true
  })
  
  const cellStyle = "style=\"border:1px solid #e5e7eb;padding:6px;color:#111827;vertical-align:middle;\""

  // Generate table content (grouped or ungrouped) with pagination
   let tableContent = ''
   
   if (groupedSections.length > 0) {
     // Grouped table content with page breaks
     tableContent = groupedSections.map((section, sectionIdx) => {
       const sectionRows = section.data.map((item, idx) => {
         const globalIdx = sectionIdx * pageSize + idx
         const needsPageBreak = globalIdx > 0 && globalIdx % pageSize === 0
         const cells = [
           `<td ${cellStyle}>${item.id ?? ''}</td>`,
           `<td ${cellStyle}>${new Date(item.date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</td>`,
           `<td ${cellStyle}>${item.productName ?? ''}</td>`,
           `<td ${cellStyle}>${item.customerName ?? ''}</td>`,
           `<td ${cellStyle}>${item.branch ?? ''}</td>`,
           `<td ${cellStyle}>${item.quantity ?? ''}</td>`,
           `<td ${cellStyle}>${item.engineer ?? ''}</td>`,
           `<td ${cellStyle}>${item.category ?? ''}</td>`,
           `<td ${cellStyle}>${item.itemCode ?? ''}</td>`,
           `<td ${cellStyle}>${item.partNumber ?? ''}</td>`,
           `<td ${cellStyle}>${item.brand ?? ''}</td>`,
           `<td ${cellStyle}>${item.warehouseName ?? ''}</td>`,
           `<td ${cellStyle}>${item.serialNumber ?? ''}</td>`,
           `<td ${cellStyle}>${item.warrantyType ?? ''}</td>`,
           `<td ${cellStyle}>${item.invoiceNumber ?? ''}</td>`
         ]
         
         if (hasPurchasePrices) {
           const formattedPurchase = item.purchasePrice ? `${Number(item.purchasePrice).toLocaleString('ar-SA')} ريال` : ''
           cells.push(`<td ${cellStyle}>${formattedPurchase}</td>`)
         }
         if (hasSellingPrices) {
           const formattedSelling = item.sellingPrice ? `${Number(item.sellingPrice).toLocaleString('ar-SA')} ريال` : ''
           cells.push(`<td ${cellStyle}>${formattedSelling}</td>`)
         }
         
         cells.push(`<td ${cellStyle}>${item.notes ?? ''}</td>`)
         
         const rowClass = needsPageBreak ? 'page-break avoid-break' : 'avoid-break'
         return `<tr class="${rowClass}" style="background:${idx % 2 === 0 ? '#ffffff' : '#f1f5f9'};">${cells.join('')}</tr>`
       }).join('')
       
       const sectionHeader = sectionIdx > 0 && sectionIdx % 3 === 0 ? 
         `<tr class="page-break"><td colspan="${filteredHeaders.length}" style="background:#e0f2fe;padding:8px;font-weight:bold;text-align:center;border:1px solid #e5e7eb;">${section.title} (${section.data.length} عنصر)</td></tr>` :
         `<tr><td colspan="${filteredHeaders.length}" style="background:#e0f2fe;padding:8px;font-weight:bold;text-align:center;border:1px solid #e5e7eb;">${section.title} (${section.data.length} عنصر)</td></tr>`
       
       return `
         ${sectionHeader}
         ${sectionRows}
       `
     }).join('')
   } else {
     // Regular ungrouped content with pagination
      const chunks = []
      for (let i = 0; i < data.length; i += pageSize) {
        chunks.push(data.slice(i, i + pageSize))
      }
      
      tableContent = chunks.map((chunk, chunkIdx) => {
        const chunkRows = chunk.map((item, idx) => {
          const globalIdx = chunkIdx * pageSize + idx
       const cells = [
         `<td ${cellStyle}>${item.id ?? ''}</td>`,
         `<td ${cellStyle}>${new Date(item.date).toLocaleDateString('en-GB')}</td>`,
         `<td ${cellStyle}>${item.productName ?? ''}</td>`,
         `<td ${cellStyle}>${item.customerName ?? ''}</td>`,
         `<td ${cellStyle}>${item.branch ?? ''}</td>`,
         `<td ${cellStyle}>${item.quantity ?? ''}</td>`,
         `<td ${cellStyle}>${item.engineer ?? ''}</td>`,
         `<td ${cellStyle}>${item.category ?? ''}</td>`,
         `<td ${cellStyle}>${item.itemCode ?? ''}</td>`,
         `<td ${cellStyle}>${item.partNumber ?? ''}</td>`,
         `<td ${cellStyle}>${item.brand ?? ''}</td>`,
         `<td ${cellStyle}>${item.warehouseName ?? ''}</td>`,
         `<td ${cellStyle}>${item.serialNumber ?? ''}</td>`,
         `<td ${cellStyle}>${item.warrantyType ?? ''}</td>`,
         `<td ${cellStyle}>${item.invoiceNumber ?? ''}</td>`
       ]
      
      // Add price columns only if they have data (with Arabic formatting)
       if (hasPurchasePrices) {
         const formattedPurchase = item.purchasePrice ? `${Number(item.purchasePrice).toLocaleString('ar-SA')} ريال` : ''
         cells.push(`<td ${cellStyle}>${formattedPurchase}</td>`)
       }
       if (hasSellingPrices) {
         const formattedSelling = item.sellingPrice ? `${Number(item.sellingPrice).toLocaleString('ar-SA')} ريال` : ''
         cells.push(`<td ${cellStyle}>${formattedSelling}</td>`)
       }
      
      cells.push(`<td ${cellStyle}>${item.notes ?? ''}</td>`)
      
      const rowClass = chunkIdx > 0 && idx === 0 ? 'page-break avoid-break' : 'avoid-break'
          return `<tr class="${rowClass}" style="background:${globalIdx % 2 === 0 ? '#ffffff' : '#f1f5f9'};">${cells.join('')}</tr>`
        }).join('')
        
        return chunkRows
      }).join('')
    }

  const tableHtml = `
    <style>
      @media print {
      thead { display: table-header-group; }
      tbody { display: table-row-group; }
      tr { page-break-inside: avoid; }
      th { page-break-after: avoid; }
      .page-break { page-break-before: always; }
      .avoid-break { page-break-inside: avoid; }
      table { page-break-inside: auto; }
    }
    </style>
    <table style="width:100%;border-collapse:collapse;font-size:9px;border:1px solid #e5e7eb;table-layout:fixed;line-height:1.4;">
      <thead style="display:table-header-group;">
        <tr>
          ${filteredHeaders.map(h => `<th style='border:1px solid #e5e7eb;background:linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);color:#ffffff;padding:10px;text-align:center;font-weight:bold;page-break-after:avoid;text-shadow:0 1px 2px rgba(0,0,0,0.2);'>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody style="display:table-row-group;">
        ${tableContent}
      </tbody>
    </table>
  `

  // Footer HTML
  const footerHtml = `
    <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280;text-align:center;">
      <div>تم التصدير بواسطة نظام إدارة المخزون – ITMCO</div>
      <div style="margin-top:4px;">تاريخ الإنشاء: ${new Date().toLocaleString('ar-SA')}</div>
    </div>
  `

  container.innerHTML = headerHtml + filtersHtml + tableHtml + footerHtml
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
// Shared headers and row-mapping used by CSV, PDF and Excel exports
// Enhanced table headers with priority ordering (most important first)
const TABLE_HEADERS = [
  'رقم الإصدار',
  'التاريخ',
  'المنتج',
  'العميل',
  'الفرع',
  'الكمية',
  'المهندس',
  'الفئة',
  'كود المنتج',
  'رقم القطعة',
  'الماركة',
  'المخزن',
  'الرقم التسلسلي',
  'نوع الضمان',
  'رقم الفاتورة',
  'سعر الشراء',
  'سعر البيع',
  'ملاحظات'
] as const

// Enhanced mapping with priority ordering and Arabic formatting
const mapRowForStrings = (item: ExportData): string[] => [
  `${item.id ?? ''}`,
  new Date(item.date).toLocaleDateString('en-GB'), // تاريخ ميلادي
  item.productName ?? '',
  item.customerName ?? '',
  item.branch ?? '',
  `${item.quantity ?? ''}`,
  item.engineer ?? '',
  item.category ?? '',
  item.itemCode ?? '',
  item.partNumber ?? '',
  item.brand ?? '',
  item.warehouseName ?? '',
  item.serialNumber ?? '',
  item.warrantyType ?? '',
  item.invoiceNumber ?? '',
  item.purchasePrice ? `${Number(item.purchasePrice).toLocaleString('ar-SA')} ريال` : '',
  item.sellingPrice ? `${Number(item.sellingPrice).toLocaleString('ar-SA')} ريال` : '',
  item.notes ?? ''
]

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

  const tableHeaders = TABLE_HEADERS

  // removed local mapRowForStrings (now shared at top-level)

  // Build rows - الترتيب الصحيح حسب الهيدر
  const tableData = data.map(item => [
    item.id,
    new Date(item.date).toLocaleDateString('en-GB'), // تاريخ ميلادي
    item.productName || '',
    item.customerName || '',
    item.branch || '',
    item.quantity,
    item.engineer || '',
    item.category || '',
    item.itemCode || '',
    item.partNumber || '',
    item.brand || '',
    item.warehouseName || '',
    item.serialNumber || '',
    item.warrantyType || '',
    item.invoiceNumber || '',
    item.purchasePrice || '',
    item.sellingPrice || '',
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
    { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 20 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 30 }
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
  // Ensure header row height for readability
  ;(worksheet as any)['!rows'] = (worksheet as any)['!rows'] || []
  ;(worksheet as any)['!rows'][headerRowIndex] = { hpt: 24 }

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
    alignment: { horizontal: 'center', vertical: 'center' as const, wrapText: true },
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
  const quantityColIndex = 11 // zero-based index including margin for 'الكمية'
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
    itemCode: item.itemCode || item.item_code || '',
    partNumber: item.productDetails?.partNumber || item.part_number || '',
    brand: item.productDetails?.brand || item.brand || '',
    model: item.productDetails?.model || item.model || '',
    customerName: item.customerName || item.customer_name || '',
    branch: item.branch || '',
    warehouseId: item.warehouseId || item.warehouse_id || 0,
    warehouseName: item.warehouseName || item.warehouse_name || '',
    quantity: item.quantity || 0,
    engineer: item.engineer || '',
    serialNumber: item.serialNumber || item.serial_number || '',
    warrantyType: item.warrantyType || item.warranty_type || '',
    invoiceNumber: item.invoiceNumber || item.invoice_number || '',
    purchasePrice: item.purchasePrice || item.purchase_price || 0,
    sellingPrice: item.sellingPrice || item.selling_price || 0,
    notes: item.notes || ''
  }))
  
  return { isValid: true, errors: [], data: validatedData }
}