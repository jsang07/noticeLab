// Product screens never expose a provider toggle unless explicitly enabled.
export const enableDevMode = import.meta.env.VITE_ENABLE_DEV_MODE === 'true';

export function localToday(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
