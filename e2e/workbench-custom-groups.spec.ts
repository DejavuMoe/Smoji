import { test, expect } from '@playwright/test'
import { assetBase, boot, closeSheets, createGroup, makeItems, mockCatalog, openKit, readGroups, reload, setMode, tileAction } from './support'

const packs = [
  { id: 'first', label: '第一分类', items: makeItems('first', 240, '表情') },
  { id: 'second', label: '第二分类', items: makeItems('second', 2, '第二') },
]
const group = (i: number) => `#custom-pack-list [data-custom-index="${i}"]`

test.beforeEach(async ({ page }) => {
  await mockCatalog(page, packs)
  await boot(page)
  await setMode(page, 'custom')
})

test('creates groups with validated names and IDs that survive a refresh', async ({ page }) => {
  await openKit(page)
  const name = page.locator('#custom-name-input')
  // The input is clamped to the core 40-character label limit.
  await name.fill('a'.repeat(41))
  await expect(name).toHaveValue('a'.repeat(40))
  await name.fill('坏]名称')
  await page.locator('#btn-create-custom-pack').click()
  await expect(page.locator('#custom-create-error')).toContainText('不能包含 ]')
  await expect(name).toHaveValue('坏]名称')
  await expect(page.locator('#custom-pack-list [data-custom-index]')).toHaveCount(0)

  // A name that reduces to an illegal automatic ID still produces a valid one.
  await createGroup(page, '-')
  expect((await readGroups(page))[0]!.id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/)
  await createGroup(page, '第二组', 'second')
  await page.locator('#custom-name-input').fill('第三组')
  await page.getByRole('button', { name: '自定义 ID' }).click()
  await page.locator('#custom-id-input').fill('second')
  await page.locator('#btn-create-custom-pack').click()
  await expect(page.locator('#custom-create-error')).toHaveText('分组 ID「second」已存在')

  await closeSheets(page)
  await tileAction(page, 0)
  await expect(page.locator('#grid .tile').first()).toHaveAttribute('data-picked')
  await reload(page)
  await openKit(page)
  await expect(page.locator('#custom-pack-list [data-custom-index]')).toHaveCount(2)
  expect((await readGroups(page)).map(g => g.itemSrcs.length)).toEqual([0, 1])
})

test('renames, duplicates, splits, merges and undoes group operations', async ({ page }) => {
  await createGroup(page, '合集')
  await closeSheets(page)
  await page.locator('#btn-batch-pack-action').click()
  await openKit(page)
  await expect(page.locator(`${group(0)} .group__count`)).toHaveAttribute('aria-label', '已用 240 / 600 项')

  const menu = (i: number) => page.locator(group(i)).getByRole('button', { name: '分组操作', exact: true })
  await menu(0).click()
  await page.getByRole('menuitem', { name: '编辑名称 / ID' }).click()
  const edit = page.locator('#edit-name-0')
  await expect(edit).toBeFocused()
  await edit.fill('精选')
  await page.keyboard.press('Enter')
  await expect(menu(0)).toBeFocused()
  await expect(page.locator(`${group(0)} .group__label`)).toHaveText('精选')

  await menu(0).click()
  await page.getByRole('menuitem', { name: '拆分分组' }).click()
  expect((await readGroups(page)).map(g => g.itemSrcs.length)).toEqual([120, 120])
  await menu(1).click()
  await page.getByRole('menuitem', { name: '向上合并' }).click()
  expect((await readGroups(page)).map(g => g.itemSrcs.length)).toEqual([240])
  await menu(0).click()
  await page.getByRole('menuitem', { name: '复制分组' }).click()
  expect(await readGroups(page)).toHaveLength(2)

  await closeSheets(page)
  await page.keyboard.press('ControlOrMeta+z')
  expect((await readGroups(page)).map(g => g.itemSrcs.length)).toEqual([240])
  await page.keyboard.press('ControlOrMeta+z')
  expect((await readGroups(page)).map(g => g.itemSrcs.length)).toEqual([120, 120])
  await page.keyboard.press('ControlOrMeta+Shift+z')
  expect((await readGroups(page)).map(g => g.itemSrcs.length)).toEqual([240])
})

