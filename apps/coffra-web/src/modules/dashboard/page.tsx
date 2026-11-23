import type { Metadata } from 'next'

import { getScopedI18n } from '@/i18n/server'
import type { WebPage } from '@/shared/types'

/**
 * Builds the dashboard's metadata from the dictionary of the current locale.
 *
 * @returns The page title.
 */
export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getScopedI18n('dashboard')

  return {
    title: t('title'),
  }
}

/**
 * The dashboard at the locale root. Only the heading for now; the data, the band, the charts and the lists follow.
 *
 * @returns The page.
 */
export const DashboardPage: WebPage = async () => {
  const t = await getScopedI18n('dashboard')

  return (
    <main>
      <h1>{t('title')}</h1>
    </main>
  )
}
