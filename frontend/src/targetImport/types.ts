import type { Member } from '../types/member';

export type TargetSource = 'NONE' | 'SAMPLE' | 'CUSTOM';
export type FieldType = 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN';

export interface FieldDescriptor {
  field: string;
  label: string;
  type: FieldType;
}

export interface RawTable {
  name: string;
  headers: string[];
  rows: unknown[][];
}

export interface ImportedTargets {
  sourceName: string;
  members: Member[];
  fields: FieldDescriptor[];
  previewRows: Record<string, unknown>[];
  warnings: string[];
}

export interface WorkbookTables {
  sheets: RawTable[];
}