test('dragging a tray item onto another group moves it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'HTML drag and drop needs a mouse')
  await createGroup(page, '来源')
  await closeSheets(page)
  await tileAction(page, 0)
  await tileAction(page, 1)
  await createGroup(page, '目标')
  const source = page.locator(group(0))
  await expect(source.locator('[data-tray-item]')).toHaveCount(2)
  await source.locator('[data-tray-item]').first().dragTo(page.locator(group(1)))
  await expect(source.locator('[data-tray-item]')).toHaveCount(1)
  await expect(page.locator(group(1)).locator('[data-tray-item]')).toHaveCount(1)
  expect((await readGroups(page)).reduce((sum, g) => sum + g.itemSrcs.length, 0)).toBe(2)
})

test('backup round-trip keeps IDs, notes and unknown extensions', async ({ page }) => {
  await openKit(page)
  await page.locator('#import-groups-file').setInputFiles({
    name: 'groups.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      version: 1,
      kind: 'smoji-custom-groups',
      packs: [{ id: 'Team_A.v1', label: '团队', itemSrcs: [`${assetBase}first/0.png`, `${assetBase}first/0.png`] }],
      extensions: { 'vendor.new': { flag: true }, 'smoji.workbench': { notes: '新备注' } },
    })),
  })
  await expect(page.locator('#confirm-cancel')).toBeFocused()
  await page.locator('#confirm-ok').click()
  await expect(page.locator('#custom-pack-list [data-custom-index]')).toHaveCount(1)
  await expect(page.locator(`${group(0)} .group__count`)).toHaveAttribute('aria-label', '已用 1 / 600 项')
  expect((await readGroups(page))[0]).toMatchObject({ id: 'Team_A.v1', itemSrcs: [`${assetBase}first/0.png`] })
  await expect(page.getByRole('textbox', { name: '分组配置备注' })).toHaveValue('新备注')

  await page.getByRole('button', { name: '导入与管理' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: '备份分组' }).click()
  const stream = await (await download).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const bundle = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  expect(bundle.packs[0].id).toBe('Team_A.v1')
  expect(bundle.extensions['vendor.new']).toEqual({ flag: true })
  expect(bundle.extensions['smoji.workbench'].notes).toBe('新备注')
})

test('cancelling an import keeps existing notes and groups', async ({ page }) => {
  await createGroup(page, '原分组')
  const notes = page.getByRole('textbox', { name: '分组配置备注' })
  await notes.fill('原备注')
  await page.locator('#import-groups-file').setInputFiles({
    name: 'groups.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 1, kind: 'smoji-custom-groups', packs: [{ id: 'imported', label: '导入组', itemSrcs: [] }], extensions: { 'smoji.workbench': { notes: '新备注' } } })),
  })
  await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(notes).toHaveValue('原备注')
  expect((await readGroups(page)).map(g => g.label)).toEqual(['原分组'])
})

test('custom batch add includes items excluded in packs mode', async ({ page }) => {
  await setMode(page, 'packs')
  await page.getByRole('button', { name: '选择本分类导出' }).click()
  await tileAction(page, 0)
  await expect(page.locator('#grid .tile').first()).toHaveAttribute('data-excluded')
  await setMode(page, 'custom')
  await createGroup(page, '全部')
  await closeSheets(page)
  await page.locator('#btn-batch-pack-action').click()
  await openKit(page)
  await expect(page.locator(`${group(0)} .group__count`)).toHaveAttribute('aria-label', '已用 240 / 600 项')
  await expect(page.locator('#selection-dock-count')).toHaveText('1 个自选组 · 240 张表情')
})
