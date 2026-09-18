import { expect, test } from '@playwright/test';
import path from 'node:path';
import readXlsxFile from 'read-excel-file/node';

test.beforeEach(async ({ page }) => {
  // Never make a real Gemini request during browser regression tests.
  await page.route('**/api/compile', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: { message: '테스트에서 실제 AI 호출은 차단됩니다.' } }) }));
  await page.route('**/api/fix', route => route.abort());
  await page.route('**/api/demo', async route => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, capabilities: { ...data.capabilities, geminiConfigured: false } } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Don't send it yet." })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
});

test('sample -> findings -> fix -> recompile -> identical replay', async ({ page }) => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST') requests.push({ url: new URL(request.url()).pathname, body: request.postDataJSON() }); });
  await page.screenshot({ path: 'test-results/notice-lab-home.png', fullPage: true });
  await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
  await expect(page.locator('.person-tile')).toHaveCount(18);
  await expect(page.locator('.stats')).toContainText('8대상');
  await expect(page.locator('.stats')).toContainText('5대상 아님');
  await expect(page.locator('.stats')).toContainText('3판단 필요');
  await expect(page.locator('.stats')).toContainText('2규칙 충돌');
  await expect(page.locator('.finding')).toHaveCount(3);
  await expect(page.locator('.finding').first()).toContainText('영향받는 구성원 3명 · 오지훈, 한유진, 임도윤');
  await expect(page.locator('.boundary-suite .count')).toHaveText('12');
  await page.getByRole('button', { name: '오지훈: 판단 필요' }).click();
  await expect(page.locator('.selected-member')).toContainText('2026.07.01');
  await expect(page.locator('.selected-member')).toContainText('2026.07.10');
  await page.getByRole('button', { name: '구성원 상세 닫기' }).click();
  await page.screenshot({ path: 'test-results/notice-lab-before.png', fullPage: true });
  await page.locator('.persona-grid').first().screenshot({ path: 'test-results/notice-lab-personas-ko.png' });
  await page.locator('.findings-list').screenshot({ path: 'test-results/notice-lab-findings-ko.png' });
  await page.getByRole('button', { name: '공지 수정 후 재검증', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전체 18명 대신 실제 대상 8명에게 보내세요.' })).toBeVisible();
  await expect(page.getByText('미해결 규칙 0개', { exact: true })).toBeVisible();
  await expect(page.locator('.comparison-grid')).toContainText('10');
  await expect(page.locator('.finding')).toHaveCount(0);
  await expect(page.locator('.person-tile')).toHaveCount(18);
  expect(requests.map(r => r.url)).toEqual(['/api/demo/compile', '/api/simulate', '/api/demo/fix', '/api/demo/compile', '/api/simulate']);
  expect(requests[1].body.members).toEqual(requests[4].body.members);
  expect((requests[4].body.personas as unknown[]).length).toBe(12);
  expect(requests[3].body.noticeText).not.toEqual(requests[0].body.noticeText);
  await page.screenshot({ path: 'test-results/notice-lab-after.png', fullPage: true });
  await page.locator('#comparison').screenshot({ path: 'test-results/notice-lab-comparison.png' });
  await page.locator('.blast').screenshot({ path: 'test-results/notice-lab-blast.png' });
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: '새 공지 테스트' }).click();
  await expect(page.locator('#comparison')).toHaveCount(0);
  await expect(page.getByLabel('공지 내용')).toHaveValue('');
});

test('explicit fixture refuses arbitrary input and changing input clears results', async ({ page }) => {
  await page.getByLabel('공지 내용').fill('A notice with different eligibility.');
  await page.getByLabel('공지 기준일').fill('2026-04-01');
  await page.getByRole('button', { name: '내 공지 테스트' }).click();
  await expect(page.getByRole('alert')).toContainText('Gemini 모드를 사용');
  await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
  await expect(page.locator('.person-tile')).toHaveCount(18);
  await page.getByLabel('공지 내용').fill('Changed input');
  await expect(page.locator('.person-tile')).toHaveCount(0);
  await expect(page.locator('.rule-card')).toHaveCount(0);
});

test('Gemini quota errors stay visible and never silently fall back', async ({ page }) => {
  await page.route('**/api/compile', route => route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ detail: { code: 'GEMINI_RATE_LIMIT', message: 'Gemini 요청 한도에 도달했습니다.' } }) }));
  await page.route('**/api/demo', async route => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, capabilities: { ...data.capabilities, geminiConfigured: true } } });
  });
  await page.reload();
  await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
  await expect(page.getByRole('alert')).toContainText('Gemini 요청 한도');
  await expect(page.locator('.person-tile')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '샘플 공지로 체험' })).toBeEnabled();
});

