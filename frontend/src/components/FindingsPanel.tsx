import { useState } from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react';
import type { Finding } from '../types/simulation';
import type { Member } from '../types/member';
import { findingLabels, SectionTitle, severityLabels } from './ui';

export function FindingsPanel({ findings, members, busy, onFix, fixed, fixture }: { findings: Finding[]; members: Member[]; busy: boolean; onFix: () => void; fixed: boolean; fixture: boolean }) {
  const [all, setAll] = useState(false);
  return <section id="findings" className="stage enter"><SectionTitle number="04" eyebrow="발송 전에 발견한 문제" title={findings.length ? '이 부분만 명확해지면 됩니다.' : '미해결 문제가 없습니다.'}><span className="outline-tag">발견한 문제 {findings.length}개</span></SectionTitle>
    {findings.length > 0 ? <><div className="findings-list">{findings.slice(0, all ? findings.length : 3).map((finding, i) => <article className="finding card" key={finding.id}><span className="finding-index">0{i + 1}</span><div className="finding-content"><div className="finding-meta"><span className="badge clarification">{findingLabels[finding.type] ?? '확인 필요한 규칙'}</span><span className="small muted">{severityLabels[finding.severity]}</span></div><h3>{finding.title}</h3><p>{finding.question}</p><div className="finding-people"><span>영향받는 구성원 {finding.affectedMemberIds.length}명{finding.affectedMemberIds.length > 0 && ` · ${finding.affectedMemberIds.map(id => members.find(member => member.id === id)?.name ?? id).join(', ')}`}</span>{finding.affectedPersonaIds.length > 0 && <span>경계 테스트 {finding.affectedPersonaIds.length}개에서도 확인</span>}</div></div></article>)}</div>
      {findings.length > 3 && <button className="text-button" onClick={() => setAll(!all)}>{all ? '접기' : `문제 ${findings.length}개 전체 보기`}</button>}
      {!fixed && <div className="fix-cta"><div><h3>애매한 부분을 명확하게 고쳐볼까요?</h3><p>{fixture ? '샘플 수정문에 같은 사람과 테스트를 적용해 차이를 확인합니다.' : 'AI가 공지를 수정하고, 새로 변환한 규칙으로 같은 테스트를 다시 실행합니다.'}</p><span className="small muted">수정안은 검토용 제안입니다. 정책 선택이 의도와 맞는지 확인해 주세요.</span></div><button className="button primary" onClick={onFix} disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}공지 수정 후 재검증<ArrowRight size={17} /></button></div>}</>
      : <div className="clean-findings"><CheckCircle2 size={22} /><p>변환된 규칙과 시뮬레이션에서 미해결 문제를 발견하지 못했습니다.</p></div>}
  </section>;
}
