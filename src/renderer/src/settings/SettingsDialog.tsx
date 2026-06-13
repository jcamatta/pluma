// The Settings modal, ported from the write-write settings dialog but rendered in Pluma's own tokens
// (App.css palette). A Base UI Dialog: a dimmed backdrop and a centered popup card holding the settings
// fields. Today it carries one field — the appearance theme (light/dark/system) — as a segmented radio
// control. Open/close is animated: Base UI keeps the popup mounted through its exit and exposes
// data-starting-style/data-ending-style on the backdrop and popup, which the transition utilities below
// hook into so the card fades + scales in and out. Pure props: open state and the settings store come
// from the app shell, which owns the single useSettings instance.

import { Dialog } from '@base-ui/react/dialog'
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../components/IconButton'
import { isLanguage, isTheme, type Language, type Theme } from './settings'
import type { UseSettings } from './useSettings'

type SettingsDialogProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly settings: UseSettings
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings
}: SettingsDialogProps): React.JSX.Element {
  const { t } = useTranslation()

  const themeOptions: SegmentedOption<Theme>[] = [
    { label: t('settings.theme.light'), value: 'light' },
    { label: t('settings.theme.dark'), value: 'dark' },
    { label: t('settings.theme.system'), value: 'system' }
  ]

  const languageOptions: SegmentedOption<Language>[] = [
    { label: t('settings.language.en'), value: 'en' },
    { label: t('settings.language.es'), value: 'es' }
  ]

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-overlay transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 flex h-160 max-h-[90vh] w-190 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-surface-3 p-8 font-ui text-text-primary shadow-2xl transition-all duration-200 select-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="mb-8 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold text-text-primary">
              {t('settings.title')}
            </Dialog.Title>
            <IconButton
              label={t('settings.close')}
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-2"
            >
              <X size={17} />
            </IconButton>
          </div>

          <div className="flex flex-col gap-6">
            <Field title={t('settings.theme.title')} description={t('settings.theme.description')}>
              <SegmentedField
                isValid={isTheme}
                onValueChange={settings.setTheme}
                options={themeOptions}
                value={settings.theme}
              />
            </Field>
            <Field
              title={t('settings.language.title')}
              description={t('settings.language.description')}
            >
              <SegmentedField
                isValid={isLanguage}
                onValueChange={settings.setLanguage}
                options={languageOptions}
                value={settings.language}
              />
            </Field>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type FieldProps = {
  readonly title: string
  readonly description: string
  readonly children: React.ReactNode
}

function Field({ title, description, children }: FieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        <div className="text-sm text-text-secondary">{description}</div>
      </div>
      {children}
    </div>
  )
}

type SegmentedOption<T extends string> = {
  readonly value: T
  readonly label: string
}

type SegmentedFieldProps<T extends string> = {
  readonly value: T
  readonly options: readonly SegmentedOption<T>[]
  readonly onValueChange: (value: T) => void
  readonly isValid: (value: string | null) => value is T
}

// Generic over the option's value type (Theme, Language, …). The guard drops a stray value rather than
// writing it through, so onValueChange only ever receives a valid T.
function SegmentedField<T extends string>({
  value,
  options,
  onValueChange,
  isValid
}: SegmentedFieldProps<T>): React.JSX.Element {
  return (
    <RadioGroup
      className="inline-flex gap-1 rounded-xl border border-border bg-surface-1 p-1"
      onValueChange={(next) => {
        if (isValid(next)) onValueChange(next)
      }}
      value={value}
    >
      {options.map((option) => (
        <Radio.Root
          className="cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary outline-none transition-colors data-checked:bg-surface-3 data-checked:text-text-primary data-checked:shadow-sm"
          key={option.value}
          value={option.value}
        >
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
