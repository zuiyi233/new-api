import { useMemo } from 'react'
import * as z from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

type SMTPProviderFormItem = {
  name: string
  server: string
  port: string
  ssl_enabled: boolean
  force_auth_login: boolean
  account: string
  from: string
  token: string
  monthly_limit: string
  weight: string
  cooldown_second: string
}

type SMTPProviderPersisted = {
  name?: string
  server: string
  port?: number
  ssl_enabled?: boolean
  force_auth_login?: boolean
  account: string
  from?: string
  token?: string
  monthly_limit?: number
  weight?: number
  cooldown_second?: number
}

const createEmailSchema = (t: (key: string) => string) =>
  z.object({
    SMTPServer: z.string(),
    SMTPPort: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^\d+$/.test(trimmed)
    }, t('Port must be a positive integer')),
    SMTPAccount: z.string(),
    SMTPFrom: z.string(),
    SMTPToken: z.string(),
    SMTPSSLEnabled: z.boolean(),
    SMTPForceAuthLogin: z.boolean(),
    SMTPMonthlyLimit: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^\d+$/.test(trimmed) && Number(trimmed) > 0
    }, t('Monthly limit must be a positive integer')),
    EmailVerificationIPRateLimitEnable: z.boolean(),
    EmailVerificationIPRateLimitNum: z.string().refine((value) => {
      const trimmed = value.trim()
      return /^\d+$/.test(trimmed)
    }, t('请输入不小于 0 的整数')),
    EmailVerificationIPRateLimitDuration: z.string().refine((value) => {
      const trimmed = value.trim()
      return /^\d+$/.test(trimmed)
    }, t('请输入不小于 0 的整数')),
    EmailVerificationEmailCooldownSeconds: z.string().refine((value) => {
      const trimmed = value.trim()
      return /^\d+$/.test(trimmed)
    }, t('请输入不小于 0 的整数')),
    EmailVerificationDailyLimitEnable: z.boolean(),
    EmailVerificationDailyLimit: z.string().refine((value) => {
      const trimmed = value.trim()
      return /^\d+$/.test(trimmed)
    }, t('请输入不小于 0 的整数')),
    SMTPProviders: z
      .array(
        z.object({
          name: z.string(),
          server: z.string().refine((value) => value.trim().length > 0, {
            message: t('SMTP host is required'),
          }),
          port: z.string().refine((value) => {
            const trimmed = value.trim()
            return /^\d+$/.test(trimmed) && Number(trimmed) > 0
          }, t('Port must be a positive integer')),
          ssl_enabled: z.boolean(),
          force_auth_login: z.boolean(),
          account: z.string().refine((value) => value.trim().length > 0, {
            message: t('Username is required'),
          }),
          from: z.string(),
          token: z.string(),
          monthly_limit: z.string().refine((value) => {
            const trimmed = value.trim()
            if (!trimmed) return true
            return /^\d+$/.test(trimmed) && Number(trimmed) > 0
          }, t('Monthly limit must be a positive integer')),
          weight: z.string().refine((value) => {
            const trimmed = value.trim()
            if (!trimmed) return true
            return /^\d+$/.test(trimmed) && Number(trimmed) > 0
          }, t('权重必须是大于 0 的整数')),
          cooldown_second: z.string().refine((value) => {
            const trimmed = value.trim()
            if (!trimmed) return true
            return /^\d+$/.test(trimmed) && Number(trimmed) > 0
          }, t('冷却时间必须是大于 0 的整数')),
        })
      )
      .min(1, t('At least one SMTP provider is required')),
  })

type EmailFormValues = z.infer<ReturnType<typeof createEmailSchema>>

type EmailSettingsSectionProps = {
  defaultValues: {
    SMTPServer: string
    SMTPPort: string
    SMTPAccount: string
    SMTPFrom: string
    SMTPToken: string
    SMTPSSLEnabled: boolean
    SMTPForceAuthLogin: boolean
    SMTPMonthlyLimit?: string
    SMTPProviders?: string
    EmailVerificationIPRateLimitEnable?: boolean
    EmailVerificationIPRateLimitNum?: string
    EmailVerificationIPRateLimitDuration?: string
    EmailVerificationEmailCooldownSeconds?: string
    EmailVerificationDailyLimitEnable?: boolean
    EmailVerificationDailyLimit?: string
  }
}

function normalizeStringValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function parseProvidersFromSettings(raw: string | undefined): SMTPProviderFormItem[] {
  if (!raw) {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as SMTPProviderPersisted[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => ({
        name: normalizeStringValue(item.name) || `provider-${index + 1}`,
        server: normalizeStringValue(item.server),
        port: item.port && item.port > 0 ? String(item.port) : '587',
        ssl_enabled: item.ssl_enabled ?? false,
        force_auth_login: item.force_auth_login ?? false,
        account: normalizeStringValue(item.account),
        from: normalizeStringValue(item.from),
        token: '',
        monthly_limit:
          item.monthly_limit && item.monthly_limit > 0
            ? String(item.monthly_limit)
            : '',
        weight: item.weight && item.weight > 0 ? String(item.weight) : '1',
        cooldown_second:
          item.cooldown_second && item.cooldown_second > 0
            ? String(item.cooldown_second)
            : '60',
      }))
      .filter((item) => item.server.trim() !== '' && item.account.trim() !== '')
  } catch {
    return []
  }
}

function buildProviderFormDefaults(
  values: EmailSettingsSectionProps['defaultValues']
): SMTPProviderFormItem[] {
  const parsedProviders = parseProvidersFromSettings(values.SMTPProviders)
  if (parsedProviders.length > 0) {
    return parsedProviders
  }
  return [
    {
      name: 'provider-1',
      server: values.SMTPServer ?? '',
      port: values.SMTPPort || '587',
      ssl_enabled: values.SMTPSSLEnabled ?? false,
      force_auth_login: values.SMTPForceAuthLogin ?? false,
      account: values.SMTPAccount ?? '',
      from: values.SMTPFrom ?? '',
      token: '',
      monthly_limit: '',
      weight: '1',
      cooldown_second: '60',
    },
  ]
}

function buildFormDefaults(
  values: EmailSettingsSectionProps['defaultValues']
): EmailFormValues {
  return {
    SMTPServer: values.SMTPServer ?? '',
    SMTPPort: values.SMTPPort ?? '',
    SMTPAccount: values.SMTPAccount ?? '',
    SMTPFrom: values.SMTPFrom ?? '',
    SMTPToken: '',
    SMTPSSLEnabled: values.SMTPSSLEnabled ?? false,
    SMTPForceAuthLogin: values.SMTPForceAuthLogin ?? false,
    SMTPMonthlyLimit: values.SMTPMonthlyLimit ?? '3000',
    EmailVerificationIPRateLimitEnable:
      values.EmailVerificationIPRateLimitEnable ?? true,
    EmailVerificationIPRateLimitNum: values.EmailVerificationIPRateLimitNum ?? '2',
    EmailVerificationIPRateLimitDuration:
      values.EmailVerificationIPRateLimitDuration ?? '30',
    EmailVerificationEmailCooldownSeconds:
      values.EmailVerificationEmailCooldownSeconds ?? '120',
    EmailVerificationDailyLimitEnable:
      values.EmailVerificationDailyLimitEnable ?? true,
    EmailVerificationDailyLimit: values.EmailVerificationDailyLimit ?? '180',
    SMTPProviders: buildProviderFormDefaults(values),
  }
}

function normalizeProviderForUpdate(
  provider: SMTPProviderFormItem,
  fallbackLimit: number,
  index: number
): SMTPProviderPersisted {
  const providerLimit = Number(provider.monthly_limit.trim())
  const providerWeight = Number(provider.weight.trim())
  const providerCooldownSecond = Number(provider.cooldown_second.trim())
  return {
    name: provider.name.trim() || `provider-${index + 1}`,
    server: provider.server.trim(),
    port: Number(provider.port.trim()) || 587,
    ssl_enabled: provider.ssl_enabled,
    force_auth_login: provider.force_auth_login,
    account: provider.account.trim(),
    from: provider.from.trim(),
    token: provider.token.trim(),
    monthly_limit:
      Number.isFinite(providerLimit) && providerLimit > 0
        ? providerLimit
        : fallbackLimit,
    weight:
      Number.isFinite(providerWeight) && providerWeight > 0 ? providerWeight : 1,
    cooldown_second:
      Number.isFinite(providerCooldownSecond) && providerCooldownSecond > 0
        ? providerCooldownSecond
        : 60,
  }
}

