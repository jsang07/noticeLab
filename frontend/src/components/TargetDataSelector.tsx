import { useRef, useState } from 'react';
import { Check, ChevronDown, Download, FileSpreadsheet, Info, Table2, Upload, X } from 'lucide-react';
import { normalizeTargets } from '../targetImport/normalizeTargets';
import { parseCsv, parseTablePaste, parseXlsx } from '../targetImport/parsers';
import type { ImportedTargets, RawTable, TargetSource } from '../targetImport/types';

interface Props {
  source: TargetSource;
  imported?: ImportedTargets;
  disabled: boolean;
  onSource: (source: TargetSource) => void;
  onImport: (targets: ImportedTargets) => void;
}

const templates = [
  ['기본', '/templates/notice-lab-basic.xlsx'], ['회사', '/templates/notice-lab-company.xlsx'],
  ['학교', '/templates/notice-lab-school.xlsx'], ['학원', '/templates/notice-lab-academy.xlsx'],
  ['동아리·협회', '/templates/notice-lab-club.xlsx'],
] as const;

export function TargetDataSelector({ source, imported, disabled, onSource, onImport }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState('');
  const [sheetTables, setSheetTables] = useState<RawTable[]>([]);

  function finish(table: RawTable) {
    try { onImport(normalizeTargets(table)); setError(''); setPasteOpen(false); setSheetTables([]); }
    catch (reason) { setSheetTables([]); setError(reason instanceof Error ? reason.message : '대상자 데이터를 읽지 못했습니다.'); }
  }

  async function upload(file?: File) {
    if (!file) return;
    try {
      if (/\.csv$/i.test(file.name)) finish(parseCsv(await file.text(), file.name));
      else if (/\.xlsx$/i.test(file.name)) {
        const workbook = await parseXlsx(file);
        if (workbook.sheets.length === 1) finish(workbook.sheets[0]);
        else { setSheetTables(workbook.sheets); setError(''); }
      } else throw new Error('XLSX 또는 CSV 파일을 선택해 주세요.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '파일을 읽지 못했습니다.'); }
    finally { if (input.current) input.current.value = ''; }
  }

  return <section className="target-source" aria-labelledby="target-source-title">
    <div className="target-heading"><div><span className="eyebrow">대상자 선택</span><h3 id="target-source-title">누구에게 테스트할까요?</h3></div><span className="privacy-note">AI에는 공지와 열 구조만 전달합니다</span></div>
    <div className="source-options">
      <button type="button" className={`source-option ${source === 'NONE' ? 'selected' : ''}`} disabled={disabled} onClick={() => onSource('NONE')} aria-pressed={source === 'NONE'}><span className="source-radio">{source === 'NONE' && <Check size={13} />}</span><span><strong>대상자 없이 테스트</strong><small>자동 생성된 경계 사례로 공지만 테스트합니다.</small></span></button>
      <button type="button" className={`source-option ${source === 'SAMPLE' ? 'selected' : ''}`} disabled={disabled} onClick={() => onSource('SAMPLE')} aria-pressed={source === 'SAMPLE'}><span className="source-radio">{source === 'SAMPLE' && <Check size={13} />}</span><span><strong>샘플 조직 사용</strong><small>Notice Lab 샘플 대상자 18명을 사용합니다.</small></span></button>
      <button type="button" className={`source-option ${source === 'CUSTOM' ? 'selected' : ''}`} disabled={disabled} onClick={() => onSource('CUSTOM')} aria-pressed={source === 'CUSTOM'}><span className="source-radio">{source === 'CUSTOM' && <Check size={13} />}</span><span><strong>내 대상자 데이터</strong><small>Excel, CSV 또는 붙여넣은 표를 사용합니다.</small></span></button>
    </div>
    {source === 'CUSTOM' && <div className="target-import-panel">
      <div className="import-actions"><input ref={input} className="sr-only" type="file" accept=".xlsx,.csv" aria-label="대상자 파일 선택" onChange={event => void upload(event.target.files?.[0])} />
        <button type="button" className="button compact" onClick={() => input.current?.click()} disabled={disabled}><Upload size={15} />Excel / CSV 업로드</button>
        <button type="button" className="button compact" onClick={() => setPasteOpen(true)} disabled={disabled}><Table2 size={15} />표 붙여넣기</button>
        <button type="button" className="text-button" onClick={() => setFormatOpen(true)}><Info size={14} />데이터 형식 보기</button>
        <details className="template-menu"><summary><Download size={14} />템플릿 다운로드<ChevronDown size={13} /></summary><div>{templates.map(([label, href]) => <a key={label} href={href} download>{label}</a>)}</div></details>
      </div>
      {error && <p className="import-error" role="alert">{error}</p>}
      {imported && <div className="import-preview"><div className="preview-summary"><div><FileSpreadsheet size={18} /><span><strong>{imported.members.length.toLocaleString()}명</strong><small>{imported.sourceName}</small></span></div><button type="button" className="text-button" onClick={() => setFullOpen(true)}>전체 데이터 보기</button></div>
        <div className="field-chips">{imported.fields.map(field => <span key={field.field}>{field.label}<small>{field.type}</small></span>)}</div>
        <div className="preview-table-wrap"><table><thead><tr>{imported.fields.map(field => <th key={field.field}>{field.label}</th>)}</tr></thead><tbody>{imported.previewRows.slice(0, 4).map((row, index) => <tr key={index}>{imported.fields.map(field => <td key={field.field}>{String(row[field.label] ?? '')}</td>)}</tr>)}</tbody></table></div>
        {imported.warnings.length > 0 && <p className="import-warning">{imported.warnings.length}개 행의 빈 값을 안전한 기본값으로 표시했습니다.</p>}
      </div>}
    </div>}
    {sheetTables.length > 0 && <Modal title="가져올 시트를 선택하세요" onClose={() => setSheetTables([])}><div className="sheet-list">{sheetTables.map(sheet => <button type="button" key={sheet.name} onClick={() => finish(sheet)}><FileSpreadsheet size={17} /><span><strong>{sheet.name}</strong><small>{sheet.rows.length.toLocaleString()}개 데이터 행</small></span></button>)}</div></Modal>}
    {pasteOpen && <Modal title="표 붙여넣기" onClose={() => setPasteOpen(false)}><p className="modal-help">Excel이나 Google Sheets에서 헤더를 포함한 범위를 복사해 붙여넣으세요.</p><textarea className="paste-area" aria-label="대상자 표 붙여넣기" value={paste} onChange={event => setPaste(event.target.value)} placeholder={'이름\t소속\t역할\n김학생\t3학년 2반\t학생'} /><button type="button" className="button primary" disabled={!paste.trim()} onClick={() => { try { finish(parseTablePaste(paste)); } catch (reason) { setError(reason instanceof Error ? reason.message : '표를 읽지 못했습니다.'); } }}>이 표 사용하기</button></Modal>}
    {formatOpen && <FormatModal onClose={() => setFormatOpen(false)} />}
    {fullOpen && imported && <Modal title={`대상자 데이터 · ${imported.members.length.toLocaleString()}명`} onClose={() => setFullOpen(false)} wide><div className="preview-table-wrap full"><table><thead><tr>{imported.fields.map(field => <th key={field.field}>{field.label}</th>)}</tr></thead><tbody>{imported.previewRows.map((row, index) => <tr key={index}>{imported.fields.map(field => <td key={field.field}>{String(row[field.label] ?? '')}</td>)}</tr>)}</tbody></table></div></Modal>}
  </section>;
}

function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal-card ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-title"><h3>{title}</h3><button type="button" className="icon-button" aria-label="닫기" onClick={onClose}><X size={18} /></button></div>{children}</div></div>;
}

function FormatModal({ onClose }: { onClose: () => void }) {
  const examples = [
    ['회사', '이름 · 소속 · 역할 · 고용형태 · 재직상태 · 입사일 · 계약종료일 · 관리자구분', '김민지 · 개발팀 · 개발자 · 정규직 · 재직 · 2025-08-18 · [빈칸] · 일반'],
    ['학교', '이름 · 소속 · 역할 · 구성원유형 · 상태 · 학년 · 반 · 입학일', '김학생 · 3학년 2반 · 학생 · 재학생 · 재학 · 3 · 2 · 2024-03-04'],
    ['학원', '이름 · 소속 · 역할 · 구성원유형 · 상태 · 수강반 · 등록일 · 수강종료일', '박수강 · 수학A반 · 수강생 · 정규반 · 수강중 · 수학A · 2026-03-01 · 2026-08-31'],
    ['동아리·협회', '이름 · 소속 · 역할 · 구성원유형 · 상태 · 회원등급 · 가입일', '이회원 · 기획팀 · 운영진 · 정회원 · 활동중 · 정회원 · 2025-09-10'],
  ];
  return <Modal title="대상자 데이터 형식" onClose={onClose} wide><p className="modal-help">첫 행은 열 이름으로 사용합니다. 필요한 열만 남기고 공지 조건에 맞는 열을 자유롭게 추가할 수 있습니다. 빈 셀도 허용됩니다.</p><div className="format-examples">{examples.map(([title, headers, row]) => <article key={title}><h4>{title}</h4><code>{headers}</code><p>{row}</p></article>)}</div></Modal>;
}
