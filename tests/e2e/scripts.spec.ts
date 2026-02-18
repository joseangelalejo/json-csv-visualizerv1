import { test, expect } from '@playwright/test'

test('saved scripts: save → load → rename tab → Ctrl+Tab navigation', async ({ page }) => {
  await page.goto('/')

  // Login
  await page.fill('input[placeholder="Username"]', 'admin')
  await page.fill('input[placeholder="Password"]', 'admin123')
  await page.click('button:has-text("Connect")')
  await page.waitForSelector('text=Connect to Database')

  // Open SQL Editor
  await page.click('button:has-text("SQL Editor")')
  await page.waitForSelector('text=Connect to Database')

  // Ensure at least one tab exists and add a new one
  await page.click('button[title="Nueva pestaña"]')

  // Focus editor (Monaco or textarea) and enter a simple query
  const editorLocator = page.locator('.monaco-editor').first()
  if (await editorLocator.count() > 0) {
    await editorLocator.click()
  } else {
    await page.locator('textarea').first().click()
  }
  await page.keyboard.type('SELECT 1 as saved_script;')

  // Save script using toolbar
  await page.click('button:has-text("Guardar")')
  await page.fill('input[placeholder="Ej: Mi Base de Datos"]', 'e2e-script-1')
  await page.click('button:has-text("Guardar")')

  // Open Scripts panel and assert saved script appears
  await page.click('button:has-text("Scripts")')
  await page.waitForSelector('text=e2e-script-1')

  // Click saved script to load into a new tab
  await page.click('text=e2e-script-1')
  // Small wait for UI update
  await page.waitForTimeout(250)

  // Verify that a tab with the script name exists
  const tab = page.locator('div[data-tab-id] >> text=e2e-script-1')
  await expect(tab).toHaveCount(1)

  // Rename the tab via double click + typing + Enter
  await tab.dblclick()
  await page.keyboard.type(' - RENAMED')
  await page.keyboard.press('Enter')

  // Verify the new title is present
  await expect(page.locator('div[data-tab-id] >> text=e2e-script-1 - RENAMED')).toHaveCount(1)

  // Add another tab and then use Ctrl+Tab to cycle
  await page.click('button[title="Nueva pestaña"]')
  await page.keyboard.press('Control+Tab')
  // After cycling, ensure active tab indicator exists (border-b-purple-500)
  const activeTabs = await page.locator('.border-b-purple-500').count()
  expect(activeTabs).toBeGreaterThan(0)
})