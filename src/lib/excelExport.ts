import * as XLSX from 'xlsx';

/**
 * Export arbitrary JSON data array to an Excel file (.xlsx) and trigger download in browser
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  fileName: string,
  sheetName: string = 'Rekap SPPG'
): void {
  if (!data || data.length === 0) {
    alert('Tidak ada data untuk diekspor ke Excel.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate file name with .xlsx extension
  const safeFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, safeFileName);
}

/**
 * Parse uploaded Excel or CSV file from browser input and return array of objects
 */
export function parseExcelFile<T = any>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<T>(worksheet, { defval: '' });
        resolve(jsonData);
      } catch (err) {
        reject(new Error('Gagal membaca format file Excel. Pastikan format .xlsx atau .csv valid.'));
      }
    };

    reader.onerror = (err) => {
      reject(err);
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Download a clean template Excel file with header columns
 */
export function downloadExcelTemplate(
  columns: { header: string; example: string | number }[],
  fileName: string,
  sheetName: string = 'Template'
): void {
  const sampleObj: Record<string, any> = {};
  columns.forEach(col => {
    sampleObj[col.header] = col.example;
  });

  const worksheet = XLSX.utils.json_to_sheet([sampleObj]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, safeFileName);
}
