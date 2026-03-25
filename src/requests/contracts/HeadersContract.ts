export type HeaderValue = string | (() => string)

export interface HeadersContract {
  [key: string]: HeaderValue
}

export interface ResolvedHeadersContract {
  [key: string]: string
}
