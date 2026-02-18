import { test, expect } from '@playwright/test'

test('save → list refresh → select saved connection → load table data (SQLite fixture)', async ({ page }) => {
  await page.goto('/')

  // Login using default admin user
  await page.fill('input[placeholder="Username"]', 'admin')
  await page.fill('input[placeholder="Password"]', 'admin123')
  await page.click('button:has-text("Connect")') // submits login form
  // Wait for token and UI to update
  await page.waitForSelector('text=Connect to Database')

  // Select SQLite and point to the fixture DB we create in prepare step
  await page.selectOption('select[aria-label="Database Type"]', 'sqlite').catch(() => null)
  await page.fill('input[placeholder="e.g., ./database.db"]', './test-fixtures/test.db')
  await page.click('button:has-text("Connect")')

  // Wait for schema area to be visible and tables to load
  await page.waitForSelector('text=Database Schema (ER Diagram)')
  await page.waitForSelector('select:near(:text("Select Table"))')

  // Open Saved Connections sidebar and save current connection
  await page.click('button:has-text("Saved Connections")')
  await page.waitForSelector('text=Conexiones Guardadas')
  // Use header small Save button
  await page.click('button:has-text("Save connection")')
  await page.fill('input[placeholder="Ej: Mi Base de Datos"]', 'e2e-sqlite')
  await page.click('button:has-text("Guardar")')

  // Assert new saved connection appears in the list
  await page.waitForSelector('text=e2e-sqlite')

  // Click the saved connection and ensure it's loaded
  await page.click('text=e2e-sqlite')
  await page.waitForTimeout(400) // small wait for UI state update

  // Select table and assert data rows render
  await page.selectOption('select:near(:text("Select Table"))', 'people')
  await page.waitForSelector('td:has-text("Alice")')
  await expect(page.locator('td:has-text("Bob")')).toHaveCount(1)
})


test('DB selector filters out system databases (frontend filter)', async ({ page }) => {
  await page.goto('/')

  // login
  await page.fill('input[placeholder="Username"]', 'admin')
  await page.fill('input[placeholder="Password"]', 'admin123')
  await page.click('button:has-text("Connect")')
  await page.waitForSelector('text=Connect to Database')

  // Stub connect + databases endpoints
  await page.route('**/api/db/connect', route => route.fulfill({ status: 200 }))
  await page.route('**/api/db/databases', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ databases: [{ name: 'mysql' }, { name: 'information_schema' }, { name: 'cineDB' }, { name: 'userdb' }] }) }))

  // Select MySQL and connect (connect is stubbed)
  await page.click('div:has-text("Tipo")')
  await page.selectOption('select[aria-label="Database Type"]', 'mysql').catch(() => null)
  await page.fill('input[placeholder="localhost"]', '127.0.0.1')
  await page.fill('input[placeholder="user"]', 'root')
  await page.click('button:has-text("Conectar")')

  // Wait for the DB selector to appear and open it
  const dbCombo = page.getByRole('combobox', { name: 'Bases de datos' })
  await dbCombo.waitFor()
  await dbCombo.click()

  // Ensure system DBs are NOT present and user DBs are present
  await expect(page.getByRole('listbox').getByText('cineDB')).toHaveCount(1)
  await expect(page.getByRole('listbox').getByText('userdb')).toHaveCount(1)
  await expect(page.getByRole('listbox').getByText('mysql')).toHaveCount(0)
  await expect(page.getByRole('listbox').getByText('information_schema')).toHaveCount(0)
})

test('SQL `USE <db>` updates client selected database', async ({ page }) => {
  await page.goto('/')

  // login
  await page.fill('input[placeholder="Username"]', 'admin')
  await page.fill('input[placeholder="Password"]', 'admin123')
  await page.click('button:has-text("Connect")')
  await page.waitForSelector('text=Connect to Database')

  // Stub connect/databases/query
  await page.route('**/api/db/connect', route => route.fulfill({ status: 200 }))
  await page.route('**/api/db/databases', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ databases: [{ name: 'cineDB' }, { name: 'other' }] }) }))

  let sawUseRequest = false
  await page.route('**/api/db/query', async (route) => {
    const req = route.request()
    const body = await req.postData()
    if (body && body.includes('USE')) sawUseRequest = true
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  })

  // Select MySQL and connect
  await page.selectOption('select[aria-label="Database Type"]', 'mysql').catch(() => null)
  await page.fill('input[placeholder="localhost"]', '127.0.0.1')
  await page.fill('input[placeholder="user"]', 'root')
  await page.click('button:has-text("Conectar")')
  await page.waitForSelector('text=Conectado a')

  // Type `USE cineDB;` into the Monaco editor (or textarea fallback)
  const monacoPresent = await page.locator('.monaco-editor').count()
  if (monacoPresent > 0) {
    await page.locator('.monaco-editor').first().click()
    await page.keyboard.type('USE cineDB;')
  } else {
    await page.locator('textarea').first().click()
    await page.keyboard.type('USE cineDB;')
  }

  // Execute
  await page.click('button:has-text("Ejecutar")')
  await page.waitForTimeout(200)

  // Verify the request was sent and the UI updated to show cineDB as selected
  expect(sawUseRequest).toBeTruthy()
  await expect(page.getByRole('combobox', { name: 'Bases de datos' })).toHaveText('cineDB')
})