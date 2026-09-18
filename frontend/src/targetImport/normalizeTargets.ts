import type { EmploymentStatus, EmploymentType, ManagerialLevel, Member } from '../types/member';
import type { FieldDescriptor, FieldType, ImportedTargets, RawTable } from './types';

const canonical: Record<string, keyof Member> = {
  '이름': 'name', name: 'name', '소속': 'department', department: 'department', group: 'department', affiliation: 'department',
  '역할': 'positionTitle', '직책': 'positionTitle', role: 'positionTitle', position: 'positionTitle', title: 'positionTitle',
  '고용형태': 'employmentType', employmenttype: 'employmentType', '재직상태': 'employmentStatus', employmentstatus: 'employmentStatus',
  '입사일': 'hireDate', hiredate: 'hireDate', '계약종료일': 'contractEndDate', contractenddate: 'contractEndDate',
  '관리자구분': 'managerialLevel', manageriallevel: 'managerialLevel',
};
const dateFields = new Set(['hireDate', 'contractEndDate']);
const employmentTypes: Record<string, EmploymentType> = { '정규직': 'FULL_TIME', '계약직': 'CONTRACT', '인턴': 'INTERN', '파트타임': 'PART_TIME', '외부 인력': 'VENDOR' };
const employmentStatuses: Record<string, EmploymentStatus> = { '재직': 'ACTIVE', '휴직': 'ON_LEAVE', '퇴직': 'TERMINATED' };
const managerialLevels: Record<string, ManagerialLevel> = { '일반': 'IC', '팀장': 'TEAM_LEAD', '부서장': 'DEPARTMENT_HEAD', '임원': 'EXECUTIVE' };
const trueValues = new Set(['true', 'yes', 'y', '예', '네', '1']);
const falseValues = new Set(['false', 'no', 'n', '아니오', '아니요', '0']);

export function normalizeHeader(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear(); const m = String(value.getMonth() + 1).padStart(2, '0'); const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(text);
  if (!match) return null;
  const result = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  const date = new Date(`${result}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result ? null : result;
}

function infer(values: unknown[], label: string, field?: keyof Member): FieldType {
  const present = values.filter(value => value !== null && value !== undefined && String(value).trim() !== '');
  if (dateFields.has(String(field)) || (/일$/.test(label) && present.length && present.every(value => isoDate(value)))) return 'DATE';
  if (present.length && present.every(value => typeof value === 'number' || /^[-+]?\d+(?:\.\d+)?$/.test(String(value).trim()))) return 'NUMBER';
  if (present.length && present.every(value => trueValues.has(String(value).trim().toLowerCase()) || falseValues.has(String(value).trim().toLowerCase()))) return 'BOOLEAN';
  return 'STRING';
}

function typed(value: unknown, type: FieldType): unknown {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (type === 'DATE') return isoDate(value) ?? String(value).trim();
  if (type === 'NUMBER') return typeof value === 'number' ? value : Number(String(value).trim());
  if (type === 'BOOLEAN') return trueValues.has(String(value).trim().toLowerCase());
  return String(value).trim();
}

function normalizedEnum<T extends string>(value: unknown, values: Record<string, T>, fallback: T): T {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const text = String(value).trim();
  return values[text] ?? (Object.values(values).includes(text as T) ? text as T : fallback);
}

export function normalizeTargets(table: RawTable): ImportedTargets {
  const headers = table.headers.map(normalizeHeader);
  if (!headers.some(Boolean)) throw new Error('첫 번째 행에 열 이름을 입력해 주세요.');
  const columns = headers.map((label, index) => {
    if (!label) return null;
    const field = canonical[label.toLowerCase()];
    const type = infer(table.rows.map(row => row[index]), label, field);
    return { index, label, field, type, path: field ?? `customFields.${label}` };
  }).filter(Boolean) as { index: number; label: string; field?: keyof Member; type: FieldType; path: string }[];
  const fields: FieldDescriptor[] = columns.map(({ label, type, path }) => ({ field: path, label, type }));
  const warnings: string[] = [];
  const members = table.rows.map((row, rowIndex): Member => {
    const values = Object.fromEntries(columns.map(column => [column.path, typed(row[column.index], column.type)]));
    const customFields = Object.fromEntries(columns.filter(column => !column.field).map(column => [column.label, values[column.path]]).filter(([, value]) => value !== null));
    const name = typeof values.name === 'string' && values.name ? values.name : `대상자 ${String(rowIndex + 1).padStart(3, '0')}`;
    if (!values.name) warnings.push(`${rowIndex + 2}행: 이름이 없어 “${name}”으로 표시합니다.`);
    return {
      id: `M${String(rowIndex + 1).padStart(3, '0')}`, name,
      department: typeof values.department === 'string' ? values.department : null,
      positionTitle: typeof values.positionTitle === 'string' ? values.positionTitle : null,
      employmentType: normalizedEnum(values.employmentType, employmentTypes, 'UNKNOWN'),
      employmentStatus: normalizedEnum(values.employmentStatus, employmentStatuses, 'UNKNOWN'),
      hireDate: typeof values.hireDate === 'string' && isoDate(values.hireDate) ? values.hireDate : null,
      contractEndDate: typeof values.contractEndDate === 'string' && isoDate(values.contractEndDate) ? values.contractEndDate : null,
      managerialLevel: normalizedEnum(values.managerialLevel, managerialLevels, 'UNKNOWN'),
      customFields, fieldMeta: Object.fromEntries(columns.map(column => [column.path, { source: column.field ? 'NORMALIZED' : 'EXPLICIT', confidence: 'HIGH' }])) as Member['fieldMeta'],
    };
  });
  if (!members.length) throw new Error('헤더 아래에 대상자 데이터를 한 행 이상 입력해 주세요.');
  const previewRows = members.map(member => Object.fromEntries(columns.map(column => {
    const value = column.field ? member[column.field] : member.customFields[column.label];
    return [column.label, value === 'UNKNOWN' ? null : value];
  })));
  return { sourceName: table.name, members, fields, previewRows, warnings };
}
