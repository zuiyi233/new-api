import { api } from '@/lib/api'
import type {
  ApiResponse,
  OIDCClient,
  OIDCClientRequestPayload,
  OIDCSigningKey,
} from './types'

function getAdminHeaders(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem('user')
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const token =
      parsed?.token ?? parsed?.access_token ?? parsed?.system_access_token

    if (typeof token === 'string' && token.trim() !== '') {
      return {
        'X-Admin-Token': token,
      }
    }
  } catch {
    // ignore local storage parse errors
  }

  return {}
}

function encodePath(value: string): string {
  return encodeURIComponent(value)
}

export async function listOIDCClients(): Promise<ApiResponse<OIDCClient[]>> {
  const res = await api.get('/api/oidc/clients/', {
    headers: getAdminHeaders(),
  })
  return res.data
}

export async function createOIDCClient(
  payload: OIDCClientRequestPayload
): Promise<
  ApiResponse<{
    client: OIDCClient
    client_secret: string
  }>
> {
  const res = await api.post('/api/oidc/clients/', payload, {
    headers: getAdminHeaders(),
  })
  return res.data
}

export async function updateOIDCClient(
  clientId: string,
  payload: OIDCClientRequestPayload
): Promise<ApiResponse<OIDCClient>> {
  const res = await api.put(`/api/oidc/clients/${encodePath(clientId)}`, payload, {
    headers: getAdminHeaders(),
  })
  return res.data
}

export async function rotateOIDCClientSecret(
  clientId: string
): Promise<
  ApiResponse<{
    client: OIDCClient
    client_secret: string
  }>
> {
  const res = await api.post(
    `/api/oidc/clients/${encodePath(clientId)}/rotate_secret`,
    {},
    {
      headers: getAdminHeaders(),
    }
  )
  return res.data
}

export async function enableOIDCClient(clientId: string): Promise<ApiResponse> {
  const res = await api.post(`/api/oidc/clients/${encodePath(clientId)}/enable`, {}, {
    headers: getAdminHeaders(),
  })
  return res.data
}

export async function disableOIDCClient(clientId: string): Promise<ApiResponse> {
  const res = await api.post(`/api/oidc/clients/${encodePath(clientId)}/disable`, {}, {
    headers: getAdminHeaders(),
  })
  return res.data
}

export async function deleteOIDCClient(clientId: string): Promise<ApiResponse> {
  const res = await api.delete(`/api/oidc/clients/${encodePath(clientId)}`, {
    headers: getAdminHeaders(),
  })
  return res.data
}

export async function listOIDCSigningKeys(): Promise<ApiResponse<OIDCSigningKey[]>> {
  const res = await api.get('/api/oidc/signing-keys/', {
    headers: getAdminHeaders(),
  })
  return res.data
}

export async function rotateOIDCSigningKey(): Promise<ApiResponse<OIDCSigningKey>> {
  const res = await api.post('/api/oidc/signing-keys/rotate', {}, {
    headers: getAdminHeaders(),
  })
  return res.data
}

export async function activateOIDCSigningKey(kid: string): Promise<ApiResponse<OIDCSigningKey>> {
  const res = await api.post(`/api/oidc/signing-keys/${encodePath(kid)}/activate`, {}, {
    headers: getAdminHeaders(),
  })
  return res.data
}
