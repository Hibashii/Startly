import { expect, test } from '@playwright/test'
import { freshApp, mockAssistant, task } from './helpers'

test('the first plan asks 3 quick questions once, and sends the answers to Startly', async ({ page }) => {
  await freshApp(page, '08:30', { askFirst: true })
  const sent = await mockAssistant(page, { body: { reply: 'ok', order: null, slots: null, actions: [task('Math revision', 120)] } })
  await page.getByLabel('What do you need to get done today or this week?').fill('math revision')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Before I plan: 3 quick questions' })).toBeVisible()
  await page.getByRole('radio', { name: 'Morning' }).click()
  await page.getByRole('radio', { name: '00:00' }).click()
  await page.getByPlaceholder(/e\.g\. gym/).fill('gym Mon/Wed/Fri 18:00')
  await page.getByRole('button', { name: 'Plan it for me' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  const ctx = (sent[0] as { context: { profile: unknown; endOfDay: string } }).context
  expect(ctx.profile).toEqual({ focusBest: 'morning', habits: 'gym Mon/Wed/Fri 18:00' })
  expect(ctx.endOfDay).toBe('24:00')

  // Never asked again, even after starting fresh.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Start fresh…' }).click()
  await page.getByRole('button', { name: 'Delete everything' }).click()
  await page.getByLabel('What do you need to get done today or this week?').fill('read')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
})

test('Skip plans right away and does not ask again', async ({ page }) => {
  await freshApp(page, '08:30', { askFirst: true })
  await mockAssistant(page, { body: { reply: 'ok', order: null, slots: null, actions: [task('Read', 30)] } })
  await page.getByLabel('What do you need to get done today or this week?').fill('read')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
})

test('How you work can be changed in the ⋯ menu', async ({ page }) => {
  await freshApp(page, '08:30')
  const sent = await mockAssistant(page, { body: { reply: 'ok', order: null, slots: null, actions: [task('Read', 30)] } })
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'How you work' }).click()
  const win = page.getByRole('dialog', { name: 'How you work' })
  await win.getByRole('radio', { name: 'Evening' }).click()
  await win.getByRole('radio', { name: '01:00' }).click()
  await win.getByPlaceholder(/e\.g\. gym/).fill('gym every day 7:00')
  await win.getByRole('button', { name: 'Save' }).click()
  await expect(win).toHaveCount(0)
  await page.getByLabel('What do you need to get done today or this week?').fill('read')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  const ctx = (sent[0] as { context: { profile: unknown; endOfDay: string } }).context
  expect(ctx.profile).toEqual({ focusBest: 'evening', habits: 'gym every day 7:00' })
  expect(ctx.endOfDay).toBe('25:00')
})
