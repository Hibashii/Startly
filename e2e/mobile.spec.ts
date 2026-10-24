import { expect, test, type Page } from '@playwright/test'
import { TODAY, freshApp, mockAssistant, task } from './helpers'

// A phone: 390 px wide, touch, no hover.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

async function day(page: Page) {
  await freshApp(page, '14:00')
  await mockAssistant(page, { body: { reply: 'Here you go.', order: null, actions: [task('Hackathon submission video', 60), task('Gym', 60), task('Review notes', 30)] } })
  await page.getByLabel('What do you need to get done today or this week?').fill('my day')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.clock.setFixedTime(new Date(`${TODAY}T14:20:00`))
}
const chat = (page: Page) => page.getByRole('complementary', { name: 'Chat with Startly', includeHidden: true })
/** Nothing sticks out sideways: no page scroll left and right, and none inside the timetable. */
const fits = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('main')!
    return document.documentElement.scrollWidth <= innerWidth && main.scrollWidth <= main.clientWidth
  })

test('a phone: every view fits the screen, with no sideways scroll', async ({ page }) => {
  await day(page)
  expect(await fits(page)).toBe(true)
  await page.getByRole('button', { name: /show the week/ }).click()
  expect(await fits(page)).toBe(true)
  await page.getByRole('button', { name: 'Day', exact: true }).click()
  expect(await fits(page)).toBe(true)
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Week grid' })).toBeVisible()
  expect(await fits(page)).toBe(true)
})

test('a phone: the first plan shows the timetable; Ask Startly opens the chat as a full sheet, × closes it', async ({ page }) => {
  await day(page)
  await expect(chat(page)).toHaveAttribute('aria-hidden', 'true')
  await page.getByRole('button', { name: 'Ask Startly' }).click()
  await expect(chat(page)).toHaveAttribute('aria-hidden', 'false')
  await expect.poll(async () => (await chat(page).boundingBox())?.width).toBe(390)
  // 16px in the message field: smaller, and the phone zooms in on tap
  expect(await page.getByLabel('Message Startly').evaluate((e) => getComputedStyle(e).fontSize)).toBe('16px')
  // The ⋯ menu opens above the sheet
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('radio', { name: 'Sage' }).click()
  await expect(page.getByRole('radio', { name: 'Sage' })).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Close chat' }).click()
  await expect(chat(page)).toHaveAttribute('aria-hidden', 'true')
})

test("a touch screen: the Now card's quick buttons show without hover, on a row under the time", async ({ page }) => {
  await day(page)
  await page.reload()
  const more = page.getByRole('button', { name: 'Need more time' })
  await expect(more).toBeVisible()
  const time = (await page.locator('li[data-now] time').boundingBox())!
  expect((await more.boundingBox())!.y).toBeGreaterThan(time.y + time.height - 1)
  await more.click()
  await expect(page.getByText(/↻ Reshuffled/)).toBeVisible()
  await expect(chat(page)).toHaveAttribute('aria-hidden', 'true') // the change shows on the timetable, the chat stays shut
})

test('a phone: How you work fits on the screen', async ({ page }) => {
  await day(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'How you work' }).click()
  const box = (await page.getByRole('dialog', { name: 'How you work' }).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(16)
  expect(box.x + box.width).toBeLessThanOrEqual(390 - 16)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(844)
})

test('a phone: a reply that arrives with the chat shut puts a dot on Ask Startly; opening the chat clears it', async ({ page }) => {
  await day(page)
  const dot = page.locator('header [data-unread]')
  await expect(dot).toBeVisible()
  await page.getByRole('button', { name: 'Ask Startly' }).click()
  await expect(dot).toHaveCount(0)
  await expect(page.locator('[data-role=assistant]').last()).toContainText('Here you go.')
})

test.describe('the narrowest phones (320 px)', () => {
  test.use({ viewport: { width: 320, height: 640 } })
  for (const lang of ['en', 'fr', 'de', 'es', 'nl', 'ar']) {
    test(`${lang}: nothing sticks out sideways, and the week's title bar stays two rows`, async ({ page }) => {
      await day(page)
      await page.evaluate((lang) => {
        const s = JSON.parse(localStorage.getItem('startly-v1')!)
        s.state.settings.lang = lang
        localStorage.setItem('startly-v1', JSON.stringify(s))
      }, lang)
      await page.reload()
      await expect(page.locator('li[data-now]')).toHaveCount(1)
      expect(await fits(page)).toBe(true)
      await page.getByRole('group').locator('button').nth(2).click() // Week
      await expect(page.getByRole('region').first()).toBeVisible()
      expect(await fits(page)).toBe(true)
      // The day names stick right under the title bar, never behind it.
      const [bar, days] = await page.evaluate(() => {
        document.querySelector('main')!.scrollTop += 300
        const bar = document.querySelector('section > div.sticky')!.getBoundingClientRect()
        const days = document.querySelector('[role=region] > div.sticky')!.getBoundingClientRect()
        return [bar.bottom, days.top]
      })
      expect(days).toBeGreaterThanOrEqual(bar - 0.5)
    })
  }
})

/** A finger swipe across the timetable: 'left' for the next day (or week), 'right' for the previous. */
const swipe = (page: Page, to: 'left' | 'right') =>
  page.locator('main section').first().evaluate((el, by) => {
    const at = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [at(200)], changedTouches: [at(200)] }))
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [at(200 + by)] }))
  }, to === 'left' ? -120 : 120)

test('a phone: like a calendar app, the date is the title (no logo); ‹ › or a swipe change the day or the week', async ({ page }) => {
  await day(page)
  await expect(page.locator('header').getByText('Startly', { exact: true })).toBeHidden()
  // The top bar follows the day you're on (with the clock only on today)
  await expect(page.locator('header > button[aria-expanded]')).toHaveText('Sat 17 Oct')
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page.getByRole('heading', { name: 'Tomorrow' })).toBeVisible()
  await expect(page.locator('header > button[aria-expanded]')).toHaveText('Sun 18 Oct')
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await swipe(page, 'left')
  await expect(page.getByRole('heading', { name: 'Tomorrow' })).toBeVisible()
  await swipe(page, 'right')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  // A scroll (mostly up or down) is not a swipe
  await page.locator('main section').first().evaluate((el) => {
    const at = (x: number, y: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [at(200, 500)], changedTouches: [at(200, 500)] }))
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [at(130, 300)] }))
  })
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  // The Week view: one letter a day, and a swipe goes a week on
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(page.getByRole('button', { name: /^M\s*12$/ })).toBeVisible()
  await swipe(page, 'left')
  await expect(page.getByRole('heading', { name: '19 – 25 Oct' })).toBeVisible()
  await page.getByRole('button', { name: 'Previous week' }).click()
  await expect(page.getByRole('heading', { name: '12 – 18 Oct' })).toBeVisible()
})

test.describe('menus on the narrowest phone (320 px)', () => {
  test.use({ viewport: { width: 320, height: 640 } })
  const inside = async (box: { x: number; width: number } | null) => {
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  }
  test('the ⋯ menu and "How do you want to focus?" stay on the screen', async ({ page }) => {
    await freshApp(page, '14:00', { chooseTimer: true })
    await mockAssistant(page, { body: { reply: 'ok', order: null, actions: [task('Finish the demo video for my project', 60)] } })
    await page.getByLabel('What do you need to get done today or this week?').fill('x')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Settings' }).click()
    await inside(await page.getByRole('dialog', { name: 'Settings' }).boundingBox())
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await inside(await page.getByText('How do you want to focus?').locator('..').boundingBox())
  })
})
