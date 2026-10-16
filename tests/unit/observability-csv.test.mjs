import { describe, expect, it } from 'vitest';
import csvTools from '../../scripts/observability-csv.cjs';
const header =
  '#datatype,string,long,dateTime:RFC3339,double,string\n,result,table,_time,_value,name\n';
describe('native observability CSV evidence', () => {
  it('counts finite samples including zero without accepting empty aggregate windows', () => {
    const csv =
      header +
      ',_result,0,2026-10-04T12:00:00Z,,empty\n,_result,0,2026-10-04T12:00:10Z,0,"GET /tags, quoted"\n,_result,0,2026-10-04T12:00:20Z,1.2,"GET /articles, \"\"quoted\"\""\n';
    expect(csvTools.countNumericRows(csv)).toBe(2);
  });
  it('cannot certify a header or null-only table as measured data', () => {
    expect(csvTools.countNumericRows(header)).toBe(0);
    expect(csvTools.countNumericRows(header + ',_result,0,2026-10-04T12:00:00Z,,empty\n')).toBe(0);
  });
  it.each(['NaN', 'Infinity', 'a string'])('rejects malformed numeric sample %s', (value) => {
    expect(() =>
      csvTools.countNumericRows(header + `,_result,0,2026-10-04T12:00:00Z,${value},tag\n`),
    ).toThrow('Non-numeric');
  });
});
