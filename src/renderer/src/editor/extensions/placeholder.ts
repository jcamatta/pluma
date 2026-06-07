// Empty-node placeholder text. Resolved by ProseMirror outside React, so it reads the i18n singleton
// directly rather than the useTranslation hook.

import { Placeholder, type PlaceholderOptions } from '@tiptap/extensions/placeholder'
import { i18n } from '../../i18n'

type PlaceholderResolver = Extract<PlaceholderOptions['placeholder'], (...args: never[]) => string>

const getPlaceholder: PlaceholderResolver = ({ node }) => {
  if (node.type.name === 'heading') {
    return i18n.t('editor.placeholder.heading', { level: node.attrs.level })
  }

  if (node.type.name === 'blockquote') {
    return i18n.t('editor.placeholder.quote')
  }

  if (node.type.name === 'codeBlock') {
    return i18n.t('editor.placeholder.code')
  }

  return i18n.t('editor.placeholder.default')
}

const PlaceholderExtension = Placeholder.configure({
  emptyEditorClass: 'is-editor-empty',
  emptyNodeClass: 'is-empty',
  dataAttribute: 'placeholder',
  showOnlyWhenEditable: true,
  placeholder: getPlaceholder
})

export { getPlaceholder, PlaceholderExtension }
