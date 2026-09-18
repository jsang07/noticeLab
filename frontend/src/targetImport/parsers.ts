import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';
import type { RawTable, WorkbookTables } from './types';

function tableFromRows(name: string, input: unknown[][]): RawTable | null {
  if (/^(사용안내|instructions?|read ?me)$/i.test(name.trim())) return null;
  const rows = input.map(row => row.map(value => typeof value === 'string' ? value.trim() : value));
  const first = rows.findIndex(row => row.some(value => value !== null && value !== undefined && value !== ''));
  if (first < 0) return null;
  const headers = rows[first].map(value => String(value ?? '').trim());
  if (!headers.some(Boolean)) return null;
  const body = rows.slice(first + 1).filter(row => row.some(value => value !== null && value !== undefined && value !== ''));
  return { name, headers, rows: body };
}

export async function parseXlsx(file: File): Promise<WorkbookTables> {
  const sheets: RawTable[] = [];
  for (const sheet of await readXlsxFile(file)) {
    const table = tableFromRows(sheet.sheet, sheet.data);
    if (table) sheets.push(table);
  }
  if (!sheets.length) throw new Error('사용할 수 있는 시트가 없습니다. 첫 행에 헤더를 입력해 주세요.');
  return { sheets };
}

function parseDelimited(text: string, delimiter: ',' | '\t', name: string): RawTable {
  const result = Papa.parse<unknown[]>(text.replace(/^\uFEFF/, ''), { delimiter, skipEmptyLines: 'greedy' });
  if (result.errors.length) throw new Error(`표를 읽지 못했습니다: ${result.errors[0].message}`);
  const table = tableFromRows(name, result.data);
  if (!table) throw new Error('헤더와 데이터가 있는 표를 입력해 주세요.');
  return table;
}

export function parseCsv(text: string, name = 'CSV'): RawTable {
  return parseDelimited(text, ',', name);
}

export function parseTablePaste(text: string): RawTable {
  return parseDelimited(text, '\t', '붙여넣은 표');
}