test('mobile full flow has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
  await expect(page.locator('.person-tile')).toHaveCount(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/notice-lab-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '공지 수정 후 재검증', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전체 18명 대신 실제 대상 8명에게 보내세요.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('fix failure preserves original results and offers retry', async ({ page }) => {
  await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
  await expect(page.locator('.finding')).toHaveCount(3);
  await page.route('**/api/demo/fix', route => route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ detail: { message: '수정 응답 시간이 초과되었습니다.' } }) }), { times: 1 });
  await page.getByRole('button', { name: '공지 수정 후 재검증', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('초과');
  await expect(page.locator('.finding')).toHaveCount(3);
  await expect(page.locator('.person-tile')).toHaveCount(18);
  await page.getByRole('button', { name: '공지 수정 후 재검증', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전체 18명 대신 실제 대상 8명에게 보내세요.' })).toBeVisible();
});

test('recompile failure retries the returned text without another fix call', async ({ page }) => {
  let fixes = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/demo/fix') fixes++; });
  await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
  await expect(page.locator('.finding')).toHaveCount(3);
  await page.route('**/api/demo/compile', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ detail: { message: '규칙 출력을 검증하지 못했습니다.' } }) }), { times: 1 });
  await page.getByRole('button', { name: '공지 수정 후 재검증', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('검증하지 못했습니다');
  await expect(page.locator('.fixed-notice')).toContainText('2026년 4월 10일');
  await page.getByRole('button', { name: '공지 수정 후 재검증', exact: true }).click();
  await expect(page.getByRole('heading', { name: '전체 18명 대신 실제 대상 8명에게 보내세요.' })).toBeVisible();
  expect(fixes).toBe(1);
});

test('downloadable XLSX templates contain the requested blank headers', async () => {
  const expected: Record<string, string[]> = {
    'notice-lab-basic.xlsx': ['이름', '소속', '역할', '구성원유형', '상태'],
    'notice-lab-company.xlsx': ['이름', '소속', '역할', '고용형태', '재직상태', '입사일', '계약종료일', '관리자구분'],
    'notice-lab-school.xlsx': ['이름', '소속', '역할', '구성원유형', '상태', '학년', '반', '입학일'],
    'notice-lab-academy.xlsx': ['이름', '소속', '역할', '구성원유형', '상태', '수강반', '등록일', '수강종료일'],
    'notice-lab-club.xlsx': ['이름', '소속', '역할', '구성원유형', '상태', '회원등급', '가입일'],
  };
  for (const [file, headers] of Object.entries(expected)) {
    const sheets = await readXlsxFile(path.resolve('public/templates', file));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].data[0]).toEqual(headers);
    expect(sheets[0].data.slice(1).flat().filter(value => value !== null)).toEqual([]);
  }
});

