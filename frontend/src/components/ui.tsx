import { AlertCircle, Check, CircleHelp, Minus, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Status, Truth } from '../types/simulation';

export const statusLabels: Record<Status, string> = { INCLUDED: '대상', EXCLUDED: '대상 아님', NEEDS_CLARIFICATION: '판단 필요', CONFLICT: '규칙 충돌' };
export const statusClass: Record<Status, string> = { INCLUDED: 'included', EXCLUDED: 'excluded', NEEDS_CLARIFICATION: 'clarification', CONFLICT: 'conflict' };
export const enumLabel = (value: string) => ({ FULL_TIME: '정규직', CONTRACT: '계약직', INTERN: '인턴', PART_TIME: '파트타임', VENDOR: '외부 인력', ACTIVE: '재직', ON_LEAVE: '휴직', TERMINATED: '퇴직', TEAM_LEAD: '팀장', DEPARTMENT_HEAD: '부서장', EXECUTIVE: '임원', IC: '일반 구성원', UNKNOWN: '정보 없음' })[value] ?? value;
export const fieldLabel = (value: string) => ({ hireDate: '입사일', employmentStatus: '재직 상태', employmentType: '고용 형태', contractEndDate: '계약 종료일', managerialLevel: '직책', name: '이름', department: '부서', positionTitle: '직무' })[value] ?? (value.startsWith('customFields.') ? value.slice(13) : value);
export const anchorLabel = (value: string) => ({ 'notice-date': '공지일 기준', 'application-deadline': '신청 마감일 기준' })[value] ?? '공지에 명시된 날짜 기준';
export const truthLabels: Record<Truth, string> = { TRUE: '조건 충족', FALSE: '조건 미충족', UNKNOWN: '판단 불가' };
export const findingLabels: Record<string, string> = { MISSING_REFERENCE: '기준일 누락', UNSPECIFIED_PRECEDENCE: '규칙 우선순위 불명확', MISSING_MEMBER_FIELD: '구성원 정보 누락', CONTRADICTORY_RULES: '규칙 충돌', RULE_AMBIGUITY: '모호한 조건', AMBIGUOUS_BOUNDARY: '경계 조건 불명확', MISSING_REQUIRED_FACT: '필수 정보 누락', OTHER: '확인 필요한 규칙' };
export const severityLabels = { HIGH: '중요도 높음', MEDIUM: '중요도 보통', LOW: '중요도 낮음' };
export const displayDate = (value: string) => value.replaceAll('-', '.');

export function StatusBadge({ status }: { status: Status }) {
  const Icon = status === 'INCLUDED' ? Check : status === 'EXCLUDED' ? Minus : status === 'CONFLICT' ? AlertCircle : CircleHelp;
  return <span className={`badge ${statusClass[status]}`}><Icon size={13} />{statusLabels[status]}</span>;
}
export function TruthMark({ value }: { value: Truth }) { return <span className={`truth ${value.toLowerCase()}`}>{value === 'TRUE' ? '✓' : value === 'FALSE' ? '−' : '?'} {truthLabels[value]}</span>; }
export function SectionTitle({ number, eyebrow, title, children }: { number: string; eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><div className="section-title"><span className="step-number">{number}</span><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div></div>{children}</div>;
}
export function Principle() { return <span className="principle"><ShieldCheck size={15} /><span><span className="principle-context">AI는 해석하고, 코드는 규칙대로 판정합니다.</span><span className="principle-technical">LLM compiles. Code decides.</span></span></span>; }
