import { useEffect, useMemo, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Pencil, Plus, RefreshCw, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/status-badge'
import { SettingsSection } from '../../components/settings-section'
import {
  useActivateOIDCSigningKey,
  useCreateOIDCClient,
  useDeleteOIDCClient,
  useOIDCClients,
  useOIDCSigningKeys,
  useRotateOIDCClientSecret,
  useRotateOIDCSigningKey,
  useToggleOIDCClient,
  useUpdateOIDCClient,
} from './hooks'
import type {
  OIDCClient,
  OIDCClientFormValues,
  OIDCClientRequestPayload,
  OIDCSigningKey,
} from './types'
import {
  defaultOIDCClientFormValues,
  parseScopesText,
  parseTextList,
  stringifyTextList,
} from './types'

const clientFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  redirectUrisText: z.string().min(1, 'At least one redirect URI is required'),
  scopesText: z.string().min(1, 'Scopes are required'),
  clientType: z.enum(['public', 'confidential']),
  enabled: z.boolean(),
})

type ClientFormSchemaValues = z.infer<typeof clientFormSchema>

type OIDCClientFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingClient: OIDCClient | null
  onCreated: (clientId: string, clientSecret: string) => void
}

function parseClientFormToPayload(
  values: OIDCClientFormValues
): OIDCClientRequestPayload {
  return {
    name: values.name.trim(),
    redirect_uris: parseTextList(values.redirectUrisText),
    scopes: parseScopesText(values.scopesText),
    client_type: values.clientType,
    enabled: values.enabled,
  }
}

