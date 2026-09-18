import type { Member } from './member';
export type Truth = 'TRUE' | 'FALSE' | 'UNKNOWN';
export type Status = 'INCLUDED' | 'EXCLUDED' | 'NEEDS_CLARIFICATION' | 'CONFLICT';
export interface Evaluation { ruleId: string; sourceText: string; field: string; operator: string; actual: unknown; expected: unknown; result: Truth; reasonCodes: string[]; candidates: { anchorId: string; threshold: string; result: Truth }[] }
export interface MemberResult { memberId: string; status: Status; baselineResult: Truth; reasonCodes: string[]; summary: string; evaluations: Evaluation[]; decisiveRuleIds: string[]; applicableExceptionIds: string[] }
export interface Persona { id: string; label: string; member: Member; generatedFromRuleIds: string[] }
export interface Finding { id: string; type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; question: string; affectedRuleIds: string[]; affectedMemberIds: string[]; affectedPersonaIds: string[] }
export interface Summary { total: number; included: number; excluded: number; needsClarification: number; conflict: number }
export interface Simulation { memberResults: MemberResult[]; personas: Persona[]; personaResults: MemberResult[]; findings: Finding[]; summary: Summary }
export interface FixResponse { revisedNotice: string; changes: { findingId: string; description: string }[] }
