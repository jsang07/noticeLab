import { Check, Copy, FileCheck2 } from 'lucide-react';
import { useState } from 'react';
import type { FixResponse } from '../types/simulation';
export function FixNoticePanel({ fix, fixture }: { fix: FixResponse; fixture: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(fix.revisedNotice); setCopied(true); setCopyError(false); } catch { setCopyError(true); } }
  return <div className="fixed-notice card enter"><div className="card-top"><span><FileCheck2 size={18} />수정된 공지 <span className="small muted">{fixture ? '샘플 수정안' : 'AI 수정안'} · 사용 전 검토 필요</span></span><button className="text-button" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? '복사 완료' : '공지 복사'}</button></div>{copyError && <p role="alert">복사하지 못했습니다. 아래 수정문을 직접 선택해 복사해 주세요.</p>}
    <div className="fixed-body"><p className="preserve">{fix.revisedNotice}</p><aside><div className="eyebrow">변경된 내용</div>{fix.changes.map((change, i) => <div className="change" key={`${change.findingId}-${i}`}><Check size={15} /><div><code>{change.findingId}</code><p>{change.description}</p></div></div>)}</aside></div>
  </div>;
}
