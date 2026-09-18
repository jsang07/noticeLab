import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import type { Member } from '../types/member';
import type { Simulation } from '../types/simulation';
import { PersonaCard } from './PersonaCard';
import { SectionTitle } from './ui';

export function PersonaSimulation({ simulation, members }: { simulation: Simulation; members: Member[] }) {
  const [all, setAll] = useState(false);
  const interesting = [...simulation.memberResults].sort((a, b) => ({ NEEDS_CLARIFICATION: 0, CONFLICT: 1, INCLUDED: 2, EXCLUDED: 3 })[a.status] - ({ NEEDS_CLARIFICATION: 0, CONFLICT: 1, INCLUDED: 2, EXCLUDED: 3 })[b.status]);
  const representative = [interesting[0], interesting.find(r => r.status === 'CONFLICT') ?? interesting.find(r => r.status === 'EXCLUDED'), interesting.find(r => r.status === 'INCLUDED')].filter((r, i, list) => r && list.findIndex(x => x?.memberId === r.memberId) === i);
  return <section className="stage enter" id="simulation"><SectionTitle number="03" eyebrow="규칙 → 사람 시뮬레이션" title="조건의 경계에 있는 사람들입니다."><span className="outline-tag"><FlaskConical size={14} />동일 규칙으로 재현 가능한 실행</span></SectionTitle>
    <p className="section-description">같은 규칙, 다른 상황. 날짜 기준과 예외가 실제 판정을 어떻게 바꾸는지 확인하세요.</p>
    <div className="persona-grid">{representative.map(r => r && <PersonaCard key={r.memberId} member={members.find(m => m.id === r.memberId)!} result={r} />)}</div>
    {simulation.personas.length > 0 && <div className="boundary-suite"><div className="subheading"><div><h3>자동 생성 경계 테스트 <span className="count">{simulation.personas.length}</span></h3><p className="small muted">규칙에서 생성한 테스트 · 재검증 시 동일한 입력을 재사용합니다.</p></div><button className="text-button" onClick={() => setAll(!all)}>{all ? '접기' : '테스트 전체 보기'} →</button></div>
      <div className="persona-grid">{simulation.personas.slice(0, all ? 12 : 3).map(p => <PersonaCard key={p.id} label={p.label} member={p.member} result={simulation.personaResults.find(r => r.memberId === p.id)!} />)}</div></div>}
  </section>;
}
