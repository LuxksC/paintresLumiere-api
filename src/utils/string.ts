export function isNonEmptyString(
  value: string | undefined
): value is string {
  return value !== undefined && value !== '';
}
