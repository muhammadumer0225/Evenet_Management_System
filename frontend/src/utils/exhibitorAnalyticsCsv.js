const safeCsvValue = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  // Prevent spreadsheet formula execution when a text field starts with a formula marker.
  const safe = /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function buildExhibitorAnalyticsCsv(analytics = {}) {
  const summary = analytics.summary || {};
  const rows = [
    ['Record type', 'Expo', 'Booth', 'Status', 'Date', 'Visits', 'Unique attendees'],
    ['Summary', '', '', '', '', summary.totalVisits || 0, summary.uniqueAttendees || 0],
  ];

  for (const booth of analytics.booths || []) {
    rows.push([
      'Booth',
      booth.expo?.title || 'Expo',
      booth.boothNumber || '',
      booth.status || '',
      '',
      booth.visits || 0,
      booth.uniqueVisitors || 0,
    ]);
  }

  for (const day of analytics.dailyVisits || []) {
    rows.push([
      'Daily',
      '',
      '',
      '',
      day.date || '',
      day.visits || 0,
      day.uniqueVisitors || 0,
    ]);
  }

  return `\uFEFF${rows.map((row) => row.map(safeCsvValue).join(',')).join('\r\n')}`;
}
