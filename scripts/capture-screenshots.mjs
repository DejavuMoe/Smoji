import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const outDir = resolve(process.cwd(), 'docs/screenshots')
await mkdir(outDir, { recursive: true })

console.log('Starting preview server for screenshot capture...')
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--config', 'apps/workbench/vite.config.ts', '--port', '4173'], {
  stdio: 'pipe',
})

await new Promise((resolve) => {
  server.stdout.on('data', (d) => {
    if (d.toString().includes('http://localhost:4173')) resolve(true)
  })
  setTimeout(resolve, 2000)
})

const browser = await chromium.launch()

try {
  // 1. 1440 Light
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto('http://localhost:4173')
    await page.evaluate(() => {
      localStorage.setItem('smoji-theme', 'light')
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${outDir}/1440-light.png` })
    console.log('Saved 1440-light.png')
    await page.close()
  }

  // 2. 1440 Dark
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto('http://localhost:4173')
    await page.evaluate(() => {
      localStorage.setItem('smoji-theme', 'dark')
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${outDir}/1440-dark.png` })
    console.log('Saved 1440-dark.png')
    await page.close()
  }

  // 3. 834 Tablet
  {
    const page = await browser.newPage({ viewport: { width: 834, height: 1194 } })
    await page.goto('http://localhost:4173')
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${outDir}/834-tablet.png` })
    console.log('Saved 834-tablet.png')
    await page.close()
  }

  // 4. 390 Light
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto('http://localhost:4173')
    await page.evaluate(() => {
      localStorage.setItem('smoji-theme', 'light')
      document.documentElement.classList.remove('dark')
      document.documentElement.setAttribute('data-theme', 'light')
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${outDir}/390-light.png` })
    console.log('Saved 390-light.png')
    await page.close()
  }

  // 5. 390 Dark
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto('http://localhost:4173')
    await page.evaluate(() => {
      localStorage.setItem('smoji-theme', 'dark')
      document.documentElement.classList.add('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${outDir}/390-dark.png` })
    console.log('Saved 390-dark.png')
    await page.close()
  }

  // 6. 390 Inspector
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto('http://localhost:4173')
    await page.waitForTimeout(300)
    await page.locator('.card').first().click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${outDir}/390-inspector.png` })
    console.log('Saved 390-inspector.png')
    await page.close()
  }

  // 7. 390 Sidebar
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto('http://localhost:4173')
    await page.waitForTimeout(300)
    await page.locator('#menu-toggle').click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${outDir}/390-sidebar.png` })
    console.log('Saved 390-sidebar.png')
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
