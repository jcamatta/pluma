// Bridges a single editor's active-annotation plugin state to the floating note card. The annotations
// plugin's handleClickOn sets the clicked annotation as the cross-type active suggestion (in plugin
// state); this controller subscribes to that editor's transactions, and whenever an annotation is the
// active suggestion it measures the passage's screen rect via the view's coordsAtPos, clamps it to the
// viewport, and renders the card there. Card open/anchor is therefore derived from plugin state — no
// duplicated React open flag. Closing (Esc, outside-click, or Got it) clears the active suggestion, which
// drops the active annotation and so closes the card; Got it also marks the note read first.

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import {
  getActiveAnnotationId,
  getAnnotations,
  markAnnotationRead,
  setActiveAnnotation,
  type Annotation
} from './extensions/annotations'
import { clampCardPosition } from './annotation-card-logic'
import { AnnotationCard } from './AnnotationCard.view'

interface AnnotationCardControllerProps {
  readonly editor: Editor
}

interface OpenCard {
  readonly annotation: Annotation
  readonly top: number
  readonly left: number
}

interface Snapshot {
  readonly state: EditorState | null
  readonly value: OpenCard | null
}

function readOpenCard(editor: Editor): OpenCard | null {
  const activeId = getActiveAnnotationId(editor)
  if (activeId === null) return null
  const annotation = getAnnotations(editor).find((candidate) => candidate.id === activeId)
  if (!annotation) return null

  const rect = editor.view.coordsAtPos(annotation.from)
  const { top, left } = clampCardPosition(rect, {
    width: window.innerWidth,
    height: window.innerHeight
  })
  return { annotation, top, left }
}

function AnnotationCardController({ editor }: AnnotationCardControllerProps): React.JSX.Element {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion() ?? false
  const cache = useRef<Snapshot>({ state: null, value: null })

  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      editor.on('transaction', onStoreChange)
      return () => editor.off('transaction', onStoreChange)
    },
    [editor]
  )

  const getSnapshot = useCallback((): OpenCard | null => {
    if (cache.current.state !== editor.state) {
      cache.current = { state: editor.state, value: readOpenCard(editor) }
    }
    return cache.current.value
  }, [editor])

  const open = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const close = useCallback(() => setActiveAnnotation({ editor, id: null }), [editor])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  return (
    <AnimatePresence>
      {open && (
        <Outside onOutside={close}>
          <AnnotationCard
            label={open.annotation.label}
            severity={open.annotation.severity}
            quote={open.annotation.quote}
            description={open.annotation.description}
            status={open.annotation.status}
            top={open.top}
            left={open.left}
            reduceMotion={reduceMotion}
            labels={{
              title: t('editor.annotationCard.title'),
              severity: t(`editor.annotationCard.severity.${open.annotation.severity}`),
              gotIt: t('editor.annotationCard.gotIt'),
              read: t('editor.annotationCard.read')
            }}
            onGotIt={() => {
              markAnnotationRead({ editor, id: open.annotation.id })
              close()
            }}
          />
        </Outside>
      )}
    </AnimatePresence>
  )
}

// Wraps the card so a pointerdown anywhere outside it closes it. The annotation click that opens the card
// is a ProseMirror handleClickOn (no document mousedown reaches here from it), so this listener only fires
// on genuine outside dismissals.
function Outside({
  onOutside,
  children
}: {
  readonly onOutside: () => void
  readonly children: React.ReactNode
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      const node = ref.current
      if (node && event.target instanceof Node && !node.contains(event.target)) onOutside()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [onOutside])
  return <div ref={ref}>{children}</div>
}

export { AnnotationCardController }
export type { AnnotationCardControllerProps }
