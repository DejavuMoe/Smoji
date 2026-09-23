import { expect, it } from 'vitest'
import catalog from '../../../data/packs.json'
import manifest from '../../../data/smoji.json'

it('keeps official panel data intact and every pack series contiguous after generation', () => {
  expect(catalog[0]!.id).toBe('deepseek-wale-girl')
  expect(manifest.packs[0]!.id).toBe('deepseek-wale-girl')
  expect(catalog[1]!.id).toBe('bilibili')
  expect(catalog[0]!.label).toBe('大肥鱼')
  expect(catalog[0]!.items).toHaveLength(104)
  expect(catalog.some((p) => ['wechat-classic', 'wechat-current', 'kabu'].includes(p.id))).toBe(false)
  const wechat = catalog.find((p) => p.id === 'wechat')!
  expect(wechat.items).toHaveLength(108)
  for (const pack of catalog) {
    const finished = new Set<string>()
    let active: string | undefined
    for (const item of pack.items) {
      const series = (item as { series?: string }).series
      expect(series).toBeTruthy()
      if (series !== active) {
        expect(finished.has(series!)).toBe(false)
        if (active) finished.add(active)
        active = series
      }
    }
    expect(manifest.packs.find((p) => p.id === pack.id)!.items.map((i) => i.id))
      .toEqual(pack.items.map((i) => i.file.replace(/\.[^.]+$/, '')))
  }
  const limited = catalog.find((p) => p.id === 'douyin-limited')!
  expect(limited.items.some((i) => i.label.includes('截图'))).toBe(false)
  expect(limited.items.filter((i) => (i as { series?: string }).series === '发型').map((i) => i.label))
    .toEqual(['斜刘海', '绿发', '黄发', '装酷', '粉发', '杀马特'])
  const television = catalog.find((p) => p.id === 'bilibili-television')!
  expect(television.items).toHaveLength(50)
  expect(television.items.map((i) => i.label))
    .toEqual(expect.arrayContaining(['流泪', '冷漠', '皱眉', '鬼脸', '调侃', '目瞪口呆']))
})

it('uses concise descriptive labels across the catalog', () => {
  for (const id of ['qq-classic', 'heo', 'douyin-classic']) {
    expect(catalog.find((p) => p.id === id)!.items.every((i) => !/^(QQ|Heo|tiktok)\s*\d+$/.test(i.label))).toBe(true)
  }
  expect(catalog.find((p) => p.id === 'xiaohongshu')!.items.every((i) => !/[RH]$/.test(i.label))).toBe(true)
  for (const [id, label] of [['daimaobatiao', '日常合集37'], ['popo', '日常篇004'], ['shuitunlulu', '第1弹02']]) {
    expect(catalog.find((p) => p.id === id)!.items.some((i) => i.label === label)).toBe(true)
  }
  expect(catalog.find((p) => p.id === 'bilibili')!.items.some((i) => i.label.endsWith('_旧版'))).toBe(false)
})
