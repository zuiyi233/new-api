import { api } from '@/lib/api'
import type {
  CodeDelivery,
  CodePublication,
  ApiResponse,
  PublishCodesParams,
  CodePublicationDetail,
} from './types'

export async function getPublications(
  p = 1,
  page_size = 10
): Promise<ApiResponse<{ items: CodePublication[]; total: number }>> {
  const res = await api.get(
    `/api/code-publication/?p=${p}&page_size=${page_size}`
  )
  return res.data
}

export async function publishCodes(
  params: PublishCodesParams
): Promise<ApiResponse<CodeDelivery>> {
  const publicationId = Number(params.publication_id || 0)
  const action = params.action || 'reissue'
  const res = await api.post(`/api/code-publication/${publicationId}/${action}`, {
    delivery_channel: params.delivery_channel || '',
    revoke_reason: params.revoke_reason || '',
    notes: params.notes || '',
  })
  return res.data
}

export async function getPublicationDetail(
  id: number
): Promise<ApiResponse<CodePublicationDetail>> {
  const res = await api.get(`/api/code-publication/${id}/detail`)
  return res.data
}