function OIDCClientFormDialog(props: OIDCClientFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = Boolean(props.editingClient)
  const createClient = useCreateOIDCClient()
  const updateClient = useUpdateOIDCClient()

  const form = useForm<ClientFormSchemaValues>({
    resolver: zodResolver(clientFormSchema) as unknown as Resolver<ClientFormSchemaValues>,
    defaultValues: defaultOIDCClientFormValues,
  })

  useEffect(() => {
    if (!props.open) {
      return
    }

    if (props.editingClient) {
      form.reset({
        name: props.editingClient.name,
        redirectUrisText: stringifyTextList(props.editingClient.redirect_uris),
        scopesText: props.editingClient.scopes.join(' '),
        clientType: props.editingClient.client_type,
        enabled: props.editingClient.enabled,
      })
      return
    }

    form.reset(defaultOIDCClientFormValues)
  }, [props.open, props.editingClient, form])

  const isPending = createClient.isPending || updateClient.isPending

  const handleSubmit = async (values: ClientFormSchemaValues) => {
    const payload = parseClientFormToPayload(values)

    if (isEditing && props.editingClient) {
      const res = await updateClient.mutateAsync({
        clientId: props.editingClient.client_id,
        payload,
      })
      if (res.success) {
        props.onOpenChange(false)
      }
      return
    }

    const res = await createClient.mutateAsync(payload)
    if (res.success && res.data?.client) {
      props.onCreated(res.data.client.client_id, res.data.client_secret || '')
      props.onOpenChange(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('Edit OIDC Client') : t('Create OIDC Client')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('Update third-party site OAuth credentials and redirect settings.')
              : t('Create a new OAuth client for a third-party project.')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Site Name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('e.g. xiaoye-ai-main')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='clientType'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Client Type')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='confidential'>
                        {t('Confidential (Server-side)')}
                      </SelectItem>
                      <SelectItem value='public'>
                        {t('Public (PKCE required)')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Public clients cannot use client_secret at token endpoint.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='redirectUrisText'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Redirect URIs')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('One URI per line, or separated by commas')}
                      className='min-h-24 font-mono text-xs'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Must exactly match redirect_uri in authorization code exchange.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='scopesText'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Allowed Scopes')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='openid profile email offline_access'
                      className='font-mono text-xs'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Separated by spaces or commas. openid will be injected automatically if missing.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>{t('Enabled')}</FormLabel>
                    <FormDescription>
                      {t('Only enabled clients can complete /oauth/token exchange.')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => props.onOpenChange(false)}
                disabled={isPending}
              >
                {t('Cancel')}
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending
                  ? t('Saving...')
                  : isEditing
                    ? t('Save')
                    : t('Create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function formatTime(value: string) {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return value
  }
  return new Date(timestamp).toLocaleString()
}

function maskSecret(value: string) {
  if (!value) {
    return '--'
  }
  if (value.length <= 10) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export function OIDCHubClientsSection() {
  const { t } = useTranslation()
  const clientsQuery = useOIDCClients()
  const signingKeysQuery = useOIDCSigningKeys()

  const rotateSecret = useRotateOIDCClientSecret()
  const toggleClient = useToggleOIDCClient()
  const deleteClient = useDeleteOIDCClient()

  const rotateSigningKey = useRotateOIDCSigningKey()
  const activateSigningKey = useActivateOIDCSigningKey()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<OIDCClient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OIDCClient | null>(null)
  const [secretDialog, setSecretDialog] = useState<{
    open: boolean
    clientId: string
    clientSecret: string
    hint: string
  }>({
    open: false,
    clientId: '',
    clientSecret: '',
    hint: '',
  })

  const clients = clientsQuery.data ?? []
  const signingKeys = signingKeysQuery.data ?? []

  const activeSigningKey = useMemo(
    () => signingKeys.find((key) => key.active) ?? null,
    [signingKeys]
  )

  const isLoading = clientsQuery.isLoading || signingKeysQuery.isLoading

  const openCreateDialog = () => {
    setEditingClient(null)
    setDialogOpen(true)
  }

  const openEditDialog = (client: OIDCClient) => {
    setEditingClient(client)
    setDialogOpen(true)
  }

  const onDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditingClient(null)
    }
  }

  const openSecretDialog = (payload: {
    clientId: string
    clientSecret: string
    hint: string
  }) => {
    setSecretDialog({
      open: true,
      clientId: payload.clientId,
      clientSecret: payload.clientSecret,
      hint: payload.hint,
    })
  }

  const closeSecretDialog = () => {
    setSecretDialog((prev) => ({ ...prev, open: false }))
  }

  const handleRotateSecret = async (client: OIDCClient) => {
    const res = await rotateSecret.mutateAsync(client.client_id)
    if (res.success && res.data?.client) {
      openSecretDialog({
        clientId: res.data.client.client_id,
        clientSecret: res.data.client_secret || '',
        hint: t('New client secret generated. Sync this value to the consumer immediately.'),
      })
    }
  }

  const handleToggleClient = async (client: OIDCClient) => {
    await toggleClient.mutateAsync({
      clientId: client.client_id,
      enabled: client.enabled,
    })
  }

  const handleDeleteClient = async () => {
    if (!deleteTarget) {
      return
    }
    await deleteClient.mutateAsync(deleteTarget.client_id)
    setDeleteTarget(null)
  }

  const handleRotateSigningKey = async () => {
    await rotateSigningKey.mutateAsync()
  }

  const handleActivateSigningKey = async (key: OIDCSigningKey) => {
    await activateSigningKey.mutateAsync(key.kid)
  }

  return (
    <div className='space-y-8'>
      <SettingsSection
        title={t('OIDC Hub Clients')}
        description={t('Manage OAuth clients for third-party projects that log in through this New API account system.')}
      >
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-muted-foreground text-sm'>
            {t('After creating or rotating a client secret, sync it to consumer backend immediately to avoid invalid_client.')}
          </p>
          <Button size='sm' onClick={openCreateDialog}>
            <Plus className='mr-1.5 h-4 w-4' />
            {t('Create OIDC Client')}
          </Button>
        </div>

        {isLoading ? (
          <div className='text-muted-foreground py-8 text-center text-sm'>
            {t('Loading...')}
          </div>
        ) : clients.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
            {t('No OIDC clients configured yet.')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Site Name')}</TableHead>
                <TableHead>{t('Client ID')}</TableHead>
                <TableHead>{t('Client Type')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Redirect URIs')}</TableHead>
                <TableHead>{t('Scopes')}</TableHead>
                <TableHead>{t('Updated At')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.client_id}>
                  <TableCell className='font-medium'>{client.name}</TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <span className='max-w-[220px] truncate font-mono text-xs'>
                        {client.client_id}
                      </span>
                      <CopyButton
                        value={client.client_id}
                        className='size-7'
                        iconClassName='size-3.5'
                        tooltip={t('Copy client ID')}
                        aria-label={t('Copy client ID')}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant='info'
                      label={
                        client.client_type === 'public'
                          ? t('Public (PKCE)')
                          : t('Confidential')
                      }
                      copyable={false}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={client.enabled ? 'success' : 'neutral'}
                      label={client.enabled ? t('Enabled') : t('Disabled')}
                      copyable={false}
                    />
                  </TableCell>
                  <TableCell className='max-w-[260px] whitespace-normal'>
                    <div className='space-y-1 text-xs'>
                      {client.redirect_uris.map((uri) => (
                        <code key={uri} className='bg-muted/40 block rounded px-1.5 py-0.5 break-all'>
                          {uri}
                        </code>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className='max-w-[200px] whitespace-normal'>
                    <span className='text-muted-foreground text-xs break-words'>
                      {client.scopes.join(' ')}
                    </span>
                  </TableCell>
                  <TableCell className='text-muted-foreground text-xs'>
                    {formatTime(client.updated_at)}
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-1'>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => openEditDialog(client)}
                        title={t('Edit')}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => handleRotateSecret(client)}
                        title={t('Rotate Secret')}
                        disabled={rotateSecret.isPending}
                      >
                        <RefreshCw className='h-4 w-4' />
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => handleToggleClient(client)}
                        title={client.enabled ? t('Disable') : t('Enable')}
                        disabled={toggleClient.isPending}
                      >
                        {client.enabled ? (
                          <ShieldOff className='h-4 w-4' />
                        ) : (
                          <ShieldCheck className='h-4 w-4' />
                        )}
                      </Button>
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => setDeleteTarget(client)}
                        title={t('Delete')}
                        disabled={deleteClient.isPending}
                      >
                        <Trash2 className='text-destructive h-4 w-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t('OIDC Signing Keys')}
        description={t('Manage OIDC token signing keys (JWKS). Rotate or activate keys when needed.')}
      >
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-muted-foreground text-sm'>
            {activeSigningKey
              ? t('Current active key: {{kid}}', { kid: activeSigningKey.kid })
              : t('No active signing key found.')}
          </p>
          <Button size='sm' onClick={handleRotateSigningKey} disabled={rotateSigningKey.isPending}>
            <RefreshCw className='mr-1.5 h-4 w-4' />
            {rotateSigningKey.isPending ? t('Rotating...') : t('Rotate Signing Key')}
          </Button>
        </div>

        {signingKeys.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
            {t('No signing keys available.')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Key ID (kid)')}</TableHead>
                <TableHead>{t('Algorithm')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Created At')}</TableHead>
                <TableHead>{t('Updated At')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signingKeys.map((key) => (
                <TableRow key={key.kid}>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <span className='max-w-[220px] truncate font-mono text-xs'>
                        {key.kid}
                      </span>
                      <CopyButton
                        value={key.kid}
                        className='size-7'
                        iconClassName='size-3.5'
                        tooltip={t('Copy key ID')}
                        aria-label={t('Copy key ID')}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{key.alg}</TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={key.active ? 'success' : 'neutral'}
                      label={key.active ? t('Active') : t('Inactive')}
                      copyable={false}
                    />
                  </TableCell>
                  <TableCell className='text-muted-foreground text-xs'>
                    {formatTime(key.created_at)}
                  </TableCell>
                  <TableCell className='text-muted-foreground text-xs'>
                    {formatTime(key.updated_at)}
                  </TableCell>
                  <TableCell className='text-right'>
                    {!key.active && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => handleActivateSigningKey(key)}
                        disabled={activateSigningKey.isPending}
                      >
                        {t('Activate')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SettingsSection>

      <OIDCClientFormDialog
        open={dialogOpen}
        onOpenChange={onDialogOpenChange}
        editingClient={editingClient}
        onCreated={(clientId, clientSecret) => {
          openSecretDialog({
            clientId,
            clientSecret,
            hint: t('Client created. Copy and save the secret now; it will not be shown again.'),
          })
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('Delete OIDC Client')}
        desc={t('Are you sure you want to delete client "{{name}}"? This cannot be undone.', {
          name: deleteTarget?.name ?? '',
        })}
        confirmText={t('Delete')}
        destructive
        handleConfirm={handleDeleteClient}
        isLoading={deleteClient.isPending}
      />

      <Dialog open={secretDialog.open} onOpenChange={closeSecretDialog}>
        <DialogContent className='sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>{t('OIDC Client Secret')}</DialogTitle>
            <DialogDescription>{secretDialog.hint}</DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-1'>
              <Label>{t('Client ID')}</Label>
              <div className='bg-muted/50 flex items-center justify-between gap-2 rounded-md border px-3 py-2'>
                <code className='max-w-[380px] truncate text-xs'>{secretDialog.clientId}</code>
                <CopyButton
                  value={secretDialog.clientId}
                  className='size-7'
                  iconClassName='size-3.5'
                  tooltip={t('Copy client ID')}
                  aria-label={t('Copy client ID')}
                />
              </div>
            </div>

            <div className='space-y-1'>
              <Label>{t('Client Secret')}</Label>
              <div className='bg-muted/50 flex items-center justify-between gap-2 rounded-md border px-3 py-2'>
                <code className='max-w-[380px] truncate text-xs'>
                  {maskSecret(secretDialog.clientSecret)}
                </code>
                <CopyButton
                  value={secretDialog.clientSecret}
                  className='size-7'
                  iconClassName='size-3.5'
                  tooltip={t('Copy client secret')}
                  aria-label={t('Copy client secret')}
                />
              </div>
              <p className='text-muted-foreground text-xs'>
                {t('If token exchange returns invalid_client, verify this secret and consumer .env are aligned.')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type='button' onClick={closeSecretDialog}>
              {t('I have copied it')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
