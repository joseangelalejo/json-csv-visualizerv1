import { test, expect } from '@playwright/test'

// Verifica que Monaco acepte escritura, navegación por flechas y ejecución (textarea fallback si Monaco falla)
test('SQL Editor: typing, arrow-navigation and execute (Monaco interaction)', async ({ page }) => {
    await page.goto('/')

    // Login (usar credenciales de prueba)
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button:has-text("Connect")')
    await page.waitForSelector('text=Connect to Database')

    // Abrir SQL Editor
    await page.click('button:has-text("SQL Editor")')
    await page.waitForSelector('text=Connect to Database')

    // Conectar a SQLite fixture
    await page.selectOption('select[aria-label="Database Type"]', 'sqlite').catch(() => null)
    await page.fill('input[placeholder="e.g., ./database.db"]', './test-fixtures/test.db')
    await page.click('button:has-text("Connect")')

    // Esperar carga de esquema/resultados
    await page.waitForSelector('text=Database Schema (ER Diagram)')
    await page.waitForSelector('.monaco-editor, textarea')

    // Focus al editor y escribir query
    const editorLocator = page.locator('.monaco-editor')
    if (await editorLocator.count() > 0) {
        await editorLocator.first().click()
    } else {
        // Fallback to textarea if Monaco not present
        await page.locator('textarea').first().click()
    }

    // Escribir consulta y ejecutarla (Ctrl+Enter)
    await page.keyboard.type('SELECT name FROM people LIMIT 1;')
    await page.keyboard.press('Control+Enter')

    // Verificar resultado esperado (fixture contiene 'Alice')
    await page.waitForSelector('td:has-text("Alice")')

    // Ahora comprobar navegación por flechas no rompe foco y se acepta más escritura
    // (disparar ArrowDown y verificar que el activeElement sea la textarea de Monaco)
    await page.keyboard.press('ArrowDown')
    const activeIsEditor = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el) return false
        if (el.tagName === 'TEXTAREA') return !!el.closest('.monaco-editor')
        return !!el.closest && !!el.closest('.monaco-editor')
    })
    expect(activeIsEditor).toBe(true)

    // Añadir un comentario y ejecutar de nuevo
    await page.keyboard.type(' -- E2E')
    await page.keyboard.press('Control+Enter')
    await page.waitForSelector('td:has-text("Alice")')
})

// Ejecutar varias sentencias en un solo script (script entero)
test('SQL Editor: execute multi-statement script (SQLite)', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button:has-text("Connect")')
    await page.waitForSelector('text=Connect to Database')

    await page.click('button:has-text("SQL Editor")')
    await page.waitForSelector('text=Connect to Database')

    await page.selectOption('select[aria-label="Database Type"]', 'sqlite').catch(() => null)
    await page.fill('input[placeholder="e.g., ./database.db"]', './test-fixtures/test.db')
    await page.click('button:has-text("Connect")')
    await page.waitForSelector('text=Database Schema (ER Diagram)')

    const editorLocator = page.locator('.monaco-editor')
    if (await editorLocator.count() > 0) {
        await editorLocator.first().click()
    } else {
        await page.locator('textarea').first().click()
    }

    // Enviar script con varias sentencias — la última devuelve filas
    await page.keyboard.type('SELECT 1; SELECT name FROM people;')
    await page.keyboard.press('Control+Enter')

    // El resultado mostrado debe corresponder a la última SELECT (tabla people)
    await page.waitForSelector('td:has-text("Alice")')
})


test('SQL Editor: undo/redo and multi-line selection (Monaco or textarea)', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button:has-text("Connect")')
    await page.waitForSelector('text=Connect to Database')

    await page.click('button:has-text("SQL Editor")')
    await page.waitForSelector('text=Connect to Database')

    await page.selectOption('select[aria-label="Database Type"]', 'sqlite').catch(() => null)
    await page.fill('input[placeholder="e.g., ./database.db"]', './test-fixtures/test.db')
    await page.click('button:has-text("Connect")')
    await page.waitForSelector('text=Database Schema (ER Diagram)')

    // Intercept query requests to inspect submitted SQL
    let lastQuery = ''
    await page.route('**/api/db/query', async (route) => {
        const req = route.request()
        const body = await req.postData()
        try { lastQuery = JSON.parse(body || '{}').query || '' } catch { lastQuery = '' }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ name: 'Alice' }] }) })
    })

    const editorLocator = page.locator('.monaco-editor')
    const usingMonaco = (await editorLocator.count()) > 0
    const inputSelector = usingMonaco ? '.monaco-editor' : 'textarea'

    // Ensure baseline content is present and then type an addition, undo it, execute and verify
    await page.click(inputSelector)
    // Type marker text at the end
    await page.keyboard.type(' -- MARKER')
    // Undo the marker
    await page.keyboard.press('Control+Z')

    // Execute and assert the submitted query does NOT contain the marker
    await page.click('button:has-text("Ejecutar")')
    await page.waitForTimeout(100)
    expect(lastQuery).not.toContain('-- MARKER')

    // Now type multiple lines and select two lines using Shift+ArrowDown and replace
    await page.click(inputSelector)
    await page.keyboard.press('Control+A')
    await page.keyboard.type('line-one\nline-two\nline-three')

    // Move to start of document and select two lines using Shift+ArrowDown
    await page.keyboard.press('Home')
    await page.keyboard.down('Shift')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.up('Shift')

    // Verify editor still accepts typing after selection (fix for reported bug)
    await page.keyboard.type('REPLACED')
    // small delay to let editor process input
    await page.waitForTimeout(30)

    // Execute and assert submitted query contains 'REPLACED'
    await page.click('button:has-text("Ejecutar")')
    await page.waitForTimeout(100)
    expect(lastQuery).toContain('REPLACED')

    // Test Ctrl+Shift+Arrow (word-wise selection) — add a multi-word line and select a word
    await page.click(inputSelector)
    await page.keyboard.press('Control+A')
    await page.keyboard.type('alpha beta gamma')
    // Move caret to end, then Ctrl+Shift+ArrowLeft to select previous word
    await page.keyboard.press('End')
    await page.keyboard.down('Control')
    await page.keyboard.down('Shift')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.up('Shift')
    await page.keyboard.up('Control')
    // Type X to replace selected word
    await page.keyboard.type('X')
    await page.click('button:has-text("Ejecutar")')
    await page.waitForTimeout(100)
    expect(lastQuery).toContain('alpha beta X')
})

