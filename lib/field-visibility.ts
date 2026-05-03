export function isFieldVisible(fieldVisibility: Record<string, boolean> | null | undefined, field: string): boolean {
  if (!fieldVisibility) return true;
  return fieldVisibility[field] !== false;
}
