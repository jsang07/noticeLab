export type EmploymentType = 'FULL_TIME' | 'CONTRACT' | 'INTERN' | 'PART_TIME' | 'VENDOR' | 'UNKNOWN';
export type EmploymentStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'UNKNOWN';
export type ManagerialLevel = 'IC' | 'TEAM_LEAD' | 'DEPARTMENT_HEAD' | 'EXECUTIVE' | 'UNKNOWN';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export interface Member {
  id: string; name: string; department: string | null; positionTitle: string | null;
  employmentType: EmploymentType; employmentStatus: EmploymentStatus;
  hireDate: string | null; contractEndDate: string | null; managerialLevel: ManagerialLevel;
  customFields: Record<string, unknown>;
  fieldMeta: Record<string, { source: 'EXPLICIT' | 'NORMALIZED' | 'DERIVED' | 'UNKNOWN'; confidence: Confidence }>;
}
