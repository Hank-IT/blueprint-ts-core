export type HeaderValue = string | (() => string)

export interface HeadersContract {
  [key: string]: HeaderValue
}
