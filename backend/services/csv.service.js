// ============================================
// Servicio de CSV — Exportación de Datos
// ============================================

class CsvService {
  /**
   * Genera un string en formato CSV a partir de headers y filas.
   * @param {Array<string>} headers - Títulos de las columnas
   * @param {Array<object>} rows - Filas con llaves que coinciden con los headers (o valores directos)
   * @returns {string}
   */
  generateCsv(headers, rows) {
    const headerRow = headers.join(',') + '\n';
    
    const bodyRows = rows.map(row => {
      return Object.values(row).map(val => {
        if (val === null || val === undefined) return '';
        
        let stringVal = String(val);
        // Escapar comillas dobles y envolver si tiene comas o saltos de línea
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
          stringVal = `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      }).join(',');
    }).join('\n');

    return '\uFEFF' + headerRow + bodyRows; // Añadir BOM para soporte de acentos en Excel
  }
}

export default new CsvService();
