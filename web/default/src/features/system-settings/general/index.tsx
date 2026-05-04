import { useParams } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { parseCurrencyDisplayType } from '@/lib/currency'
import { useSystemOptions, getOptionValue } from '../hooks/use-system-options'
import type { GeneralSettings } from '../types'
import {
  GENERAL_DEFAULT_SECTION,
  getGeneralSectionContent,
} from './section-registry.tsx'

const defaultGeneralSettings: GeneralSettings = {
  'theme.frontend': 'default',
  Notice: '',
  SystemName: 'New API',
  Logo: '',
  Footer: '',
  About: '',
  HomePageContent: '',
  ServerAddress: '',
  'legal.user_agreement': '',
  'legal.privacy_policy': '',
  QuotaForNewUser: 0,
  PreConsumedQuota: 0,
  QuotaForInviter: 0,
  QuotaForInvitee: 0,
  TopUpLink: '',
  'general_setting.docs_link': '',
  'quota_setting.enable_free_model_pre_consume': true,
  QuotaPerUnit: 500000,
  USDExchangeRate: 7,
  'general_setting.quota_display_type': 'USD',
  'general_setting.custom_currency_symbol': '¤',
  'general_setting.custom_currency_exchange_rate': 1,
  RetryTimes: 0,
  DisplayInCurrencyEnabled: true,
  DisplayTokenStatEnabled: true,
  DefaultCollapseSidebar: false,
  DemoSiteEnabled: false,
  SelfUseModeEnabled: false,
  'checkin_setting.enabled': false,
  'checkin_setting.entry_min_balance_quota': 0,
  'checkin_setting.entry_max_balance_quota': 49,
  'checkin_setting.entry_min_quota': 0.01,
  'checkin_setting.entry_max_quota': 0.2,
  'checkin_setting.entry_reward_bands':
    '[{"min_quota":0.01,"max_quota":0.05,"weight":72},{"min_quota":0.05,"max_quota":0.12,"weight":23},{"min_quota":0.12,"max_quota":0.2,"weight":5}]',
  'checkin_setting.min_quota': 0.05,
  'checkin_setting.max_quota': 1,
  'checkin_setting.basic_min_balance_quota': 50,
  'checkin_setting.basic_max_balance_quota': 85,
  'checkin_setting.basic_reward_bands':
    '[{"min_quota":0.05,"max_quota":0.2,"weight":70},{"min_quota":0.2,"max_quota":0.6,"weight":25},{"min_quota":0.6,"max_quota":1,"weight":5}]',
  'checkin_setting.advanced_enabled': true,
  'checkin_setting.advanced_min_balance_quota': 100,
  'checkin_setting.advanced_max_balance_quota': 150,
  'checkin_setting.advanced_min_quota': 0.5,
  'checkin_setting.advanced_max_quota': 5,
  'checkin_setting.advanced_reward_bands':
    '[{"min_quota":0.5,"max_quota":1.5,"weight":65},{"min_quota":1.5,"max_quota":3,"weight":30},{"min_quota":3,"max_quota":5,"weight":5}]',
  'checkin_setting.min_interval_hours': 24,
  'checkin_setting.weekly_reward_cap_quota': 3,
  'checkin_setting.reward_rule': 'highest_eligible',
  'lottery_setting.enabled': false,
  'lottery_setting.basic_tier_multiplier': 0.6,
  'lottery_setting.medium_tier_multiplier': 1,
  'lottery_setting.advanced_tier_multiplier': 1.8,
  'channel_affinity_setting.enabled': false,
  'channel_affinity_setting.switch_on_success': true,
  'channel_affinity_setting.max_entries': 100000,
  'channel_affinity_setting.default_ttl_seconds': 3600,
  'channel_affinity_setting.rules': '[]',
}

export function GeneralSettings() {
  const { t } = useTranslation()
  const { data, isLoading } = useSystemOptions()
  const params = useParams({
    from: '/_authenticated/system-settings/general/$section',
  })

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-muted-foreground'>{t('Loading settings...')}</div>
      </div>
    )
  }

  const settings = getOptionValue(data?.data, defaultGeneralSettings)
  const quotaDisplayType = parseCurrencyDisplayType(
    settings['general_setting.quota_display_type']
  )
  const activeSection = (params?.section ?? GENERAL_DEFAULT_SECTION) as
    | 'system-info'
    | 'quota'
    | 'pricing'
    | 'checkin'
    | 'behavior'
    | 'channel-affinity'
  const sectionContent = getGeneralSectionContent(
    activeSection,
    settings,
    quotaDisplayType
  )

  return (
    <div className='flex h-full w-full flex-1 flex-col'>
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <div className='space-y-4'>{sectionContent}</div>
      </div>
    </div>
  )
}