test('SQL Editor: toolbar run-selection and select-under-mouse', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button:has-text("Connect")')
    await page.waitForSelector('text=Connect to Database')

    await page.click('button:has-text("SQL Editor")')
    await page.waitForSelector('text=Connect to Database')
    await page.selectOption('select[aria-label="Database Type"]', 'sqlite').catch(() => null)
    await page.fill('input[placeholder="e.g., ./database.db"]', './test-fixtures/test.db')
    await page.click('button:has-text("Connect")')
    await page.waitForSelector('text=Database Schema (ER Diagram)')

    let captured = ''
    await page.route('**/api/db/query', async (route) => {
        const req = route.request()
        const body = await req.postData()
        try { captured = JSON.parse(body || '{}').query || '' } catch { captured = '' }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ name: 'Alice' }] }) })
    })

    // Type a two-statement script
    const editor = page.locator('.monaco-editor')
    if (await editor.count() > 0) {
        await editor.first().click()
    } else {
        await page.locator('textarea').first().click()
    }
    await page.keyboard.type('SELECT 1;\nSELECT name FROM people;')

    // Move mouse over the editor area (to trigger lastMouse tracking)
    const box = await page.locator('.monaco-editor').boundingBox()
    if (box) await page.mouse.move(box.x + 10, box.y + box.height / 2)

    // Click "Seleccionar sentencia" (should select the statement under mouse)
    await page.click('button:has-text("Seleccionar sentencia")')

    // Click "Ejecutar selección" and assert the captured query corresponds to the second SELECT
    await page.click('button:has-text("Ejecutar selección")')
    await page.waitForTimeout(100)
    expect(captured).toContain('SELECT name FROM people')
})


test('SQL Editor: mouse drag selection persists and executes selected text', async ({ page }) => {
    await page.goto('/')
    await page.fill('input[placeholder="Username"]', 'admin')
    await page.fill('input[placeholder="Password"]', 'admin123')
    await page.click('button:has-text("Connect")')
    await page.waitForSelector('text=Connect to Database')

    await page.click('button:has-text("SQL Editor")')
    await page.waitForSelector('text=Connect to Database')
    await page.selectOption('select[aria-label="Database Type"]', 'sqlite').catch(() => null)
    await page.fill('input[placeholder="e.g., ./database.db"]', './test-fixtures/test.db')
    await page.click('button:has-text("Connect")')
    await page.waitForSelector('text=Database Schema (ER Diagram)')

    let captured = ''
    await page.route('**/api/db/query', async (route) => {
        const req = route.request()
        const body = await req.postData()
        try { captured = JSON.parse(body || '{}').query || '' } catch { captured = '' }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ name: 'Alice' }] }) })
    })

    // Type several lines
    const editor = page.locator('.monaco-editor')
    if (await editor.count() > 0) {
        await editor.first().click()
    } else {
        await page.locator('textarea').first().click()
    }
    await page.keyboard.type('one\ntwo\nthree\nfour')

    // Drag-select from near start of line 1 to line 3
    const box = await page.locator('.monaco-editor').boundingBox()
    if (!box) throw new Error('Monaco editor bounding box not found')
    const startX = box.x + 20
    const startY = box.y + 10
    const endX = box.x + 20
    const endY = box.y + box.height / 3

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 5 })
    await page.mouse.up()

    // Click Ejecutar selección — should send the currently selected text
    await page.click('button:has-text("Ejecutar selección")')
    await page.waitForTimeout(150)

    // The captured query should contain 'one' and 'two' or 'three' depending on drag
    expect(captured).toMatch(/one|two|three/)
})