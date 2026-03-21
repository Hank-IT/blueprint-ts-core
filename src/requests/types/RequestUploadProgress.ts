export interface RequestUploadProgress {
  loaded: number
  total?: number | undefined
  lengthComputable: boolean
  progress?: number | undefined
}
