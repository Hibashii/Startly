import { expect, test, type Page } from '@playwright/test'
import { TODAY, freshApp, mockAssistant, task } from './helpers'

const accentOf = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acc').trim())
const bgOf = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

async function planned(page: Page) {
  await freshApp(page, '14:00')
  await mockAssistant(page, { body: { reply: 'ok', order: null, actions: [task('Hackathon', 90), task('Gym', 60), { type: 'add_fixed', title: 'Call', date: TODAY, start: '17:00', end: '17:30' }] } })
  await page.getByLabel('What do you need to get done today or this week?').fill('x')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
}

test('the ⋯ menu is on the first screen too, and closes on an outside click or Escape', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await freshApp(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.mouse.click(20, 400)
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()
})

test('a swatch recolors everything at once (Now card, avatar), light and dark; both are remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await planned(page)
  expect(await accentOf(page)).toBe('#5b5bd6') // Iris by default
  await expect.poll(() => bgOf(page)).toBe('rgb(255, 255, 255)') // pure white

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'Sage' }).click()
  expect(await accentOf(page)).toBe('#326b52')
  const nowBar = await page.locator('li[data-now]').evaluate((e) => getComputedStyle(e).boxShadow)
  expect(nowBar).toContain('rgb(50, 107, 82)')
  const avatarStop = await page.locator('header svg stop').first().evaluate((e) => getComputedStyle(e).stopColor)
  expect(avatarStop).not.toBe('')

  await page.getByRole('switch', { name: 'Dark mode' }).click()
  await expect.poll(() => bgOf(page)).toBe('rgb(22, 21, 18)') // #161512
  expect(await accentOf(page)).toBe('#86c3a6') // Sage, the dark-mode version

  await page.reload()
  await expect.poll(() => bgOf(page)).toBe('rgb(22, 21, 18)')
  expect(await accentOf(page)).toBe('#86c3a6')
})

test('the first visit follows the computer\'s mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await freshApp(page)
  await expect.poll(() => bgOf(page)).toBe('rgb(22, 21, 18)')
})

test('List / Grid: the hour grid places blocks by time, with a line at now', async ({ page }) => {
  await planned(page)
  await page.getByRole('button', { name: 'grid' }).click()
  const grid = page.getByRole('list', { name: 'Hour grid' })
  await expect(grid).toBeVisible()
  const top = (name: string) => grid.getByRole('listitem').filter({ hasText: name }).evaluate((e) => (e as HTMLElement).offsetTop)
  // 72px per hour: Gym starts 15:45, the Call at 17:00 → 75 min apart = 90px
  expect((await top('Call')) - (await top('Gym'))).toBe(90)
  await expect(grid.getByLabel('Now')).toBeVisible()
  await page.getByRole('button', { name: 'list' }).click()
  await expect(page.getByRole('list', { name: "Today's timetable" })).toBeVisible()
})

test('clear the chat: the conversation goes, the plan stays', async ({ page }) => {
  await planned(page)
  await page.getByRole('button', { name: 'Clear chat' }).click()
  await expect(page.locator('[data-role=assistant]')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByRole('list', { name: "Today's timetable" }).locator(':scope > li')).not.toHaveCount(0)
})

test('Start fresh asks first; Cancel keeps everything, Delete everything goes back to the first screen (color stays)', async ({ page }) => {
  await planned(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'Plum' }).click()
  await page.getByRole('button', { name: 'Start fresh…' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  // Cancel goes back to the open menu.
  await page.getByRole('button', { name: 'Start fresh…' }).click()
  await page.getByRole('button', { name: 'Delete everything' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/not sure where to start/)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/not sure where to start/)
  expect(await accentOf(page)).toBe('#8e4ec6')
})

test('grid: a 5-minute block is still readable and never overlaps the next one', async ({ page }) => {
  await freshApp(page, '14:00')
  await mockAssistant(page, { body: { reply: 'ok', order: null, actions: [task('Quick call', 5), task('Email', 5), task('Hackathon', 60)] } })
  await page.getByLabel('What do you need to get done today or this week?').fill('x')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.getByRole('button', { name: 'grid' }).click()
  const items = page.getByRole('list', { name: 'Hour grid' }).getByRole('listitem')
  const boxes = await items.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height } }))
  for (const b of boxes) expect(b.h).toBeGreaterThanOrEqual(20)
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom)
  await expect(items.filter({ hasText: 'Quick call' })).toContainText('14:00–14:05')
})
