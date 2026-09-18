import { useEffect, useReducer, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Braces, Check, FileCheck2, FileText, FlaskConical, LoaderCircle, ShieldCheck, Users, X } from 'lucide-react';
import { api } from '../api/client';
import type { Demo, Mode, Notice } from '../api/client';
import type { Compilation } from '../types/rules';
import type { Simulation, FixResponse } from '../types/simulation';
import { NoticeInput } from '../components/NoticeInput';
import { CompilerPanel } from '../components/CompilerPanel';
import { PersonaSimulation } from '../components/PersonaSimulation';
import { BlastRadius } from '../components/BlastRadius';
import { FindingsPanel } from '../components/FindingsPanel';
import { FixNoticePanel } from '../components/FixNoticePanel';
import { BeforeAfter } from '../components/BeforeAfter';
import { Principle } from '../components/ui';
import { enableDevMode, localToday } from '../config';
import type { Member } from '../types/member';
import { TargetDataSelector } from '../components/TargetDataSelector';
import type { FieldDescriptor, ImportedTargets, TargetSource } from '../targetImport/types';

type Phase = 'IDLE' | 'LOADING_DEMO' | 'COMPILING' | 'COMPILED' | 'SIMULATING' | 'RESULT' | 'FIXING' | 'RETESTING' | 'RETESTED' | 'ERROR';
interface State { phase: Phase; compilation?: Compilation; before?: Simulation; after?: Simulation; afterCompilation?: Compilation; fix?: FixResponse; error?: string; runNotice?: Notice; runMode?: Mode; runMembers?: Member[]; runFields?: FieldDescriptor[]; runSource?: TargetSource }
type Action = { type: 'RESET' } | { type: 'UPDATE'; payload: Partial<State> };
const initial: State = { phase: 'IDLE' };
function reducer(state: State, action: Action): State { return action.type === 'RESET' ? initial : { ...state, ...action.payload }; }
const emptyNotice = (): Notice => ({ title: '', text: '', noticeDate: localToday(), timezone: 'Asia/Seoul' });
const busyPhases: Phase[] = ['LOADING_DEMO', 'COMPILING', 'COMPILED', 'SIMULATING', 'FIXING', 'RETESTING'];
const phaseCopy: Partial<Record<Phase, string>> = { LOADING_DEMO: '샘플 조직을 불러오고 있습니다…', COMPILING: '공지의 문장을 규칙으로 바꾸고 있습니다…', COMPILED: '규칙 변환 완료. 테스트를 준비합니다…', SIMULATING: '구성원마다 규칙을 적용하고 있습니다…', FIXING: '애매한 조건을 명확하게 수정하고 있습니다…', RETESTING: '수정문을 새 규칙으로 변환해 같은 사람들에게 다시 적용합니다…' };

