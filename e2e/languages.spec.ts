import { expect, test, type Page } from '@playwright/test'
import { TODAY, freshApp, mockAssistant, task } from './helpers'

async function pickLanguage(page: Page, name: string) {
  await page.getByRole('button', { name: /Settings|Réglages|الإعدادات/ }).click()
  await page.getByRole('combobox').selectOption({ label: name })
  await page.keyboard.press('Escape')
}

test('switch to French: every screen speaks French and it is remembered', async ({ page }) => {
  await freshApp(page, '14:00')
  await pickLanguage(page, 'Français')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Tu ne sais pas par où commencer \?\s*Commence ici\./)
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Planifier ma journée →' })).toBeVisible()

  await mockAssistant(page, { body: { reply: 'Voilà ta journée.', order: null, actions: [task('Hackathon', 120), task('Sport', 60)] } })
  await page.getByLabel('Dis-moi tout ce que tu as à faire').fill('hackathon, sport')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Aujourd’hui' })).toBeVisible()
  await expect(page.getByText(/prévus · jusqu’à/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Demander à Startly' })).toBeVisible()
  await expect(page.getByText('Pause', { exact: true })).toBeVisible()
})

test('a code-written message re-renders when the language changes (chat history included)', async ({ page }) => {
  await freshApp(page, '20:00')
  await mockAssistant(page, { body: { reply: 'ok', order: null, actions: [task('Hack', 150), task('Groceries', 45)] } })
  await page.getByLabel('Tell me everything you have to do').fill('x')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/^'Groceries' doesn't fit before 23:00/)).toBeVisible()
  await pickLanguage(page, 'Deutsch')
  await expect(page.getByText(/^„Groceries“ passt nicht vor 23:00/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sonntag' })).toBeVisible()
})

test('Arabic: the layout mirrors right-to-left, times stay readable left-to-right', async ({ page }) => {
  await freshApp(page, '14:20')
  await mockAssistant(page, { body: { reply: 'تم.', order: null, actions: [task('Hackathon', 60), { type: 'add_fixed', title: 'Call', date: TODAY, start: '16:00', end: '16:30' }] } })
  await pickLanguage(page, 'العربية')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ابدأ من هنا.')
  await page.getByRole('textbox').fill('x')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'اليوم' })).toBeVisible()

  // The chat drawer sits on the left, the timetable on the right.
  const drawer = await page.getByRole('complementary').boundingBox()
  const table = await page.getByRole('heading', { name: 'اليوم' }).boundingBox()
  expect(drawer!.x).toBeLessThan(table!.x)
  // The Now bar is on the right edge of the card.
  const bar = await page.locator('li[data-now]').evaluate((e) => getComputedStyle(e).boxShadow)
  expect(bar).toContain('-4px')
  // Time ranges keep reading 14:20–15:20.
  await expect(page.locator('li[data-now] time')).toHaveText('14:20–15:20')
  await expect(page.locator('li[data-now] time')).toHaveAttribute('dir', 'ltr')
})
