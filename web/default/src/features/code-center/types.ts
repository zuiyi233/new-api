export interface CodeCenterStats {
  registration_codes: {
    total: number
    enabled: number
    disabled: number
    used: number
    expired: number
  }
  subscription_codes: {
    total: number
    enabled: number
    disabled: number
    used: number
    expired: number
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface CodeOperationLog {
  id: number
  code_type: string
  operation_type: string
  operator_id: number
  operator_name?: string
  file_name: string
  batch_no: string
  target_summary: string
  filters: string
  total_count: number
  success_count: number
  failed_count: number
  notes: string
  error_details: string
  created_at: number
}

export interface GetOperationHistoryParams {
  p?: number
  page_size?: number
  code_type?: string
  keyword?: string
  operation_type?: string
  result?: string
  batch_no?: string
  operator_id?: string
  created_from?: number
  created_to?: number
}

export interface OperationHistoryPage {
  items: CodeOperationLog[]
  total: number
  page: number
  page_size: number
}
