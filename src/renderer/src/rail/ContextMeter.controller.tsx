// Wires the context meter to the live agent: reads the AgentContextUsage off the agent's shared state
// and resolves the meter's i18n labels, rendering the plain ContextMeter. Renders nothing until a usage
// figure exists (a fresh thread that has not run yet), which keeps the composer toolbar clean.

import type { AbstractAgent } from '@ag-ui/client'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ContextMeter, type ContextMeterLabels } from './ContextMeter'
import { useAgentContextUsage } from './useAgentContextUsage'

function contextLabels(t: TFunction): ContextMeterLabels {
  return {
    context: t('rail.context.label'),
    title: t('rail.context.title'),
    input: t('rail.context.input'),
    cacheRead: t('rail.context.cacheRead'),
    cacheWrite: t('rail.context.cacheWrite')
  }
}

export function ContextMeterController({
  agent
}: {
  readonly agent: AbstractAgent
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const usage = useAgentContextUsage(agent)
  if (usage === undefined) return null
  return <ContextMeter usage={usage} labels={contextLabels(t)} />
}
