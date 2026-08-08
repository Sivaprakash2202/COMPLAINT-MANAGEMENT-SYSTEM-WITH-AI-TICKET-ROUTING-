export function downloadCSV(data: any[], filename: string) {
  if (!data || !data.length) {
    console.warn("No data provided to export.");
    return;
  }

  // Create headers from the first object
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add headers row
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      // Stringify and escape quotes for CSV
      const stringVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val || '');
      const escaped = stringVal.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  // Create Blob and trigger download
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
