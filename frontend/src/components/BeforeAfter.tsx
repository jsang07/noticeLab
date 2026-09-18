import { ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import type { Compilation } from '../types/rules';
import type { Simulation } from '../types/simulation';
import { Principle } from './ui';

export function BeforeAfter({ before, after, compilation, onReset }: { before: Simulation; after: Simulation; compilation: Compilation; onReset: () => void }) {
  const clean = !compilation.uncertainties.length && !after.findings.length && !after.summary.needsClarification && !after.summary.conflict && after.personaResults.every(r => r.status === 'INCLUDED' || r.status === 'EXCLUDED');
  const rows = [['included', '대상'], ['excluded', '대상 아님'], ['needsClarification', '판단 필요'], ['conflict', '규칙 충돌']] as const;
  return <section id="comparison" className="comparison enter"><div className="eyebrow">같은 사람, 같은 테스트. 더 명확해진 공지.</div><h2>{clean ? '이제 누구에게 보내야 할지 명확합니다.' : '재검증 결과, 이렇게 달라졌습니다.'}</h2>
    <div className="comparison-grid"><div><span className="comparison-label">수정 전</span>{rows.map(([key, label]) => <div className="compare-row" key={key}><span>{label}</span><strong>{before.summary[key]}</strong></div>)}</div><ArrowRight className="compare-arrow" size={25} /><div><span className="comparison-label">수정 후</span>{rows.map(([key, label]) => <div className="compare-row" key={key}><span>{label}</span><strong>{after.summary[key]}</strong></div>)}</div></div>
    <div className="comparison-footer"><span className="badge included"><CheckCircle2 size={14} />{clean ? '미해결 규칙 0개' : `확인이 필요한 문제 ${after.findings.length}개`}</span><h3>{clean ? `전체 ${after.summary.total}명 대신 실제 대상 ${after.summary.included}명에게 보내세요.` : '발송 전에 남아 있는 문제를 확인해 주세요.'}</h3><p>원문 수정 → 새 규칙 변환 → 동일한 구성원 {after.summary.total}명 · 테스트 {after.personas.length}개 재실행</p><Principle /><button className="text-button" onClick={onReset}><RotateCcw size={14} />새 공지 테스트</button></div>
  </section>;
}
