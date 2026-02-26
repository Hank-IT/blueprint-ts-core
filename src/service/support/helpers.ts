export const getCookie = (cname: string) => {
  const name = cname + '='
  const decodedCookie = decodeURIComponent(document.cookie)
  const ca = decodedCookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]

    if (c === undefined) {
      return ''
    }

    while (c.charAt(0) == ' ') {
      c = c.substring(1)
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length)
    }
  }
  return ''
}

export const isObject = (item: unknown): boolean => {
  if (!item) {
    return false
  }

  if (Array.isArray(item)) {
    return false
  }

  return typeof item === 'object'
}

export const mergeDeep = (target: object, ...sources: object[]): object => {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      // @ts-expect-error unknown structure
      if (isObject(source[key])) {
        // @ts-expect-error unknown structure
        if (!target[key]) Object.assign(target, { [key]: {} })
        // @ts-expect-error unknown structure
        mergeDeep(target[key], source[key])
      } else {
        // @ts-expect-error unknown structure
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

export const getDisplayablePages = (totalPages: number, pageNumber: number, displayPages: number = 4) => {
  if (totalPages < displayPages) {
    displayPages = totalPages
  }

  let offset = 0

  const middlePage = Math.ceil(displayPages / 2)

  if (pageNumber <= middlePage) {
    offset = 0
  } else if (pageNumber > totalPages - middlePage) {
    offset = totalPages - displayPages
  } else {
    offset = pageNumber - middlePage
  }

  return [...Array(displayPages).keys()].map((i) => i + 1 + offset)
}

export const isAtBottom = (scrollHeight: number, scrollTop: number, clientHeight: number): boolean => {
  return Math.abs(scrollHeight - scrollTop - clientHeight) <= 3.0
}
