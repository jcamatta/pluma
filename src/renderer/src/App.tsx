// Root application component. Renders the app shell; feature UI is mounted from here.

import { useTranslation } from 'react-i18next'

export const App = (): React.JSX.Element => {
  const { t } = useTranslation()

  return <main className="font-ui text-text-primary">{t('appTitle')}</main>
}
