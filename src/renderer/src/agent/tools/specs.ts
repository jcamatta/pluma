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
  description:
    'Return the file path and the exact text the user currently has selected in the active editor, so you can act on it with propose_edit or create_annotation. The text is empty when there is no selection.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {}
  }
}

const getContentTool: Tool = {
  name: 'get_content',
  description:
    "Return an open file's full content as Markdown. Pass the path of the file to read, taken from list_open_files.",
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: { type: 'string', description: filePathDescription }
    }
  }
}

const createAnnotationTool: Tool = {
  name: 'create_annotation',
  description:
    'Annotate a passage with a review note. Pass the exact text of the passage, copied verbatim from the document. Returns not_found when the text is absent and ambiguous when it occurs more than once — grow the text until it is unique.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['path', 'text', 'label', 'description'],
    properties: {
      path: { type: 'string', description: filePathDescription },
      text: {
        type: 'string',
        description: 'The exact passage to annotate, copied verbatim. Must occur exactly once.'
      },
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
    'Propose replacing the exact passage with new text (Markdown). The user reviews the edit inline and accepts or rejects it; the change is not applied until accepted. Returns not_found when the passage is absent and ambiguous when it occurs more than once — grow the passage until it is unique.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['path', 'passage', 'text'],
    properties: {
      path: { type: 'string', description: filePathDescription },
      passage: {
        type: 'string',
        description: 'The exact passage to replace, copied verbatim. Must occur exactly once.'
      },
      text: {
        type: 'string',
        description: 'The new content as Markdown. May be multiple paragraphs, headings, or lists.'
      }
    }
  }
}

const agentToolSpecs: readonly Tool[] = [
  listOpenFilesTool,
  getCurrentSelectionTool,
  getContentTool,
  createAnnotationTool,
  proposeEditTool
]

export {
  listOpenFilesTool,
  getCurrentSelectionTool,
  getContentTool,
  createAnnotationTool,
  proposeEditTool,
  agentToolSpecs
}
