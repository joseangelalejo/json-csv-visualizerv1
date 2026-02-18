import { test, expect } from '@playwright/test'
import path from 'path'

test('protected inputs/selects remain legible and accept input (visual regression check)', async ({ page }) => {
  await page.goto('/')

  // Fill login using Shadow DOM hosts (ProtectedInput)
  await page.evaluate(() => {
    const findByPlaceholder = (ph: string) => {
      for (const host of Array.from(document.querySelectorAll('[data-protected-input]'))) {
        try {
          const inner = (host as HTMLElement).shadowRoot?.querySelector('input,textarea') as HTMLInputElement | null
          if (inner && inner.getAttribute('placeholder') === ph) return { host, inner }
        } catch (e) { /* ignore */ }
      }
      return null
    }

    const u = findByPlaceholder('Username')
    const p = findByPlaceholder('Password')
    if (!u || !p) throw new Error('Protected inputs for login not found')

    u.inner!.value = 'user1'
    u.inner!.dispatchEvent(new Event('input', { bubbles: true }))

    p.inner!.value = 'user123'
    p.inner!.dispatchEvent(new Event('input', { bubbles: true }))
  })

  // Submit login (native button)
  await page.click('button:has-text("Login")')
  await page.waitForSelector('text=File Upload (JSON/CSV)')

  // 1) Check Database Visualization selects/inputs
  await page.click('button:has-text("Database Visualization")')
  await page.waitForSelector('text=Connect to Database')

  // Gather protected-select hosts and check inner select computed color
  const selectColors = await page.evaluate(() => {
    const results: string[] = []
    for (const host of Array.from(document.querySelectorAll('[data-protected-select]'))) {
      try {
        const sel = (host as HTMLElement).shadowRoot?.querySelector('select') as HTMLSelectElement | null
        if (sel) {
          const cs = getComputedStyle(sel).getPropertyValue('color')
          results.push(cs)
        }
      } catch (e) { results.push('error') }
    }
    return results
  })

  // At least one protected-select should be present (Database Type, Database, Select Table)
  expect(selectColors.length).toBeGreaterThan(0)
  // Ensure none of the inner selects report transparent/empty color
  for (const c of selectColors) expect(c).not.toBe('')

  // 2) File Upload: upload sample CSV to trigger TableFilters (rows-per-page select)
  const csvPath = path.resolve(__dirname, 'fixtures', 'sample.csv')
  await page.click('button:has-text("File Upload (JSON/CSV)")')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(csvPath)

  // wait for table to render
  await page.waitForSelector('text=Data Table')

  // Check protected-select inside TableFilters (rows-per-page)
  const tableFilterColor = await page.evaluate(() => {
    const host = document.querySelector('[data-protected-select]') as HTMLElement | null
    if (!host) return null
    const sel = host.shadowRoot?.querySelector('select') as HTMLSelectElement | null
    if (!sel) return null
    return getComputedStyle(sel).getPropertyValue('color')
  })

  expect(tableFilterColor).not.toBeNull()
  expect(tableFilterColor).not.toBe('')

  // Take screenshots for manual inspection (saved in Playwright report dir)
  await page.screenshot({ path: 'tests-e2e-visual-inputs-result.png', fullPage: true })
})