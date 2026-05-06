import type { MaintenanceSettings } from '../types'

export type HeaderNavPricingConfig = {
  enabled: boolean
  requireAuth: boolean
}

export type HeaderNavExternalLinkConfig = {
  enabled: boolean
  text: string
  url: string
}

export type HeaderNavModulesConfig = {
  home: boolean
  console: boolean
  pricing: HeaderNavPricingConfig
  docs: boolean
  about: boolean
  customExternalLink: HeaderNavExternalLinkConfig
  customExternalLinks: HeaderNavExternalLinkConfig[]
  [key: string]:
    | boolean
    | HeaderNavPricingConfig
    | HeaderNavExternalLinkConfig
    | HeaderNavExternalLinkConfig[]
}

export type SidebarSectionConfig = {
  enabled: boolean
  [key: string]: boolean
}

export type SidebarModulesAdminConfig = Record<string, SidebarSectionConfig>

export const HEADER_NAV_DEFAULT: HeaderNavModulesConfig = {
  home: true,
  console: true,
  pricing: {
    enabled: true,
    requireAuth: false,
  },
  docs: true,
  about: true,
  customExternalLink: {
    enabled: false,
    text: '',
    url: '',
  },
  customExternalLinks: [],
}

export const SIDEBAR_MODULES_DEFAULT: SidebarModulesAdminConfig = {
  chat: {
    enabled: true,
    playground: true,
    chat: true,
  },
  console: {
    enabled: true,
    detail: true,
    token: true,
    log: true,
    midjourney: true,
    task: true,
  },
  personal: {
    enabled: true,
    topup: true,
    personal: true,
  },
  admin: {
    enabled: true,
    channel: true,
    models: true,
    redemption: true,
    user: true,
    setting: true,
    subscription: true,
  },
}

export const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  Notice: '',
  LogConsumeEnabled: false,
  HeaderNavModules: JSON.stringify(HEADER_NAV_DEFAULT),
  SidebarModulesAdmin: JSON.stringify(SIDEBAR_MODULES_DEFAULT),
  'performance_setting.disk_cache_enabled': false,
  'performance_setting.disk_cache_threshold_mb': 10,
  'performance_setting.disk_cache_max_size_mb': 1024,
  'performance_setting.disk_cache_path': '',
  'performance_setting.monitor_enabled': false,
  'performance_setting.monitor_cpu_threshold': 90,
  'performance_setting.monitor_memory_threshold': 90,
  'performance_setting.monitor_disk_threshold': 95,
}

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return fallback
}

const cloneHeaderNavDefault = (): HeaderNavModulesConfig => ({
  ...HEADER_NAV_DEFAULT,
  pricing: { ...HEADER_NAV_DEFAULT.pricing },
  customExternalLink: { ...HEADER_NAV_DEFAULT.customExternalLink },
  customExternalLinks: [...HEADER_NAV_DEFAULT.customExternalLinks],
})

const normalizeExternalLink = (
  raw: unknown,
  fallback: HeaderNavExternalLinkConfig
): HeaderNavExternalLinkConfig => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback }
  }
  const link = raw as Record<string, unknown>
  return {
    enabled: toBoolean(link.enabled, fallback.enabled),
    text: typeof link.text === 'string' ? link.text.trim() : fallback.text,
    url: typeof link.url === 'string' ? link.url.trim() : fallback.url,
  }
}

const normalizeExternalLinks = (
  raw: unknown,
  fallback: HeaderNavExternalLinkConfig[]
): HeaderNavExternalLinkConfig[] => {
  if (!Array.isArray(raw)) {
    return [...fallback]
  }
  return raw
    .map((item) =>
      normalizeExternalLink(item, {
        enabled: false,
        text: '',
        url: '',
      })
    )
    .slice(0, 20)
}

const cloneSidebarDefault = (): SidebarModulesAdminConfig =>
  Object.entries(SIDEBAR_MODULES_DEFAULT).reduce<SidebarModulesAdminConfig>(
    (acc, [section, config]) => {
      acc[section] = { ...config }
      return acc
    },
    {}
  )

