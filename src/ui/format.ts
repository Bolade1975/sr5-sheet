export function fmtSigned(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return '0'
}

export function fmtNum(n: number | null, empty = '—'): string {
  return n === null ? empty : String(n)
}

export function fmtNuyen(n: number | null): string {
  return n === null ? '—' : `${n.toLocaleString('en-US')}¥`
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