export function EmailSettingsSection({ defaultValues }: EmailSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const emailSchema = createEmailSchema(t)
  const formDefaults = useMemo(() => buildFormDefaults(defaultValues), [defaultValues])

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const providersFieldArray = useFieldArray({
    control: form.control,
    name: 'SMTPProviders',
  })

  const addProvider = () => {
    providersFieldArray.append({
      name: `provider-${providersFieldArray.fields.length + 1}`,
      server: '',
      port: '587',
      ssl_enabled: false,
      force_auth_login: false,
      account: '',
      from: '',
      token: '',
      monthly_limit: '',
      weight: '1',
      cooldown_second: '60',
    })
  }

  const onSubmit = async (values: EmailFormValues) => {
    const monthlyLimit = Number(values.SMTPMonthlyLimit.trim()) || 3000
    const ipRateLimitNum = Number(values.EmailVerificationIPRateLimitNum.trim())
    const ipRateLimitDuration = Number(
      values.EmailVerificationIPRateLimitDuration.trim()
    )
    const emailCooldownSeconds = Number(
      values.EmailVerificationEmailCooldownSeconds.trim()
    )
    const dailyLimit = Number(values.EmailVerificationDailyLimit.trim())
    const normalizedProviders = values.SMTPProviders.map((provider, index) =>
      normalizeProviderForUpdate(provider, monthlyLimit, index)
    )

    const validProviders = normalizedProviders.filter(
      (provider) => provider.server.trim() !== '' && provider.account.trim() !== ''
    )
    if (validProviders.length === 0) {
      toast.error(t('At least one valid SMTP provider is required'))
      return
    }

    const first = validProviders[0]
    const updates: Array<{ key: string; value: string | boolean }> = [
      { key: 'SMTPProviders', value: JSON.stringify(validProviders) },
      { key: 'SMTPMonthlyLimit', value: String(monthlyLimit) },
      { key: 'SMTPServer', value: first.server },
      { key: 'SMTPPort', value: String(first.port || 587) },
      { key: 'SMTPAccount', value: first.account },
      { key: 'SMTPFrom', value: first.from ?? '' },
      { key: 'SMTPSSLEnabled', value: first.ssl_enabled ?? false },
      { key: 'SMTPForceAuthLogin', value: first.force_auth_login ?? false },
      {
        key: 'EmailVerificationIPRateLimitEnable',
        value: values.EmailVerificationIPRateLimitEnable,
      },
      { key: 'EmailVerificationIPRateLimitNum', value: String(ipRateLimitNum) },
      {
        key: 'EmailVerificationIPRateLimitDuration',
        value: String(ipRateLimitDuration),
      },
      {
        key: 'EmailVerificationEmailCooldownSeconds',
        value: String(emailCooldownSeconds),
      },
      {
        key: 'EmailVerificationDailyLimitEnable',
        value: values.EmailVerificationDailyLimitEnable,
      },
      { key: 'EmailVerificationDailyLimit', value: String(dailyLimit) },
    ]

    if (first.token && first.token.trim() !== '') {
      updates.push({ key: 'SMTPToken', value: first.token.trim() })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection
      title={t('SMTP 邮箱')}
      description={t('配置系统发通知和验证码用的邮箱服务')}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
          autoComplete='off'
        >
          <FormField
            control={form.control}
            name='SMTPMonthlyLimit'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('每个账号默认每月可发多少封')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='off'
                    type='number'
                    placeholder='3000'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t('供应商没单独填上限时，就用这个默认值')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='space-y-4 rounded-lg border p-4'>
            <h4 className='text-sm font-medium'>{t('验证码防刷保护')}</h4>
            <p className='text-muted-foreground text-sm'>
              {t('用这几项控制发码节奏，防止用户反复点发送把额度打光。')}
            </p>

            <FormField
              control={form.control}
              name='EmailVerificationIPRateLimitEnable'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      {t('限制同一个网络短时间反复发码')}
                    </FormLabel>
                    <FormDescription>
                      {t('建议开启。关掉后，同一个 IP 可以高频触发发码。')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='grid gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='EmailVerificationIPRateLimitNum'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('同一网络最多可发次数')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        type='number'
                        min='0'
                        placeholder='2'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('例如填 2，表示在下面这个时间窗口里最多发 2 次。')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='EmailVerificationIPRateLimitDuration'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('统计这个次数的时间窗口（秒）')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        type='number'
                        min='0'
                        placeholder='30'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('例如填 30，就是 30 秒内最多发上面设置的次数。')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='EmailVerificationEmailCooldownSeconds'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('同一个邮箱再次发码要等多久（秒）')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      type='number'
                      min='0'
                      placeholder='120'
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('例如填 120，表示同一邮箱两次发码至少间隔 2 分钟。')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='EmailVerificationDailyLimitEnable'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                  <div className='space-y-0.5'>
                    <FormLabel className='text-base'>
                      {t('限制全站每天最多发多少封验证码')}
                    </FormLabel>
                    <FormDescription>
                      {t('建议开启。达到上限后，当天就不再发码，第二天自动恢复。')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='EmailVerificationDailyLimit'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('全站每天最多发码数量')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete='off'
                      type='number'
                      min='0'
                      placeholder='180'
                      {...field}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('比如你两家供应商总额度是 6000/月，建议先填 180，给波动留余量。')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <h4 className='text-sm font-medium'>{t('邮箱供应商列表')}</h4>
              <Button type='button' variant='outline' size='sm' onClick={addProvider}>
                {t('添加供应商')}
              </Button>
            </div>
            {providersFieldArray.fields.map((field, index) => (
              <div key={field.id} className='space-y-4 rounded-lg border p-4'>
                <div className='flex items-center justify-between'>
                  <p className='text-sm font-medium'>
                    {t('供应商')} #{index + 1}
                  </p>
                  {providersFieldArray.fields.length > 1 ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => providersFieldArray.remove(index)}
                    >
                      {t('删除')}
                    </Button>
                  ) : null}
                </div>

                <FormField
                  control={form.control}
                  name={`SMTPProviders.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('供应商备注名')}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete='off'
                          placeholder={t('sendflare-1')}
                          {...field}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.server`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('发信服务器地址')}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete='off'
                            placeholder={t('smtp.example.com')}
                            {...field}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.port`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('端口')}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete='off'
                            type='number'
                            placeholder='587'
                            {...field}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.account`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('登录账号')}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete='off'
                            placeholder={t('noreply@example.com')}
                            {...field}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.from`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('发件人邮箱')}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete='off'
                            placeholder={t('noreply@example.com')}
                            {...field}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.token`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('授权码 / 访问令牌')}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete='off'
                            type='password'
                            placeholder={t('留空=不改当前授权码')}
                            {...field}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('不需要更换就留空，系统会继续用原来的。')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.monthly_limit`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('这个账号每月最多发多少封')}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete='off'
                            type='number'
                            placeholder={t('留空=用上面的默认值')}
                            {...field}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('可不填，不填就自动用“每个账号默认每月可发多少封”。')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.weight`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('发码权重（越大分配越多）')}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete='off'
                            type='number'
                            placeholder='1'
                            min='1'
                            {...field}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('比如 A=3、B=1，大致会按 3:1 分配发码请求。')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.cooldown_second`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('失败后冷却时间（秒）')}</FormLabel>
                        <FormControl>
                          <Input
                            autoComplete='off'
                            type='number'
                            placeholder='60'
                            min='1'
                            {...field}
                            onChange={(event) => field.onChange(event.target.value)}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('这个供应商发信失败后，会先暂停这么久再参与轮询。')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.ssl_enabled`}
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-base'>{t('开启安全连接')}</FormLabel>
                          <FormDescription>
                            {t('一般建议开启，提升邮箱连接安全性。')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`SMTPProviders.${index}.force_auth_login`}
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                        <div className='space-y-0.5'>
                          <FormLabel className='text-base'>
                            {t('强制使用 AUTH LOGIN 登录')}
                          </FormLabel>
                          <FormDescription>
                            {t('只有你的邮箱服务商明确要求时再开启。')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? t('保存中...') : t('保存邮箱与发码设置')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