export function parseHeaderNavModules(
  value: string | null | undefined
): HeaderNavModulesConfig {
  const base = cloneHeaderNavDefault()
  if (!value) {
    return base
  }
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const result: HeaderNavModulesConfig = {
      ...base,
      pricing: { ...base.pricing },
      customExternalLink: { ...base.customExternalLink },
      customExternalLinks: [...base.customExternalLinks],
    }

    Object.entries(parsed).forEach(([key, raw]) => {
      if (key === 'pricing') {
        if (raw && typeof raw === 'object') {
          const rawPricing = raw as Record<string, unknown>
          result.pricing = {
            enabled: toBoolean(
              rawPricing.enabled,
              base.pricing?.enabled ?? true
            ),
            requireAuth: toBoolean(
              rawPricing.requireAuth,
              base.pricing?.requireAuth ?? false
            ),
          }
        }
        return
      }

      if (key === 'customExternalLink') {
        result.customExternalLink = normalizeExternalLink(
          raw,
          base.customExternalLink
        )
        return
      }

      if (key === 'customExternalLinks') {
        result.customExternalLinks = normalizeExternalLinks(
          raw,
          base.customExternalLinks
        )
        return
      }

      if (typeof raw === 'boolean') {
        result[key] = raw
        return
      }
      if (typeof raw === 'string' || typeof raw === 'number') {
        result[key] = toBoolean(raw, Boolean(base[key]))
        return
      }
    })

    if (
      result.customExternalLinks.length === 0 &&
      (result.customExternalLink.enabled ||
        result.customExternalLink.text !== '' ||
        result.customExternalLink.url !== '')
    ) {
      result.customExternalLinks = [{ ...result.customExternalLink }]
    }

    return result
  } catch {
    return base
  }
}

export function serializeHeaderNavModules(
  config: HeaderNavModulesConfig
): string {
  const customExternalLinks = normalizeExternalLinks(
    config.customExternalLinks,
    HEADER_NAV_DEFAULT.customExternalLinks
  )
  const fallbackExternalLink =
    customExternalLinks[0] ?? HEADER_NAV_DEFAULT.customExternalLink

  const normalized: HeaderNavModulesConfig = {
    ...config,
    home: toBoolean(config.home, HEADER_NAV_DEFAULT.home),
    console: toBoolean(config.console, HEADER_NAV_DEFAULT.console),
    docs: toBoolean(config.docs, HEADER_NAV_DEFAULT.docs),
    about: toBoolean(config.about, HEADER_NAV_DEFAULT.about),
    pricing: {
      enabled: toBoolean(config.pricing?.enabled, HEADER_NAV_DEFAULT.pricing.enabled),
      requireAuth: toBoolean(
        config.pricing?.requireAuth,
        HEADER_NAV_DEFAULT.pricing.requireAuth
      ),
    },
    customExternalLink: normalizeExternalLink(
      config.customExternalLink ?? fallbackExternalLink,
      fallbackExternalLink
    ),
    customExternalLinks,
  }

  return JSON.stringify(normalized)
}

export function parseSidebarModulesAdmin(
  value: string | null | undefined
): SidebarModulesAdminConfig {
  const defaults = cloneSidebarDefault()
  // If empty string, null, or undefined, use default config
  if (!value || value.trim() === '') return defaults

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const result: SidebarModulesAdminConfig = {}

    Object.entries(parsed).forEach(([sectionKey, raw]) => {
      if (!raw || typeof raw !== 'object') return

      const defaultSection = defaults[sectionKey] ?? { enabled: true }
      const sectionConfig: SidebarSectionConfig = {
        enabled: toBoolean(
          (raw as Record<string, unknown>).enabled,
          defaultSection.enabled ?? true
        ),
      }

      Object.entries(raw as Record<string, unknown>).forEach(
        ([moduleKey, moduleValue]) => {
          if (moduleKey === 'enabled') return
          sectionConfig[moduleKey] = toBoolean(
            moduleValue,
            defaultSection[moduleKey] ?? true
          )
        }
      )

      result[sectionKey] = sectionConfig
    })

    // Merge defaults to ensure expected sections exist
    Object.entries(defaults).forEach(([sectionKey, config]) => {
      if (!result[sectionKey]) {
        result[sectionKey] = { ...config }
        return
      }

      Object.entries(config).forEach(([moduleKey, moduleValue]) => {
        if (!(moduleKey in result[sectionKey])) {
          result[sectionKey][moduleKey] = moduleValue
        }
      })
    })

    return result
  } catch {
    return defaults
  }
}

export function serializeSidebarModulesAdmin(
  config: SidebarModulesAdminConfig
): string {
  return JSON.stringify(config)
}
