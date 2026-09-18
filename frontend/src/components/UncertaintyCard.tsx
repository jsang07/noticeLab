import { CircleHelp } from 'lucide-react';
import type { Uncertainty } from '../types/rules';
export function UncertaintyCard({ uncertainty }: { uncertainty: Uncertainty }) {
  return <div className="uncertainty"><CircleHelp size={16} /><span><strong>{uncertainty.id}</strong> {uncertainty.question}</span></div>;
}
