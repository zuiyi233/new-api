export interface MjLog {
  id: number
  user_id: number
  user_name?: string
  channel_id: number
  channel_name?: string
  model_name?: string
  mj_id?: string
  action: string
  prompt: string
  image_url: string
  status: string
  progress: string
  submit_time?: number
  start_time?: number
  finish_time?: number
  created_at?: number
  updated_at?: number
  quota_used?: number
  quota?: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetMjLogsParams {
  p?: number
  page_size?: number
  user_id?: number
  channel_id?: number
  mj_id?: string
  start_timestamp?: number
  end_timestamp?: number
}
