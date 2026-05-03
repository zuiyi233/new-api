import { useEffect, useMemo } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { PlusIcon, Trash2Icon } from 'lucide-react'
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
import { useUpdateOption } from '../hooks/use-update-option'
import {
  HEADER_NAV_DEFAULT,
  type HeaderNavModulesConfig,
  serializeHeaderNavModules,
} from './config'

const externalLinkItemSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim(),
  url: z.string().trim(),
})

const headerNavSchema = z.object({
  home: z.boolean(),
  console: z.boolean(),
  pricingEnabled: z.boolean(),
  pricingRequireAuth: z.boolean(),
  docs: z.boolean(),
  about: z.boolean(),
  customExternalLinks: z.array(externalLinkItemSchema).max(20),
})

type HeaderNavFormValues = z.infer<typeof headerNavSchema>

type HeaderNavigationSectionProps = {
  config: HeaderNavModulesConfig
  initialSerialized: string
}

const MODULE_FIELD_NAMES = ['home', 'console', 'docs', 'about'] as const
type ModuleFieldName = (typeof MODULE_FIELD_NAMES)[number]

const toFormValues = (config: HeaderNavModulesConfig): HeaderNavFormValues => ({
  home:
    config.home === undefined ? HEADER_NAV_DEFAULT.home : Boolean(config.home),
  console:
    config.console === undefined
      ? HEADER_NAV_DEFAULT.console
      : Boolean(config.console),
  pricingEnabled:
    config.pricing?.enabled === undefined
      ? HEADER_NAV_DEFAULT.pricing.enabled
      : Boolean(config.pricing.enabled),
  pricingRequireAuth:
    config.pricing?.requireAuth === undefined
      ? HEADER_NAV_DEFAULT.pricing.requireAuth
      : Boolean(config.pricing.requireAuth),
  docs:
    config.docs === undefined ? HEADER_NAV_DEFAULT.docs : Boolean(config.docs),
  about:
    config.about === undefined
      ? HEADER_NAV_DEFAULT.about
      : Boolean(config.about),
  customExternalLinks:
    config.customExternalLinks.length > 0
      ? config.customExternalLinks.map((item) => ({
          enabled: Boolean(item.enabled),
          text: typeof item.text === 'string' ? item.text : '',
          url: typeof item.url === 'string' ? item.url : '',
        }))
      : config.customExternalLink
          ? [
              {
                enabled: Boolean(config.customExternalLink.enabled),
                text:
                  typeof config.customExternalLink.text === 'string'
                    ? config.customExternalLink.text
                    : '',
                url:
                  typeof config.customExternalLink.url === 'string'
                    ? config.customExternalLink.url
                    : '',
              },
            ]
          : [],
})

