import { api } from '@/lib/api'
import type {
  RegistrationCode,
  ApiResponse,
  GetRegistrationCodesParams,
  GetRegistrationCodesResponse,
  RegistrationCodeFormData,
  RegistrationCodeBatchSummary,
  RegistrationCodeUsage,
} from './types'

export async function getRegistrationCodes(
  params: GetRegistrationCodesParams = {}
): Promise<GetRegistrationCodesResponse> {
  const { p = 1, page_size = 10, ...filters } = params
  const searchParams = new URLSearchParams()
  searchParams.set('p', String(p))
  searchParams.set('page_size', String(page_size))

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      searchParams.set(key, String(value))
    }
  })

  const res = await api.get(`/api/registration-code/?${searchParams.toString()}`)
  return res.data
}

export async function searchRegistrationCodes(
  keyword: string,
  p = 1,
  page_size = 10
): Promise<GetRegistrationCodesResponse> {
  const res = await api.get(
    `/api/registration-code/search?keyword=${encodeURIComponent(keyword)}&p=${p}&page_size=${page_size}`
  )
  return res.data
}

export async function getRegistrationCode(
  id: number
): Promise<ApiResponse<RegistrationCode>> {
  const res = await api.get(`/api/registration-code/${id}`)
  return res.data
}

export async function createRegistrationCode(
  data: RegistrationCodeFormData
): Promise<ApiResponse<string[]>> {
  const res = await api.post('/api/registration-code/', data)
  return res.data
}

export async function updateRegistrationCode(
  data: RegistrationCodeFormData & { id: number }
): Promise<ApiResponse<RegistrationCode>> {
  const res = await api.put('/api/registration-code/', data)
  return res.data
}

export async function deleteRegistrationCode(
  id: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/registration-code/${id}`)
  return res.data
}

export async function batchDeleteRegistrationCodes(
  ids: number[]
): Promise<ApiResponse> {
  const res = await api.post('/api/registration-code/batch/delete', { ids })
  return res.data
}

export async function batchUpdateRegistrationCodeStatus(
  ids: number[],
  status: number
): Promise<ApiResponse> {
  const res = await api.post('/api/registration-code/batch/status', {
    ids,
    status,
  })
  return res.data
}

export async function getRegistrationCodeBatches(): Promise<
  ApiResponse<RegistrationCodeBatchSummary[]>
> {
  const res = await api.get('/api/registration-code/batches')
  return res.data
}

export async function getRegistrationCodeUsages(
  codeId: number
): Promise<ApiResponse<RegistrationCodeUsage[]>> {
  const res = await api.get(
    `/api/registration-code/usage?registration_code_id=${codeId}`
  )
  return res.data
}

export async function previewRegistrationCodeImport(
  data: FormData
): Promise<ApiResponse> {
  const res = await api.post('/api/registration-code/import/preview', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function importRegistrationCodes(
  data: FormData
): Promise<ApiResponse> {
  const res = await api.post('/api/registration-code/import', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
