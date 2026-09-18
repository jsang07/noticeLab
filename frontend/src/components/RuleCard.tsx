import { AlertTriangle, Braces, CalendarDays, Users } from 'lucide-react';
import type { Condition } from '../types/rules';
import { anchorLabel, displayDate, enumLabel, fieldLabel } from './ui';

const operators: Record<string, string> = { EQ: '=', NEQ: '제외', LTE: '≤', LT: '<', GTE: '≥', GT: '>', IN: '다음 중 하나', NOT_IN: '다음 제외', IS_NULL: '정보 없음', IS_NOT_NULL: '정보 있음' };
export function RuleCard({ rule }: { rule: Condition }) {
  const relative = rule.value.kind === 'relative_date';
  const unresolved = relative && rule.value.kind === 'relative_date' && rule.value.base.kind === 'unresolved_reference';
  const Icon = rule.field.includes('Date') ? CalendarDays : rule.field.startsWith('employment') || rule.field === 'managerialLevel' ? Users : Braces;
  const label = fieldLabel(rule.field);
  const value = rule.value.kind === 'literal' ? (Array.isArray(rule.value.value) ? rule.value.value.map(item => enumLabel(String(item))).join(' / ') : rule.value.type === 'date' ? displayDate(String(rule.value.value)) : enumLabel(String(rule.value.value ?? '')))
    : `기준일 + ${rule.value.offset.months}개월${rule.value.offset.days ? ` + ${rule.value.offset.days}일` : ''}`;
  return <article className={`rule-card ${unresolved || rule.requiresConfirmation ? 'rule-warning' : ''}`}>
    <div className="rule-label"><Icon size={15} />{label}</div><h3>{operators[rule.operator]} {value}</h3>
    {relative && <span className="small muted">{rule.value.kind === 'relative_date' && rule.value.base.kind === 'anchor_reference' ? anchorLabel(rule.value.base.anchorId) : '기준일이 명시되지 않음'}</span>}
    <blockquote>“{rule.sourceText}”</blockquote>
    <div className="rule-footer"><code>{rule.id}</code>{(unresolved || rule.requiresConfirmation) && <span className="warning-text"><AlertTriangle size={12} />확인 필요</span>}</div>
  </article>;
}
