function fields(line) {
  const result = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      result.push(value);
      value = '';
    } else value += char;
  }
  if (quoted) throw new Error('Malformed observability CSV quoting');
  result.push(value);
  return result;
}

function countNumericRows(csv) {
  let valueIndex = -1;
  let count = 0;
  for (const line of csv.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const row = fields(line);
    if (row.includes('_value') && row.includes('table')) {
      valueIndex = row.indexOf('_value');
      continue;
    }
    if (valueIndex < 0 || !/^\d+$/.test(row[2] || '')) continue;
    const value = row[valueIndex];
    if (value === '') continue; // aggregateWindow emits empty windows too.
    if (value === undefined || !Number.isFinite(Number(value))) {
      throw new Error('Non-numeric observability sample');
    }
    count++;
  }
  return count;
}

module.exports = { countNumericRows };
