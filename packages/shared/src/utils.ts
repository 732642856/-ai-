export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = ((...args: unknown[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T & { cancel: () => void }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
  }
  return debounced
}
