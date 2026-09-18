import type { Member } from '../types/member';
import type { Compilation } from '../types/rules';
import type { Finding, FixResponse, Persona, Simulation } from '../types/simulation';
import type { FieldDescriptor } from '../targetImport/types';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
export type Mode = 'fixture' | 'gemini';
export interface Notice { title: string; text: string; noticeDate: string; timezone: string }
export interface Demo { notice: Notice; members: Member[]; capabilities: { geminiConfigured: boolean; demoFixtures: boolean } }

async function request<T>(path: string, payload?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 100_000);
  try {
    const response = await fetch(`${BASE}/api${path}`, { method: payload === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload), signal: controller.signal });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const detail = error?.detail;
      throw new Error(typeof detail === 'string' ? detail : detail?.message ?? (response.status === 422 ? '입력 데이터의 형식을 확인해 주세요.' : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
    if (error instanceof TypeError) throw new Error('백엔드에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.');
    throw error;
  } finally { window.clearTimeout(timer); }
}

export const api = {
  demo: () => request<Demo>('/demo'),
  compile: (notice: Notice, mode: Mode, availableMemberFields: FieldDescriptor[] = []) => request<{ compilation: Compilation; source: Mode }>(mode === 'fixture' ? '/demo/compile' : '/compile',
    { noticeText: notice.text, noticeDate: notice.noticeDate, timezone: notice.timezone, ...(availableMemberFields.length ? { availableMemberFields } : {}) }),
  simulate: (compilation: Compilation, members: Member[], personas?: Persona[]) => request<Simulation>('/simulate', { compilation, members, generatePersonas: true, ...(personas ? { personas } : {}) }),
  fix: (originalNotice: string, compilation: Compilation, findings: Finding[], mode: Mode) => request<FixResponse>(mode === 'fixture' ? '/demo/fix' : '/fix', { originalNotice, compilation, findings }),
};
