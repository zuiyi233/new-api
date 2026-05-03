export type OIDCClientType = 'public' | 'confidential'

export interface OIDCClient {
  client_id: string
  name: string
  redirect_uris: string[]
  scopes: string[]
  client_type: OIDCClientType
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface OIDCSigningKey {
  kid: string
  alg: string
  public_jwk: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface OIDCClientFormValues {
  name: string
  redirectUrisText: string
  scopesText: string
  clientType: OIDCClientType
  enabled: boolean
}

export interface OIDCClientRequestPayload {
  name: string
  redirect_uris: string[]
  scopes: string[]
  client_type: OIDCClientType
  enabled?: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export const defaultOIDCClientFormValues: OIDCClientFormValues = {
  name: '',
  redirectUrisText: '',
  scopesText: 'openid profile email',
  clientType: 'confidential',
  enabled: true,
}

export function parseTextList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function stringifyTextList(values: string[]): string {
  return values.join('\n')
}

export function parseScopesText(value: string): string[] {
  const list = value
    .replace(/,/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (list.length === 0) {
    return ['openid', 'profile', 'email']
  }

  if (!list.includes('openid')) {
    return ['openid', ...list]
  }

  return list
}
