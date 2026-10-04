import { DispenseLog, UserProfile } from '../types';

export function exportLogsToCsv(logs: DispenseLog[], user?: UserProfile | null) {
  const headers = [
    'Timestamp',
    'Date',
    'Time',
    'Medication Name',
    'Pills Dispensed',
    'Chamber / Bottle',
    'Dispense Method',
    'Status',
    'Active Ingredients',
    'Clinical Notes',
  ];

  const rows = logs.map((log) => {
    const d = new Date(log.timestamp);
    const dateStr = d.toLocaleDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bottle = log.chamberId && log.chamberId > 0 ? `Bottle ${log.chamberId}` : 'External / Manual';
    const ingredients = (log.activeIngredients || [])
      .map((i) => `${i.name} (${i.amountMg}mg)`)
      .join('; ');
    const safeNotes = (log.notes || '').replace(/"/g, '""');

    return [
      `"${log.timestamp}"`,
      `"${dateStr}"`,
      `"${timeStr}"`,
      `"${log.medicationName.replace(/"/g, '""')}"`,
      log.pillsDispensed ?? 1,
      `"${bottle}"`,
      `"${log.dispensedBy}"`,
      `"${log.status}"`,
      `"${ingredients}"`,
      `"${safeNotes}"`,
    ].join(',');
  });

  const patientHeader = user ? `# Patient: ${user.name} (${user.email})\n# Generated: ${new Date().toISOString()}\n` : '';
  const csvContent = patientHeader + [headers.join(','), ...rows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `heartware-medication-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function printClinicalReport(logs: DispenseLog[], user?: UserProfile | null) {
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) return;

  const totalDoses = logs.length;
  const totalPills = logs.reduce((sum, l) => sum + (l.pillsDispensed || 1), 0);
  const uniqueMeds = Array.from(new Set(logs.map((l) => l.medicationName))).join(', ') || 'None';

  const rowsHtml = logs
    .map((l) => {
      const d = new Date(l.timestamp);
      const ingredients = (l.activeIngredients || []).map((i) => `${i.name} ${i.amountMg}mg`).join(', ');
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5ea; font-size: 13px;">
            ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5ea; font-weight: 600; font-size: 13px;">
            ${l.medicationName}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5ea; text-align: center; font-size: 13px;">
            ${l.pillsDispensed || 1}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5ea; font-size: 12px; color: #555;">
            ${ingredients || '—'}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5ea; font-size: 12px;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #e8f5e9; color: #2e7d32; font-weight: 500;">
              ${l.status === 'success' ? 'Confirmed' : l.status}
            </span>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e5ea; font-size: 12px; color: #666;">
            ${l.notes || '—'}
          </td>
        </tr>
      `;
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Heartware Clinical Medication Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1c1c1e; }
          h1 { margin-bottom: 4px; font-size: 24px; }
          .header-meta { color: #666; font-size: 13px; margin-bottom: 24px; border-bottom: 1px solid #ccc; padding-bottom: 16px; }
          .summary-card { background: #f2f2f7; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; display: flex; gap: 32px; }
          .summary-item { font-size: 13px; }
          .summary-val { font-size: 18px; font-weight: bold; color: #000000; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { text-align: left; padding: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ccc; color: #555; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #000000; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
            Print / Save as PDF
          </button>
        </div>
        <h1>Heartware Clinical Intake Summary</h1>
        <div class="header-meta">
          <strong>Patient:</strong> ${user?.name || 'Local Patient'} &nbsp;|&nbsp;
          <strong>Record Period:</strong> Up to ${new Date().toLocaleDateString()} &nbsp;|&nbsp;
          <strong>Generated on:</strong> ${new Date().toLocaleString()}
        </div>

        <div class="summary-card">
          <div class="summary-item">
            <div>Total Doses Logged</div>
            <div class="summary-val">${totalDoses}</div>
          </div>
          <div class="summary-item">
            <div>Total Pills Taken</div>
            <div class="summary-val">${totalPills}</div>
          </div>
          <div class="summary-item">
            <div>Active Medications</div>
            <div style="font-weight: 600; margin-top: 2px;">${uniqueMeds}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Medication</th>
              <th style="text-align: center;">Dose (Pills)</th>
              <th>Active Ingredients</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="padding: 16px; text-align: center; color: #999;">No logs recorded.</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 32px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 12px;">
          Generated automatically by Heartware Dispenser PWA · Safe adherence record.
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
}
