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
