const tokenKey = 'formaspace.access-token'

export const readToken = (): string | null => {
  try {
    return sessionStorage.getItem(tokenKey) || null
  } catch {
    return null
  }
}

export const writeToken = (token: string | null): boolean => {
  try {
    if (token) sessionStorage.setItem(tokenKey, token)
    else sessionStorage.removeItem(tokenKey)
    return true
  } catch {
    return false
  }
}
