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

// Two operations, named anchor field per operation — `passage` for a replace (the text it swaps out),
// `after` for an insert (the text it writes behind). A flat object, not a JSON Schema `oneOf`: models
// reliably fill flat top-level required fields but drop fields nested inside a oneOf branch (notably the
// shared `path`), so the discrimination lives in the field names and the handler, not in the schema shape.
const proposeEditTool: Tool = {
  name: 'propose_edit',
  description:
    "Propose an edit the user reviews inline and accepts or rejects; the change is not applied until accepted. Set operation to 'replace' to swap an existing passage for new text — give that passage in `passage`. Set operation to 'insert' to add new text without removing anything — give the passage to add it after in `after`, or omit `after` to add at the document start (including an empty document). Resolving `passage` or `after` returns not_found when it is absent and ambiguous when it occurs more than once — grow it until it is unique. Text from a proposal the user has not accepted yet is not in the document and cannot be used.",
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['path', 'operation', 'text'],
    properties: {
      path: { type: 'string', description: filePathDescription },
      operation: {
        type: 'string',
        enum: ['replace', 'insert'],
        description:
          "Required. 'replace' swaps the `passage` for the new text; 'insert' adds the new text after `after` (or at the document start when `after` is omitted)."
      },
      passage: {
        type: 'string',
        description:
          'For operation "replace": the exact existing passage to replace, copied verbatim from the document. Must occur exactly once.'
      },
      after: {
        type: 'string',
        description:
          'For operation "insert": the exact existing passage to insert the new text immediately after, copied verbatim from the document. Must occur exactly once. Omit it to insert at the very start of the document, including authoring into an empty document.'
      },
      text: {
        type: 'string',
        description:
          'The new text — the replacement for a replace, or the inserted text for an insert.'
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