export function HomePage() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [notice, setNotice] = useState<Notice>(emptyNotice);
  const [demo, setDemo] = useState<Demo>();
  const [mode, setMode] = useState<Mode>('fixture');
  const [targetSource, setTargetSource] = useState<TargetSource>('NONE');
  const [importedTargets, setImportedTargets] = useState<ImportedTargets>();
  const modeSelected = useRef(false);
  const sampleLoaded = useRef(false);
  const lock = useRef(false);
  const busy = busyPhases.includes(state.phase);
  useEffect(() => { let active = true; api.demo().then(data => { if (active) { setDemo(data); if (!modeSelected.current) setMode(data.capabilities.geminiConfigured ? 'gemini' : 'fixture'); } }).catch(() => {}); return () => { active = false; }; }, []);
  const fail = (error: unknown) => dispatch({ type: 'UPDATE', payload: { phase: 'ERROR', error: error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.' } });
  async function run(sample: boolean) {
    if (lock.current) return; lock.current = true;
    dispatch({ type: 'RESET' });
    try {
      dispatch({ type: 'UPDATE', payload: { phase: 'LOADING_DEMO' } });
      const data = await api.demo(); setDemo(data);
      const input = sample ? data.notice : notice;
      const source: TargetSource = sample ? 'SAMPLE' : targetSource;
      if (source === 'CUSTOM' && !importedTargets) throw new Error('대상자 파일을 업로드하거나 표를 붙여넣어 주세요.');
      const selectedMembers = source === 'SAMPLE' ? data.members : source === 'CUSTOM' ? importedTargets!.members : [];
      const runMembers = selectedMembers.map(member => ({ ...member, customFields: { ...member.customFields }, fieldMeta: { ...member.fieldMeta } }));
      const runFields = source === 'CUSTOM' ? importedTargets!.fields : [];
      const runMode = enableDevMode && modeSelected.current ? mode : data.capabilities.geminiConfigured ? 'gemini' : 'fixture';
      setMode(runMode);
      if (sample) { setNotice(input); setTargetSource('SAMPLE'); sampleLoaded.current = true; }
      dispatch({ type: 'UPDATE', payload: { phase: 'COMPILING', runNotice: input, runMode, runMembers, runFields, runSource: source } });
      const { compilation } = await api.compile(input, runMode, runFields);
      dispatch({ type: 'UPDATE', payload: { phase: 'COMPILED', compilation } });
      dispatch({ type: 'UPDATE', payload: { phase: 'SIMULATING' } });
      const before = await api.simulate(compilation, runMembers);
      dispatch({ type: 'UPDATE', payload: { phase: 'RESULT', before } });
      setTimeout(() => document.getElementById('rules')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (error) { fail(error); } finally { lock.current = false; }
  }
  async function fix() {
    if (lock.current || !state.before || !state.compilation || !state.runNotice || !state.runMembers) return;
    lock.current = true;
    try {
      dispatch({ type: 'UPDATE', payload: { phase: 'FIXING', error: undefined } });
      const fixed = state.fix ?? await api.fix(state.runNotice.text, state.compilation, state.before.findings, state.runMode!);
      dispatch({ type: 'UPDATE', payload: { phase: 'RETESTING', fix: fixed } });
      const { compilation } = await api.compile({ ...state.runNotice, text: fixed.revisedNotice }, state.runMode!, state.runFields);
      const after = await api.simulate(compilation, state.runMembers, state.before.personas);
      dispatch({ type: 'UPDATE', payload: { phase: 'RETESTED', after, afterCompilation: compilation } });
      setTimeout(() => document.getElementById('comparison')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } catch (error) { fail(error); } finally { lock.current = false; }
  }
  function reset() { dispatch({ type: 'RESET' }); setNotice(emptyNotice()); setTargetSource('NONE'); sampleLoaded.current = false; window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function changeNotice(value: Notice) {
    const editingSampleText = sampleLoaded.current && value.text !== notice.text;
    setNotice(editingSampleText ? { ...value, noticeDate: localToday() } : value);
    if (editingSampleText) setTargetSource('NONE');
    sampleLoaded.current = false;
    dispatch({ type: 'RESET' });
  }
  const current = state.after ?? state.before;
  const currentCompilation = state.afterCompilation ?? state.compilation;
  const currentNotice = state.after ? state.fix!.revisedNotice : state.runNotice?.text;
  const step = state.after ? 4 : state.before ? 3 : state.compilation ? 2 : 1;
  const runMembers = state.runMembers ?? [];
  return <><header className="header"><div className="header-inner"><a href="#" className="brand" onClick={e => { e.preventDefault(); if (!busy) reset(); }}><span className="brand-icon"><FileCheck2 size={22} /></span>Notice Lab<span className="beta">BETA</span></a><nav><a href="#notice-input">공지 테스트</a><a href="#how-it-works">작동 방식</a></nav><Principle /></div></header>
    <main><section className="hero"><div className="hero-copy"><div className="hero-kicker"><span className="status-dot" />발송 전, 공지의 빈틈을 확인하세요</div><h1>Don't send it <span>yet.</span></h1><p className="hero-subtitle">사람에게 보내기 전에, AI 사람들에게 먼저 테스트하세요.</p><p className="hero-korean">공지문을 실행 가능한 규칙으로 바꾸고,<br className="desktop-break" /> 경계 사례와 구성원을 미리 시뮬레이션해 발송 전 문제를 찾습니다.</p><div className="hero-chips"><span><Check size={13} />조직 데이터 없이 체험</span><span><Check size={13} />같은 조건, 같은 결과</span></div></div>
      <div className="hero-diagram" aria-label="공지에서 규칙으로, 규칙에서 사람 시뮬레이션으로"><div className="diagram-grid" /><div className="diagram-notice"><FileText size={21} /><span>한 장의 공지</span><div className="fake-line" /><div className="fake-line short" /></div><div className="diagram-arrow"><ArrowRight size={22} /></div><div className="diagram-rules"><span className="tiny-label">규칙 변환</span><div><Braces size={15} />실행 가능한 규칙</div><code>조건 충족 → 대상</code><span className="diagram-pass"><Check size={12} />규칙대로 판정</span></div><div className="diagram-people"><span><Users size={16} />발송 전 사람 시뮬레이션</span><div>{['green', 'green', 'amber', 'green', 'red', 'gray'].map((c, i) => <div key={i} className={`mini-person ${c}`}><span /><i /></div>)}</div></div><span className="diagram-caption">“저도 대상인가요?”라는 질문이 오기 전에.</span></div>
    </section>
    <div className="workflow" id="how-it-works">{[{ label: '공지 입력', icon: FileText }, { label: '규칙 변환', icon: Braces }, { label: '시뮬레이션', icon: FlaskConical }, { label: '수정·검증', icon: ShieldCheck }].map(({ label, icon: Icon }, i) => <div className={step >= i + 1 ? 'active' : ''} key={label}><span><Icon size={17} /></span><strong>0{i + 1}</strong>{label}{i < 3 && <ArrowRight className="workflow-arrow" size={15} />}</div>)}</div>
    <section className="input-layout"><NoticeInput notice={notice} mode={mode} busy={busy} liveAvailable={demo?.capabilities.geminiConfigured ?? false} targetControl={<TargetDataSelector source={targetSource} imported={importedTargets} disabled={busy} onSource={value => { setTargetSource(value); dispatch({ type: 'RESET' }); }} onImport={value => { setImportedTargets(value); setTargetSource('CUSTOM'); dispatch({ type: 'RESET' }); }} />} onChange={changeNotice} onMode={value => { modeSelected.current = true; setMode(value); dispatch({ type: 'RESET' }); }} onSample={() => void run(true)} onRun={() => void run(false)} />
      <aside className="guide"><div className="eyebrow">작은 테스트로, 더 명확한 공지</div><h2>내게 명확한 공지,<br />모두에게도 그럴까요?</h2><p>입사일 하루 차이, 계약기간의 기준일,<br />그리고 “팀장 이상은 예외”라는 한 문장.</p><div className="guide-step"><span>01</span><div><h3>문장을 규칙으로 바꾸고</h3><p>조건과 예외를 눈에 보이는 규칙으로 분리합니다.</p></div></div><div className="guide-step"><span>02</span><div><h3>경계에 있는 사람에게 적용하고</h3><p>경계에 있는 구성원의 결과와 이유를 확인합니다.</p></div></div><div className="guide-step"><span>03</span><div><h3>수정한 공지를 다시 검증합니다</h3><p>수정한 공지를 같은 테스트로 다시 검증합니다.</p></div></div><div className="guide-foot"><ShieldCheck size={17} /><span>AI는 문장의 의미를 해석하고,<br /><strong>코드는 같은 규칙으로 일관되게 판정합니다.</strong></span></div></aside>
    </section>
    {busy && <div className="progress-banner" role="status"><LoaderCircle size={19} className="spin" /><div><strong>{phaseCopy[state.phase]}</strong><span>{state.runMode === 'fixture' ? '샘플 공지의 규칙을 확인하고 있습니다' : 'AI는 해석하고, 코드는 규칙대로 판정합니다'}</span></div><span className="progress-dots">•••</span></div>}
    {state.error && <div className="error-banner" role="alert"><div><strong>테스트를 완료하지 못했습니다.</strong><p>{state.error}</p></div><button className="icon-button" aria-label="오류 안내 닫기" onClick={() => dispatch({ type: 'UPDATE', payload: { error: undefined, phase: state.before ? 'RESULT' : 'IDLE' } })}><X size={18} /></button></div>}
    {currentCompilation && <CompilerPanel compilation={currentCompilation} notice={currentNotice ?? ''} mode={state.runMode!} />}
    {current && <><PersonaSimulation simulation={current} members={runMembers} /><BlastRadius simulation={current} members={runMembers} source={state.runSource ?? 'NONE'} /><FindingsPanel findings={current.findings} members={runMembers} busy={busy} fixed={!!state.after} fixture={state.runMode === 'fixture'} onFix={() => void fix()} /></>}
    {state.fix && <FixNoticePanel fix={state.fix} fixture={state.runMode === 'fixture'} />}
    {state.before && state.after && state.afterCompilation && <BeforeAfter before={state.before} after={state.after} compilation={state.afterCompilation} onReset={reset} />}
    {!current && <div className="empty-footer"><ArrowDown size={16} />공지 한 장으로 첫 테스트를 시작하세요.</div>}
    </main><footer className="footer"><a className="brand" href="#"><FileCheck2 size={19} />Notice Lab</a><p>공지는 미리 검증하고, 사람의 시간은 아껴주세요.</p><span>Wanted AI Championship 2026</span></footer></>;
}
