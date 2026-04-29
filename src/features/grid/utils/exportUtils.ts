import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ExportSheet {
  name: string
  data: (string | number | boolean | null)[][]
}

export function exportToExcel(
  sheets: ExportSheet[],
  fileName: string = 'SheetForge Export'
): void {
  const workbook = XLSX.utils.book_new()

  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  })

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  saveAs(blob, `${fileName}.xlsx`)
}

export function exportToCSV(
  sheet: ExportSheet,
  fileName: string = 'SheetForge Export'
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(sheet.data)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `${fileName}.csv`)
}

export function exportToPDF(
  sheet: ExportSheet,
  fileName: string = 'SheetForge Export'
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text(sheet.name, 14, 15)

  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(`Exported from SheetForge - ${new Date().toLocaleDateString()}`, 14, 22)

  if (sheet.data.length === 0) {
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    doc.text('No data to export', 14, 35)
    doc.save(`${fileName}.pdf`)
    return
  }

  const firstRow = sheet.data[0] ?? []
  const headers = firstRow.map((header) => (header !== null ? String(header) : ''))
  const body = sheet.data
    .slice(1)
    .map((row) => row.map((cell) => (cell !== null ? String(cell) : '')))

  autoTable(doc, {
    head: [headers],
    body,
    startY: 28,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 14, right: 14 },
  })

  doc.save(`${fileName}.pdf`)
}
