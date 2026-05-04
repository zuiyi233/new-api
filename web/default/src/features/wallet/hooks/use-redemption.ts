import { useState, useCallback } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import { getSelf } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { redeemCode } from '../api'

export function useRedemption() {
  const [redeeming, setRedeeming] = useState(false)

  const redeemCodeAction = useCallback(async (code: string): Promise<boolean> => {
    if (!code || code.trim() === '') {
      toast.error(i18next.t('Please enter a redemption code'))
      return false
    }

    try {
      setRedeeming(true)
      const response = await redeemCode({ key: code })

      if (response.success && response.data) {
        const result = response.data
        const messages: string[] = []

        if (result.quota && result.quota > 0) {
          messages.push(
            i18next.t('Quota added: {{quota}}', {
              quota: formatQuota(result.quota),
            })
          )
        }

        if (result.concurrency) {
          const concurrency = result.concurrency
          const concurrencyText =
            concurrency.mode === 'override'
              ? i18next.t('Override to {{value}}', { value: concurrency.value })
              : i18next.t('Stack +{{value}}', { value: concurrency.value })
          messages.push(
            i18next.t('Concurrency: {{detail}}, Effective limit: {{limit}}', {
              detail: concurrencyText,
              limit: concurrency.effective_limit,
            })
          )
        }

        if (result.subscription) {
          messages.push(
            i18next.t('Subscription activated: {{title}}', {
              title: result.subscription.plan_title,
            })
          )
        }

        if (messages.length === 0) {
          messages.push(result.message || i18next.t('Redemption successful'))
        }

        toast.success(messages.join('\n'))

        await getSelf()
        return true
      }

      toast.error(response.message || i18next.t('Redemption failed'))
      return false
    } catch (_error) {
      toast.error(i18next.t('Redemption failed'))
      return false
    } finally {
      setRedeeming(false)
    }
  }, [])

  return {
    redeeming,
    redeemCode: redeemCodeAction,
  }
}