export function HeaderNavigationSection({
  config,
  initialSerialized,
}: HeaderNavigationSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const formDefaults = useMemo(() => toFormValues(config), [config])

  const form = useForm<HeaderNavFormValues>({
    resolver: zodResolver(headerNavSchema),
    defaultValues: formDefaults,
  })

  const customExternalLinks = form.watch('customExternalLinks')

  useEffect(() => {
    form.reset(formDefaults)
  }, [formDefaults, form])

  const onSubmit = async (values: HeaderNavFormValues) => {
    const payload: HeaderNavModulesConfig = {
      ...config,
      home: values.home,
      console: values.console,
      docs: values.docs,
      about: values.about,
      pricing: {
        ...(config.pricing ?? HEADER_NAV_DEFAULT.pricing),
        enabled: values.pricingEnabled,
        requireAuth: values.pricingRequireAuth,
      },
      customExternalLinks: values.customExternalLinks.map((item) => ({
        enabled: Boolean(item.enabled),
        text: item.text.trim(),
        url: item.url.trim(),
      })),
      customExternalLink:
        values.customExternalLinks[0] ??
        config.customExternalLink ??
        HEADER_NAV_DEFAULT.customExternalLink,
    }

    const serialized = serializeHeaderNavModules(payload)
    if (serialized === initialSerialized) {
      return
    }

    await updateOption.mutateAsync({
      key: 'HeaderNavModules',
      value: serialized,
    })
  }

  const resetToDefault = () => {
    form.reset(toFormValues(HEADER_NAV_DEFAULT))
  }

  const addCustomExternalLink = () => {
    const current = form.getValues('customExternalLinks')
    if (current.length >= 20) {
      return
    }
    form.setValue(
      'customExternalLinks',
      [...current, { enabled: false, text: '', url: '' }],
      {
        shouldDirty: true,
        shouldTouch: true,
      }
    )
  }

  const removeCustomExternalLink = (index: number) => {
    const current = form.getValues('customExternalLinks')
    const next = current.filter((_, i) => i !== index)
    form.setValue('customExternalLinks', next, {
      shouldDirty: true,
      shouldTouch: true,
    })
  }

  const modules: Array<{
    key: ModuleFieldName
    title: string
    description: string
  }> = MODULE_FIELD_NAMES.map((key) => ({
    key,
    title:
      key === 'home'
        ? t('Home')
        : key === 'console'
          ? t('Console')
          : key === 'docs'
            ? t('Docs')
            : t('About'),
    description:
      key === 'home'
        ? t('Landing page with system overview.')
        : key === 'console'
          ? t('User dashboard and quota controls.')
          : key === 'docs'
            ? t('Documentation or external knowledge base.')
            : t('Static page describing the platform.'),
  }))

  return (
    <SettingsSection
      title={t('Header navigation')}
      description={t('Enable or disable top navigation modules globally.')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <div className='grid gap-4 md:grid-cols-2'>
            {modules.map((module) => (
              <FormField
                key={module.key}
                control={form.control}
                name={module.key}
                render={({ field }) => (
                  <FormItem className='flex flex-row items-start justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5 pe-4'>
                      <FormLabel className='text-base'>
                        {module.title}
                      </FormLabel>
                      <FormDescription>{module.description}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>

          <div className='rounded-lg border p-4'>
            <FormField
              control={form.control}
              name='pricingEnabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-start justify-between rounded-lg border p-4'>
                  <div className='space-y-0.5 pe-4'>
                    <FormLabel className='text-base'>
                      {t('Models directory')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Exposes the pricing/models catalog in the top navigation.'
                      )}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='pricingRequireAuth'
              render={({ field }) => (
                <FormItem className='mt-4 flex flex-row items-start justify-between rounded-lg border border-dashed p-4'>
                  <div className='space-y-0.5 pe-4'>
                    <FormLabel className='text-base'>
                      {t('Require login to view models')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Visitors must authenticate before accessing the pricing directory.'
                      )}
                    </FormDescription>
                  </div>
                  <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!form.watch('pricingEnabled')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
          </div>

          <div className='rounded-lg border p-4'>
            <div className='mb-4 flex items-center justify-between gap-3'>
              <div>
                <h4 className='text-base font-medium'>
                  {t('Custom external links')}
                </h4>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Show configurable top navigation external links with custom names and URLs.'
                  )}
                </p>
              </div>
              <Button
                type='button'
                variant='outline'
                onClick={addCustomExternalLink}
                disabled={customExternalLinks.length >= 20}
              >
                <PlusIcon className='mr-2 h-4 w-4' />
                {t('Add external link')}
              </Button>
            </div>

            <div className='space-y-3'>
              {customExternalLinks.length === 0 && (
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'No external links configured. Click "Add external link" to create one.'
                  )}
                </p>
              )}

              {customExternalLinks.map((_, index) => (
                <div
                  key={`external-link-${index}`}
                  className='space-y-3 rounded-lg border p-3'
                >
                  <div className='flex items-center justify-between gap-3'>
                    <span className='text-sm font-medium'>
                      {t('External link')} #{index + 1}
                    </span>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      onClick={() => removeCustomExternalLink(index)}
                      aria-label={t('Remove external link')}
                    >
                      <Trash2Icon className='h-4 w-4' />
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name={`customExternalLinks.${index}.enabled`}
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-start justify-between rounded-lg border p-3'>
                        <div className='space-y-0.5 pe-4'>
                          <FormLabel className='text-sm'>
                            {t('Enable external link')}
                          </FormLabel>
                          <FormDescription>
                            {t('Only enabled links can appear in top navigation.')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className='grid gap-3 md:grid-cols-2'>
                    <FormField
                      control={form.control}
                      name={`customExternalLinks.${index}.text`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Navigation name')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                'Navigation name, e.g. Store'
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`customExternalLinks.${index}.url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('External URL')}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                'External URL, e.g. https://example.com'
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Only when enabled, name is non-empty, and URL starts with http:// or https:// will this link be shown in top navigation.'
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className='flex flex-wrap gap-3'>
            <Button type='button' variant='outline' onClick={resetToDefault}>
              {t('Reset to default')}
            </Button>
            <Button type='submit' disabled={updateOption.isPending}>
              {updateOption.isPending ? t('Saving...') : t('Save navigation')}
            </Button>
          </div>
        </form>
      </Form>
    </SettingsSection>
  )
}