test('normal notices default to no targets and still run boundary personas', async ({ page }) => {
  await expect(page.getByRole('button', { name: /대상자 없이 테스트/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
  await expect(page.locator('.person-tile')).toHaveCount(18);
  await page.getByRole('button', { name: /대상자 없이 테스트/ }).click();
  await page.getByRole('button', { name: '내 공지 테스트' }).click();
  await expect(page.locator('.blast-empty')).toContainText('대상자 데이터 없이 실행했습니다.');
  await expect(page.locator('.boundary-suite .count')).toHaveText('12');
  await expect(page.locator('.person-tile')).toHaveCount(0);
});

test('pasted custom fields are typed, previewed, and only descriptors reach compile', async ({ page }) => {
  const compilation = {
    version: '1.0', title: '학년 대상 공지', timezone: 'Asia/Seoul', anchors: [{ id: 'notice-date', type: 'DATE', value: '2026-04-01' }],
    baselineEligibility: { kind: 'condition', id: 'grade', field: 'customFields.학년', operator: 'GTE', value: { kind: 'literal', type: 'number', value: 3 }, sourceText: '학년이 3 이상', confidence: 'HIGH', requiresConfirmation: false },
    exceptions: [], actions: [], uncertainties: [],
  };
  let compileBody: Record<string, unknown> = {};
  await page.unroute('**/api/demo');
  await page.route('**/api/demo', async route => {
    const response = await route.fetch(); const data = await response.json();
    await route.fulfill({ response, json: { ...data, capabilities: { ...data.capabilities, geminiConfigured: true } } });
  });
  await page.route('**/api/compile', async route => { compileBody = route.request().postDataJSON(); await route.fulfill({ json: { compilation, source: 'gemini' } }); });
  await page.reload();
  await page.getByLabel('공지 내용').fill('학년이 3 이상인 대상자에게 안내합니다.');
  await page.getByLabel('공지 기준일').fill('2026-04-01');
  await page.getByRole('button', { name: /내 대상자 데이터/ }).click();
  await page.getByRole('button', { name: '표 붙여넣기' }).click();
  await page.getByLabel('대상자 표 붙여넣기').fill('이름\t소속\t학년\t입학일\t회원등급\n김학생\t3학년 2반\t3\t2024-03-04\t정회원\n이학생\t2학년 1반\t2\t2025-03-04\t준회원');
  await page.getByRole('button', { name: '이 표 사용하기' }).click();
  await expect(page.locator('.preview-summary')).toContainText('2명');
  await expect(page.locator('.field-chips')).toContainText('학년NUMBER');
  await expect(page.locator('.field-chips')).toContainText('입학일DATE');
  await page.getByRole('button', { name: '내 공지 테스트' }).click();
  await expect(page.locator('.person-tile')).toHaveCount(2);
  await expect(page.locator('.stats')).toContainText('1대상');
  const fields = compileBody.availableMemberFields as Array<Record<string, unknown>>;
  expect(fields).toEqual(expect.arrayContaining([{ field: 'customFields.학년', label: '학년', type: 'NUMBER' }, { field: 'customFields.입학일', label: '입학일', type: 'DATE' }]));
  const serialized = JSON.stringify(compileBody);
  expect(serialized).not.toContain('김학생');
  expect(serialized).not.toContain('정회원');
});

test('custom Fix reuses the exact imported target snapshot instead of sample members', async ({ page }) => {
  const simulateBodies: Array<Record<string, unknown>> = [];
  const makeCompilation = (requiresConfirmation: boolean) => ({
    version: '1.0', title: '학년 대상 공지', timezone: 'Asia/Seoul', anchors: [{ id: 'notice-date', type: 'DATE', value: '2026-04-01' }],
    baselineEligibility: { kind: 'condition', id: 'grade', field: 'customFields.학년', operator: 'GTE', value: { kind: 'literal', type: 'number', value: 3 }, sourceText: '학년이 3 이상', confidence: requiresConfirmation ? 'UNKNOWN' : 'HIGH', requiresConfirmation },
    exceptions: [], actions: [], uncertainties: [],
  });
  await page.unroute('**/api/demo');
  await page.route('**/api/demo', async route => { const response = await route.fetch(); const data = await response.json(); await route.fulfill({ response, json: { ...data, capabilities: { ...data.capabilities, geminiConfigured: true } } }); });
  await page.route('**/api/compile', async route => { const body = route.request().postDataJSON(); await route.fulfill({ json: { compilation: makeCompilation(String(body.noticeText).includes('명확합니다') ? false : true), source: 'gemini' } }); });
  await page.route('**/api/fix', async route => { const body = route.request().postDataJSON(); await route.fulfill({ json: { revisedNotice: '학년이 3 이상인 대상자를 포함합니다. 조건은 명확합니다.', changes: (body.findings as Array<{ id: string }>).map(finding => ({ findingId: finding.id, description: '학년 경계를 명시했습니다.' })) } }); });
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/simulate') simulateBodies.push(request.postDataJSON()); });
  await page.reload();
  await page.getByLabel('공지 내용').fill('학년이 3 이상인지 확인합니다.');
  await page.getByLabel('공지 기준일').fill('2026-04-01');
  await page.getByRole('button', { name: /내 대상자 데이터/ }).click();
  await page.getByRole('button', { name: '표 붙여넣기' }).click();
  await page.getByLabel('대상자 표 붙여넣기').fill('이름\t학년\n김학생\t3');
  await page.getByRole('button', { name: '이 표 사용하기' }).click();
  await page.getByRole('button', { name: '내 공지 테스트' }).click();
  await expect(page.locator('.finding')).toHaveCount(1);
  await page.getByRole('button', { name: '공지 수정 후 재검증', exact: true }).click();
  await expect(page.locator('#comparison')).toBeVisible();
  expect(simulateBodies).toHaveLength(2);
  expect(simulateBodies[0].members).toEqual(simulateBodies[1].members);
  expect(simulateBodies[0].members).toHaveLength(1);
  expect(JSON.stringify(simulateBodies[1].members)).toContain('김학생');
});

test('CSV import handles BOM, quoted commas, empty cells, and blank rows', async ({ page }) => {
  await page.getByRole('button', { name: /내 대상자 데이터/ }).click();
  await page.getByLabel('대상자 파일 선택').setInputFiles({
    name: '대상자.csv', mimeType: 'text/csv',
    buffer: Buffer.from('\uFEFF이름,소속,회원등급,가입일\r\n"김,학생",학교,정회원,2025-03-01\r\n\r\n이학생,,준회원,\r\n', 'utf8'),
  });
  await expect(page.locator('.preview-summary')).toContainText('2명');
  await expect(page.locator('.preview-table-wrap').first()).toContainText('김,학생');
  await expect(page.locator('.field-chips')).toContainText('회원등급STRING');
  await expect(page.locator('.field-chips')).toContainText('가입일DATE');
});

test('multi-sheet XLSX ignores the guide sheet and asks which target sheet to use', async ({ page }) => {
  await page.getByRole('button', { name: /내 대상자 데이터/ }).click();
  await page.getByLabel('대상자 파일 선택').setInputFiles(path.resolve('tests/fixtures/target-data-multi-sheet.xlsx'));
  await expect(page.getByRole('dialog', { name: '가져올 시트를 선택하세요' })).toBeVisible();
  await expect(page.locator('.sheet-list button')).toHaveCount(5);
  await expect(page.getByRole('button', { name: /사용안내/ })).toHaveCount(0);
  await page.getByRole('button', { name: /학교/ }).click();
  await expect(page.getByRole('alert')).toContainText('대상자 데이터를 한 행 이상');
});

test('product UI hides developer controls and exposes Korean explanations', async ({ page }) => {
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByLabel('Timezone')).toHaveCount(0);
  await expect(page.getByText('사람에게 보내기 전에, AI 사람들에게 먼저 테스트하세요.')).toBeVisible();
  await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
  await expect(page.locator('.person-tile')).toHaveCount(18);
  await expect(page.locator('.blast-note')).toContainText('5명은 아직 판정할 수 없습니다.');
  await expect(page.getByText('기준일에 따라 대상 여부가 달라집니다.').first()).toBeVisible();
  await expect(page.locator('.candidate').filter({ hasText: '공지일 기준' }).first()).toBeVisible();
  await expect(page.locator('.candidate').filter({ hasText: '신청 마감일 기준' }).first()).toBeVisible();
  await expect(page.locator('.json-details')).not.toHaveAttribute('open', '');
  await expect(page.locator('.trace').first()).not.toHaveAttribute('open', '');
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/Sample fixture|Gemini live|predetermined|no AI call|MISSING_REFERENCE/);
  await page.getByText('검증된 Rule JSON 보기').click();
  await expect(page.locator('.json-details pre')).toContainText('contract-duration');
});

test('developer flag explicitly enables the retained mode selector', async ({ page }) => {
  const { createServer } = await import('vite');
  const previous = process.env.VITE_ENABLE_DEV_MODE;
  process.env.VITE_ENABLE_DEV_MODE = 'true';
  const server = await createServer({ server: { port: 5174, host: '127.0.0.1', strictPort: true } });
  try {
    await server.listen();
    await page.goto('http://127.0.0.1:5174');
    const selector = page.getByLabel('개발용 컴파일 모드');
    await expect(selector).toBeVisible();
    await selector.selectOption('fixture');
    await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
    await expect(page.locator('.person-tile')).toHaveCount(18);
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.VITE_ENABLE_DEV_MODE;
    else process.env.VITE_ENABLE_DEV_MODE = previous;
  }
});

test.describe('local notice date', () => {
  test.use({ timezoneId: 'America/Los_Angeles' });
  test('uses local today; sample date is reserved for the sample', async ({ page }) => {
    // UTC is Sep 18, browser-local day is Sep 17. No toISOString date truncation.
    await page.clock.setFixedTime(new Date('2026-09-18T01:00:00Z'));
    await page.reload();
    await expect(page.getByLabel('공지 기준일')).toHaveValue('2026-09-17');
    await page.getByRole('button', { name: '샘플 공지로 체험' }).click();
    await expect(page.locator('.person-tile')).toHaveCount(18);
    await expect(page.getByLabel('공지 기준일')).toHaveValue('2026-04-01');
    await page.getByLabel('공지 내용').fill('직접 작성한 새 공지');
    await expect(page.getByLabel('공지 기준일')).toHaveValue('2026-09-17');
    await page.getByLabel('공지 기준일').fill('2026-09-20');
    await page.getByLabel('공지 내용').fill('공지 수정');
    await expect(page.getByLabel('공지 기준일')).toHaveValue('2026-09-20');
  });
});
