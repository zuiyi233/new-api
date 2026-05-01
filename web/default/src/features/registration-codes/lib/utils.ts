export function isTimestampExpired(timestamp: number): boolean {
  if (timestamp === 0) return false
  return timestamp < Date.now() / 1000
}

export function isRegistrationCodeExpired(
  expiresAt: number,
  status: number
): boolean {
  return status === 1 && isTimestampExpired(expiresAt)
}

export function isRegistrationCodeExhausted(record: {
  max_uses: number
  used_count: number
}): boolean {
  const maxUses = Number(record.max_uses || 0)
  const usedCount = Number(record.used_count || 0)
  return maxUses > 0 && usedCount >= maxUses
}
