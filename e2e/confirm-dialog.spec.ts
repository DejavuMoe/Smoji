import { test, expect } from '@playwright/test'
import { boot, closeSheets, makeItems, mockCatalog, openKit, readGroups } from './support'

const items = makeItems('confirm', 4, '确认')

test.beforeEach(async ({ page }) => {
  await mockCatalog(page, [{ id: 'confirm', label: '确认分类', items }])
  await page.addInitScript(srcs => {
    if (localStorage.getItem('smoji-workbench:custom-packs')) return
    localStorage.setItem('smoji-workbench:mode', 'custom')
    localStorage.setItem('smoji-workbench:custom-packs', JSON.stringify([
      { id: 'keep', label: '保留组', itemSrcs: srcs.slice(0, 2) },
      { id: 'drop', label: '删除组', itemSrcs: srcs.slice(2) },
    ]))
  }, items.map(item => item.src))
  await boot(page)
})

test('Enter on the initially focused 取消 never deletes; confirming deletes and is undoable', async ({ page }) => {
  await openKit(page)
  const tools = page.locator('#custom-pack-list [data-custom-index="1"]').getByRole('button', { name: '分组操作', exact: true })
  await tools.click()
  await page.getByRole('menuitem', { name: '删除分组' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('确定要删除分组「删除组」吗？包含 2 张表情。')
  await expect(page.locator('#confirm-cancel')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
  await expect(tools).toBeFocused()
  expect(await readGroups(page)).toHaveLength(2)

  await tools.click()
  await page.getByRole('menuitem', { name: '删除分组' }).click()
  await page.locator('#confirm-ok').click()
  await expect(page.locator('#custom-pack-list [data-custom-index]')).toHaveCount(1)
  // Focus lands on the surviving neighbour rather than the document body.
  await expect(page.locator('#custom-pack-list [data-custom-index="0"] .custom-pack-name')).toBeFocused()
  await closeSheets(page)
  await page.keyboard.press('ControlOrMeta+z')
  expect((await readGroups(page)).map(group => group.label)).toEqual(['保留组', '删除组'])
})

test('clearing every group asks first and can be cancelled', async ({ page }) => {
  await openKit(page)
  await page.getByRole('button', { name: '导入与管理' }).click()
  await page.getByRole('menuitem', { name: /清空/ }).click()
  await expect(page.locator('#confirm-cancel')).toBeFocused()
  await page.keyboard.press('Escape')
  expect(await readGroups(page)).toHaveLength(2)
  await page.getByRole('button', { name: '导入与管理' }).click()
  await page.getByRole('menuitem', { name: /清空/ }).click()
  await page.locator('#confirm-ok').click()
  await expect(page.locator('#custom-pack-list [data-custom-index]')).toHaveCount(0)
})
