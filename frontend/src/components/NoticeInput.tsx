import { ArrowRight, FileText, FlaskConical, LoaderCircle, Sparkles } from 'lucide-react';
import type { Notice, Mode } from '../api/client';
import { enableDevMode } from '../config';
import type { ReactNode } from 'react';

interface Props { notice: Notice; mode: Mode; busy: boolean; liveAvailable: boolean; targetControl: ReactNode; onChange: (notice: Notice) => void; onMode: (mode: Mode) => void; onSample: () => void; onRun: () => void }
export function NoticeInput({ notice, mode, busy, liveAvailable, targetControl, onChange, onMode, onSample, onRun }: Props) {
  return <div className="editor card" id="notice-input">
    <div className="card-top"><span><FileText size={17} />테스트할 공지</span><span className="muted small">01 / 공지 입력</span></div>
    <label className="sr-only" htmlFor="notice">공지 내용</label>
    <textarea id="notice" value={notice.text} disabled={busy} onChange={e => onChange({ ...notice, text: e.target.value })}
      placeholder={'공지문을 여기에 붙여넣어 주세요.\n\n누가 대상인지, 어떤 예외가 있는지,\n언제까지 신청해야 하는지…\n\n보내기 전에 함께 확인해 보세요.'} maxLength={20000} />
    <div className="editor-metadata"><label>공지 기준일<input type="date" value={notice.noticeDate} disabled={busy} onChange={e => onChange({ ...notice, noticeDate: e.target.value })} /></label><span>{notice.text.length.toLocaleString()} / 20,000자</span></div>
    {targetControl}
    <div className="editor-actions"><button className="button primary" disabled={busy} onClick={onSample}>{busy ? <LoaderCircle className="spin" size={16} /> : <FlaskConical size={16} />}샘플 공지로 체험<ArrowRight size={16} /></button>
      <button className="button secondary" disabled={busy || !notice.text.trim() || !notice.noticeDate} onClick={onRun}>내 공지 테스트<ArrowRight size={16} /></button></div>
    {enableDevMode && <div className="mode-row"><label><select aria-label="개발용 컴파일 모드" value={mode} disabled={busy} onChange={e => onMode(e.target.value as Mode)}><option value="fixture">샘플 픽스처 (개발용)</option><option value="gemini">Gemini 실시간 (개발용)</option></select></label>
      <span>{mode === 'fixture' ? '고정 샘플 · AI 호출 없이 엔진 체험' : liveAvailable ? 'Gemini가 해석하고 Python이 판정합니다' : '백엔드 Gemini API 키 설정 필요'}</span></div>}
    {!liveAvailable && <p className="sample-mode-note">샘플 체험 모드 · 준비된 공지로 전체 흐름을 확인할 수 있습니다.</p>}
    <div className="editor-note"><Sparkles size={13} />선택한 대상자와 자동 생성된 경계 사례에 같은 규칙을 적용합니다.</div>
  </div>;
}
