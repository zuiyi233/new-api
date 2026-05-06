import { api } from '@/lib/api'

export interface LotteryPrize {
  id: string
  name: string
  min_quota: number
  max_quota: number
  weight: number
  color: string
  icon: string
  is_grand_prize: boolean
}

export interface LotteryTypeInfo {
  type: string
  name: string
  description: string
  icon: string
  enabled: boolean
  unlock_mode: string
  unlock_value: number
  daily_limit: number
  prizes: LotteryPrize[]
  is_unlocked: boolean
  remaining: number
  is_time_limited: boolean
  start_time: number
  end_time: number
}

export interface LotteryStatusData {
  enabled: boolean
  types: LotteryTypeInfo[]
  total_plays: number
  total_quota: number
  checkin_tier?: string
}

export interface LotteryPlayResult {
  success: boolean
  prize: LotteryPrize | null
  quota_awarded: number
  current_quota: number
  remaining: number
  checkin_tier?: string
}

export interface LotteryRecord {
  id: number
  user_id: number
  lottery_type: string
  prize_id: string
  quota_awarded: number
  created_at: number
}

export interface LotteryHistoryData {
  records: LotteryRecord[]
  total: number
  page: number
  page_size: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export async function getLotteryStatus(): Promise<ApiResponse<LotteryStatusData>> {
  const res = await api.get('/api/user/lottery/status')
  return res.data
}

export async function playLottery(
  type: string,
  turnstileToken?: string
): Promise<ApiResponse<LotteryPlayResult>> {
  const url = turnstileToken
    ? `/api/user/lottery/play/${type}?turnstile=${encodeURIComponent(turnstileToken)}`
    : `/api/user/lottery/play/${type}`
  const res = await api.post(url)
  return res.data
}

export async function getLotteryHistory(
  params?: { type?: string; page?: number; page_size?: number }
): Promise<ApiResponse<LotteryHistoryData>> {
  const searchParams = new URLSearchParams()
  if (params?.type) searchParams.set('type', params.type)
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.page_size) searchParams.set('page_size', String(params.page_size))
  const query = searchParams.toString()
  const res = await api.get(`/api/user/lottery/history${query ? `?${query}` : ''}`)
  return res.data
}
