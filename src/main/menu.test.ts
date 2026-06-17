import { describe, expect, it } from 'vitest'
import { buildMenuTemplate } from './menu'

const roles = (template: ReturnType<typeof buildMenuTemplate>): Array<string | undefined> =>
  template.map((item) => item.role)

const viewSubmenuRoles = (
  template: ReturnType<typeof buildMenuTemplate>
): Array<string | undefined> => {
  const view = template.find((item) => item.label === 'View')
  return Array.isArray(view?.submenu) ? view.submenu.map((item) => item.role) : []
}

describe('buildMenuTemplate', () => {
  it('on darwin includes appMenu, editMenu and a zoom View submenu', () => {
    const template = buildMenuTemplate('darwin')

    expect(roles(template)).toContain('appMenu')
    expect(roles(template)).toContain('editMenu')
    expect(viewSubmenuRoles(template)).toStrictEqual(['resetZoom', 'zoomIn', 'zoomOut'])
  })

  it.each(['win32', 'linux'] as const)(
    'on %s includes editMenu and the zoom View submenu, no appMenu',
    (platform) => {
      const template = buildMenuTemplate(platform)

      expect(roles(template)).not.toContain('appMenu')
      expect(roles(template)).toContain('editMenu')
      expect(viewSubmenuRoles(template)).toStrictEqual(['resetZoom', 'zoomIn', 'zoomOut'])
    }
  )

  it.each(['darwin', 'win32', 'linux'] as const)(
    'never exposes reload or toggleDevTools in the View submenu on %s',
    (platform) => {
      const submenuRoles = viewSubmenuRoles(buildMenuTemplate(platform))

      expect(submenuRoles).not.toContain('reload')
      expect(submenuRoles).not.toContain('toggleDevTools')
    }
  )
})
