const destinations = new Set(['/studio', '/works'])

export const safeDestination = (value: string | null) =>
  value && destinations.has(value) ? value : '/studio'
