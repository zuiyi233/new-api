import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { toast } from 'sonner'
import {
  activateOIDCSigningKey,
  createOIDCClient,
  deleteOIDCClient,
  disableOIDCClient,
  enableOIDCClient,
  listOIDCClients,
  listOIDCSigningKeys,
  rotateOIDCClientSecret,
  rotateOIDCSigningKey,
  updateOIDCClient,
} from './api'
import type { OIDCClientRequestPayload } from './types'

const OIDC_CLIENTS_QUERY_KEY = ['oidc-hub-clients'] as const
const OIDC_SIGNING_KEYS_QUERY_KEY = ['oidc-signing-keys'] as const

function useInvalidateOIDCQueries() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: OIDC_CLIENTS_QUERY_KEY })
    queryClient.invalidateQueries({ queryKey: OIDC_SIGNING_KEYS_QUERY_KEY })
    queryClient.invalidateQueries({ queryKey: ['status'] })
  }
}

export function useOIDCClients() {
  return useQuery({
    queryKey: OIDC_CLIENTS_QUERY_KEY,
    queryFn: async () => {
      const res = await listOIDCClients()
      return res.data ?? []
    },
  })
}

export function useOIDCSigningKeys() {
  return useQuery({
    queryKey: OIDC_SIGNING_KEYS_QUERY_KEY,
    queryFn: async () => {
      const res = await listOIDCSigningKeys()
      return res.data ?? []
    },
  })
}

export function useCreateOIDCClient() {
  const invalidate = useInvalidateOIDCQueries()

  return useMutation({
    mutationFn: (payload: OIDCClientRequestPayload) => createOIDCClient(payload),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('OIDC client created successfully'))
        invalidate()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to create OIDC client'))
    },
  })
}

export function useUpdateOIDCClient() {
  const invalidate = useInvalidateOIDCQueries()

  return useMutation({
    mutationFn: ({
      clientId,
      payload,
    }: {
      clientId: string
      payload: OIDCClientRequestPayload
    }) => updateOIDCClient(clientId, payload),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('OIDC client updated successfully'))
        invalidate()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to update OIDC client'))
    },
  })
}

export function useToggleOIDCClient() {
  const invalidate = useInvalidateOIDCQueries()

  return useMutation({
    mutationFn: async ({
      clientId,
      enabled,
    }: {
      clientId: string
      enabled: boolean
    }) => {
      if (enabled) {
        return disableOIDCClient(clientId)
      }
      return enableOIDCClient(clientId)
    },
    onSuccess: (res, variables) => {
      if (res.success) {
        toast.success(
          variables.enabled
            ? i18next.t('OIDC client disabled successfully')
            : i18next.t('OIDC client enabled successfully')
        )
        invalidate()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to update OIDC client status'))
    },
  })
}

export function useDeleteOIDCClient() {
  const invalidate = useInvalidateOIDCQueries()

  return useMutation({
    mutationFn: (clientId: string) => deleteOIDCClient(clientId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('OIDC client deleted successfully'))
        invalidate()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to delete OIDC client'))
    },
  })
}

export function useRotateOIDCClientSecret() {
  const invalidate = useInvalidateOIDCQueries()

  return useMutation({
    mutationFn: (clientId: string) => rotateOIDCClientSecret(clientId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('OIDC client secret rotated successfully'))
        invalidate()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to rotate OIDC client secret'))
    },
  })
}

export function useRotateOIDCSigningKey() {
  const invalidate = useInvalidateOIDCQueries()

  return useMutation({
    mutationFn: () => rotateOIDCSigningKey(),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('OIDC signing key rotated successfully'))
        invalidate()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to rotate OIDC signing key'))
    },
  })
}

export function useActivateOIDCSigningKey() {
  const invalidate = useInvalidateOIDCQueries()

  return useMutation({
    mutationFn: (kid: string) => activateOIDCSigningKey(kid),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(i18next.t('OIDC signing key activated successfully'))
        invalidate()
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || i18next.t('Failed to activate OIDC signing key'))
    },
  })
}
