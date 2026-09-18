import type { Confidence } from './member';
export interface LiteralValue { kind: 'literal'; type: 'date' | 'string' | 'string_array' | 'number' | 'number_array' | 'boolean' | 'null'; value: string | string[] | number | number[] | boolean | null }
export interface RelativeDate { kind: 'relative_date'; base: { kind: 'anchor_reference'; anchorId: string } | { kind: 'unresolved_reference'; uncertaintyId: string; candidateAnchorIds: string[] }; offset: { months: number; days: number } }
export interface Condition {
  kind: 'condition'; id: string; field: string;
  operator: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE' | 'IN' | 'NOT_IN' | 'IS_NULL' | 'IS_NOT_NULL';
  value: LiteralValue | RelativeDate; sourceText: string; confidence: Confidence; requiresConfirmation: boolean;
}
export type RuleNode = Condition | { kind: 'all' | 'any'; children: RuleNode[] };
export interface Uncertainty { id: string; type: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; question: string; candidateAnchorIds: string[]; affectsRuleIds: string[] }
export interface Compilation {
  version: '1.0'; title: string; timezone: string;
  anchors: { id: string; type: 'DATE' | 'DATETIME'; value: string }[];
  baselineEligibility: RuleNode;
  exceptions: { id: string; when: RuleNode; effect: 'INCLUDE' | 'EXCLUDE'; precedence: 'OVERRIDE_BASELINE' | 'BASELINE_WINS' | 'UNSPECIFIED'; sourceText: string }[];
  actions: { id: string; description: string; when: RuleNode | null; deadlineAnchorId: string | null; sourceText: string }[];
  uncertainties: Uncertainty[];
}
export function conditions(node: RuleNode): Condition[] { return node.kind === 'condition' ? [node] : node.children.flatMap(conditions); }
