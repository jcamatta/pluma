// The layering forces the run-failure vocabulary to be declared twice — the application may not import
// src/shared, and only the ipc layer may see both sides. This test is what keeps the two honest: adding
// a case to one union without the other turns the suite red. No production mapper exists, because the
// two sets are string-identical and translating would rebuild every RUN_ERROR into the same object.

import { describe, expect, it } from 'vitest'
import { RUN_FAILURES } from '../../../application/agent/data/run-failure'
import { AGENT_RUN_FAILURES } from '../../../../shared/ipc/ipc-event-contract/agent-run-failure'

describe('run failure vocabularies', () => {
  it('declares the same cases in the domain and on the wire', () => {
    expect([...RUN_FAILURES]).toEqual([...AGENT_RUN_FAILURES])
  })
})
