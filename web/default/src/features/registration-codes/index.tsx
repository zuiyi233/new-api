import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { RegistrationCodesProvider } from './components/registration-codes-provider'
import { RegistrationCodesPrimaryButtons } from './components/registration-codes-primary-buttons'
import { RegistrationCodesTable } from './components/registration-codes-table'
import { RegistrationCodesDialogs } from './components/registration-codes-dialogs'

export function RegistrationCodes() {
  const { t } = useTranslation()
  return (
    <RegistrationCodesProvider>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Registration Codes')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Manage registration codes for user registration')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <RegistrationCodesPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <RegistrationCodesTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <RegistrationCodesDialogs />
    </RegistrationCodesProvider>
  )
}
