export interface MjLog {
  id: number
  user_id: number
  user_name: string
  channel_id: number
  channel_name: string
  model_name: string
  action: string
  prompt: string
  image_url: string
  status: string
  progress: number
  created_at: number
  updated_at: number
  quota_used: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetMjLogsParams {
  p?: number
  page_size?: number
  keyword?: string
  user_id?: number
  channel_id?: number
  status?: string
  action?: string
  start_time?: number
  end_time?: number
}
