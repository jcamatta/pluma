// Root application component. Renders the app shell; feature UI is mounted from here.

import { EditorController } from './editor/Editor.controller'

export const App = (): React.JSX.Element => {
  return (
    <main className="h-screen font-ui text-text-primary">
      <EditorController />
    </main>
  )
}
