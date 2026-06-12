// AG-UI `Tool` specs (data) for the five editor frontend tools — the renderer is the single source
// of these, and `agentToolSpecs` is what gets passed as `tools` on a run. Each `parameters` is
// authored JSON Schema directly (no Zod). The `name` ties the spec to its handler in the registry
// and to the `TOOL_CALL_START.toolCallName` the bridge matches, so it is never restated as a literal
// elsewhere. Ported from the reference `shared/agent/tools.ts`, with `inputSchema` renamed to AG-UI's
// `parameters` field.

import type { Tool } from '@ag-ui/core'
import { annotationSeverities } from '../../editor/extensions/annotations'

const filePathDescription =
  'Absolute path of the open file to act on, taken from list_open_files or a read-tool result.'

const listOpenFilesTool: Tool = {
  name: 'list_open_files',
  description:
    'List the files currently open in the editor — each with its absolute path, display name, and whether it is the file the user is active in. Use a returned path to address the acting tools; the set can change between turns, so check it again if a path is rejected.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {}
  }
}

const getCurrentSelectionTool: Tool = {
  name: 'get_current_selection',
  description: 'Return the current editor selection as text or Markdown.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {}
  }
}

const getCurrentDocumentTool: Tool = {
  name: 'get_current_document',
  description: 'Return the current editor document as Markdown.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {}
  }
}

const getRangesTool: Tool = {
  name: 'get_ranges',
  description:
    'Resolve exact document text to a tracked range id. Returns an error when the text is missing or ambiguous.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['path', 'text'],
    properties: {
      path: { type: 'string', description: filePathDescription },
      text: { type: 'string' }
    }
  }
}

const createAnnotationTool: Tool = {
  name: 'create_annotation',
  description:
    'Annotate a tracked range with a review note. Requires a rangeId from get_ranges. Returns an error when the range is missing or its text has changed.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['path', 'rangeId', 'label', 'description'],
    properties: {
      path: { type: 'string', description: filePathDescription },
      rangeId: { type: 'string' },
      label: { type: 'string' },
      description: { type: 'string' },
      severity: {
        type: 'string',
        enum: [...annotationSeverities],
        description:
          "How serious the note is. 'error' for a clear, significant problem; 'warning' for something worth attention or ambiguous; 'info' for a neutral observation or suggestion. Defaults to 'warning' when omitted."
      }
    }
  }
}

const proposeEditTool: Tool = {
  name: 'propose_edit',
  description:
    'Propose replacing a tracked range with new text. Requires a rangeId from get_ranges. The user reviews the edit inline and accepts or rejects it; the change is not applied until accepted. Returns an error when the range is missing or its text has changed.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['path', 'rangeId', 'replacementText'],
    properties: {
      path: { type: 'string', description: filePathDescription },
      rangeId: { type: 'string' },
      replacementText: { type: 'string' }
    }
  }
}

const agentToolSpecs: readonly Tool[] = [
  listOpenFilesTool,
  getCurrentSelectionTool,
  getCurrentDocumentTool,
  getRangesTool,
  createAnnotationTool,
  proposeEditTool
]

export {
  listOpenFilesTool,
  getCurrentSelectionTool,
  getCurrentDocumentTool,
  getRangesTool,
  createAnnotationTool,
  proposeEditTool,
  agentToolSpecs
}
