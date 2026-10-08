export interface PersistedForm<FormBody> {
  state: FormBody
  original: FormBody
  touched: Record<keyof FormBody, boolean>
}
