import type { Member } from '../types/member';
import type { MemberResult } from '../types/simulation';
import { anchorLabel, displayDate, enumLabel, fieldLabel, StatusBadge, TruthMark, truthLabels } from './ui';

export function PersonaCard({ member, result, label }: { member: Member; result: MemberResult; label?: string }) {
  const relevant = result.evaluations.filter(e => result.decisiveRuleIds.includes(e.ruleId)).sort((a, b) => Number(b.candidates.length > 0) - Number(a.candidates.length > 0));
  const explanation = result.reasonCodes.includes('MISSING_REFERENCE') ? '기준일에 따라 대상 여부가 달라집니다.' : result.status === 'CONFLICT' ? '포함 규칙과 제외 규칙이 서로 충돌합니다.' : result.summary;
  return <article className="persona-card card"><div className="persona-top"><span className="avatar">{member.name.slice(0, 1)}</span><div><h3>{member.name}</h3><span className="small muted">{enumLabel(member.employmentType)}{member.managerialLevel !== 'IC' && ` · ${enumLabel(member.managerialLevel)}`}</span>{member.contractEndDate && <span className="small muted">계약 종료 {displayDate(member.contractEndDate)}</span>}</div></div>
    {label && <p className="persona-label">{label}</p>}
    <div className="evaluation-list">{(relevant.length ? relevant : result.evaluations).slice(0, 4).map(e => <div key={e.ruleId}>
      <div className="evaluation"><span>{fieldLabel(e.field)}</span><TruthMark value={e.result} /></div>
      {e.candidates.map(c => <div className="candidate" key={c.anchorId}><span>{anchorLabel(c.anchorId)}<small>판정 경계일 {displayDate(c.threshold)}</small></span><TruthMark value={c.result} /></div>)}
    </div>)}</div><StatusBadge status={result.status} /><p className="result-explanation">{explanation}</p>
    <details className="trace"><summary>판정 근거 자세히 보기</summary><p><strong>왜 이렇게 판정됐나요?</strong></p><p>{result.summary}</p><p>구성원 ID: {member.id} · 기본 조건: {truthLabels[result.baselineResult]}{result.applicableExceptionIds.length > 0 && ` · 적용된 예외: ${result.applicableExceptionIds.join(', ')}`}</p>{result.evaluations.map(e => <div className="trace-row" key={e.ruleId}><span>{e.sourceText}<small>실제 값: {String(e.actual ?? '정보 없음')} · {e.field} {e.operator} · {e.ruleId}{!result.decisiveRuleIds.includes(e.ruleId) && ' · 최종 판정에 영향 없음'}</small>{e.candidates.map(c => <small key={c.anchorId}>{c.anchorId} · {c.threshold} · {truthLabels[c.result]}</small>)}</span><TruthMark value={e.result} /></div>)}</details>
  </article>;
}
