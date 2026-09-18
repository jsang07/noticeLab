import { useState } from 'react';
import { Users, X } from 'lucide-react';
import type { Member } from '../types/member';
import type { Simulation, Status } from '../types/simulation';
import { statusLabels, statusClass, StatusBadge } from './ui';
import { PersonaCard } from './PersonaCard';
import type { TargetSource } from '../targetImport/types';

export function BlastRadius({ simulation, members, source }: { simulation: Simulation; members: Member[]; source: TargetSource }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | null>(null);
  const summary = simulation.summary;
  const selectedResult = simulation.memberResults.find(r => r.memberId === selected);
  const sourceLabel = source === 'SAMPLE' ? '샘플 조직' : source === 'CUSTOM' ? '내 대상자 데이터' : '대상자 없음';
  const visible = simulation.memberResults.filter(r => !filter || r.status === filter).slice(0, 120);
  return <div className="blast card"><div className="subheading"><div><div className="eyebrow">영향 범위</div><h2>이 공지, 실제로 누구에게 필요한가요?</h2><p className="muted">발송 전 미리 보는 대상자 분포 · 사람을 클릭하면 판정 근거가 열립니다.</p></div><span className="outline-tag"><Users size={15} />{sourceLabel} · {summary.total}명</span></div>
    <div className="stats">{([['INCLUDED', summary.included], ['EXCLUDED', summary.excluded], ['NEEDS_CLARIFICATION', summary.needsClarification], ['CONFLICT', summary.conflict]] as [Status, number][]).map(([status, count]) => <button key={status} className={`stat ${statusClass[status]} ${filter === status ? 'selected' : ''}`} onClick={() => setFilter(filter === status ? null : status)} aria-pressed={filter === status}><strong>{count}</strong><span>{statusLabels[status]}</span></button>)}</div>
    {summary.total === 0 ? <div className="blast-empty"><Users size={22} /><strong>대상자 데이터 없이 실행했습니다.</strong><p>자동 생성된 경계 테스트와 Findings에서 공지의 모호한 조건을 확인하세요.</p></div> : <div className="people-grid">{visible.map(r => { const member = members.find(m => m.id === r.memberId); return member ? <button key={r.memberId} className={`person-tile ${statusClass[r.status]} ${selected === r.memberId ? 'selected' : ''}`} aria-label={`${member.name}: ${statusLabels[r.status]}`} aria-pressed={selected === r.memberId} onClick={() => setSelected(selected === r.memberId ? null : r.memberId)}><span className="person-avatar">{member.name.slice(0, 1)}</span><strong>{member.name}</strong><span className="small">{member.department}</span><StatusBadge status={r.status} /></button> : null; })}</div>}
    {summary.total > 120 && <p className="large-data-note">화면에는 처음 120명만 표시합니다. 위 요약 수치는 전체 {summary.total.toLocaleString()}명의 결과입니다.</p>}
    {filter && <button className="text-button" onClick={() => setFilter(null)}>전체 보기 · {summary.total}명</button>}
    {selectedResult && members.find(m => m.id === selected) && <div className="selected-member"><button className="icon-button" aria-label="구성원 상세 닫기" onClick={() => setSelected(null)}><X size={18} /></button><PersonaCard member={members.find(m => m.id === selected)!} result={selectedResult} /></div>}
    <div className="blast-note"><span className="status-dot" />{summary.needsClarification + summary.conflict > 0 ? `${summary.needsClarification + summary.conflict}명은 아직 판정할 수 없습니다. 발송 전에 규칙 확인이 필요합니다.` : '모든 구성원의 판정이 확정되었습니다.'}</div>
  </div>;
}
