import { ArrowDown, Braces, GitBranch } from 'lucide-react';
import { conditions } from '../types/rules';
import type { Compilation, RuleNode } from '../types/rules';
import { RuleCard } from './RuleCard';
import { SectionTitle } from './ui';
import { UncertaintyCard } from './UncertaintyCard';
import type { Mode } from '../api/client';

function Tree({ node }: { node: RuleNode }) {
  if (node.kind === 'condition') return <RuleCard rule={node} />;
  return <div className={`rule-group ${node.kind}`}><div className="group-label"><GitBranch size={13} />{node.kind === 'all' ? '모두 충족' : '다음 중 하나 충족'}</div><div className="rule-children">{node.children.map((child, i) => <Tree key={child.kind === 'condition' ? child.id : i} node={child} />)}</div></div>;
}
export function CompilerPanel({ compilation, notice, mode }: { compilation: Compilation; notice: string; mode: Mode }) {
  const count = conditions(compilation.baselineEligibility).length + compilation.exceptions.flatMap(e => conditions(e.when)).length;
  return <section id="rules" className="stage enter"><SectionTitle number="02" eyebrow="공지 → 실행 가능한 규칙" title="공지 속 조건을 한눈에 확인하세요."><span className="outline-tag"><Braces size={14} />조건 {count}개</span></SectionTitle>
    <div className="interpretation-note">{mode === 'gemini' ? 'AI가 해석한 규칙입니다. 사용 전 확인해 주세요.' : '샘플 공지의 규칙 해석을 살펴보세요.'}<span>원문과 규칙을 함께 검토해 주세요.</span></div>
    <details className="source-details"><summary>원문 공지 보기 <ArrowDown size={14} /></summary><p className="preserve">{notice}</p></details>
    <Tree node={compilation.baselineEligibility} />
    {compilation.exceptions.map(exception => <div className="exception-group" key={exception.id}><div><span className="eyebrow">예외 규칙 · {exception.effect === 'INCLUDE' ? '포함' : '제외'}</span><p>{exception.sourceText}</p><span className={exception.precedence === 'UNSPECIFIED' ? 'badge clarification' : 'outline-tag'}>{{ UNSPECIFIED: '우선순위 불명확', OVERRIDE_BASELINE: '예외 규칙 우선', BASELINE_WINS: '기본 조건 우선' }[exception.precedence]}</span></div><Tree node={exception.when} /></div>)}
    {compilation.uncertainties.length > 0 && <details className="uncertainties"><summary>확인이 필요한 규칙 {compilation.uncertainties.length}개</summary>{compilation.uncertainties.map(u => <UncertaintyCard key={u.id} uncertainty={u} />)}</details>}
    {compilation.actions.length > 0 && <div className="actions-note"><strong>지원 대상자가 해야 할 일</strong>{compilation.actions.map(a => <p key={a.id}>{a.description}{a.deadlineAnchorId && <> · {compilation.anchors.find(x => x.id === a.deadlineAnchorId)?.value}</>}</p>)}</div>}
    <details className="json-details"><summary><Braces size={14} /> 검증된 Rule JSON 보기</summary><pre>{JSON.stringify(compilation, null, 2)}</pre></details>
  </section>;
}
