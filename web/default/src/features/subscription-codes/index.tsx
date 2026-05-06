import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { SubscriptionCodesProvider } from './components/subscription-codes-provider'
import { SubscriptionCodesPrimaryButtons } from './components/subscription-codes-primary-buttons'
import { SubscriptionCodesTable } from './components/subscription-codes-table'
import { SubscriptionCodesDialogs } from './components/subscription-codes-dialogs'

export function SubscriptionCodes() {
  const { t } = useTranslation()
  return (
    <SubscriptionCodesProvider>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Subscription Codes')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Manage subscription codes for user subscriptions')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <SubscriptionCodesPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <SubscriptionCodesTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <SubscriptionCodesDialogs />
    </SubscriptionCodesProvider>
  )
}
