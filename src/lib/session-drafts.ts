const prefix = 'formaspace.pending-task.'
export const readSessionDraft = (userId: string): unknown => {
  try { return JSON.parse(sessionStorage.getItem(`${prefix}${userId}`) ?? 'null') } catch { return null }
}
export const writeSessionDraft = (userId: string, value: unknown) => {
  try {
    if (value === null) sessionStorage.removeItem(`${prefix}${userId}`)
    else sessionStorage.setItem(`${prefix}${userId}`, JSON.stringify(value))
    return true
  } catch { return false }
}
export const clearSessionDrafts = () => {
  try {
    Object.keys(sessionStorage).filter((key) => key.startsWith(prefix)).forEach((key) => sessionStorage.removeItem(key))
  } catch { /* 浏览器禁止存储时，内存中的待确认提交仍可重试。 */ }
}
