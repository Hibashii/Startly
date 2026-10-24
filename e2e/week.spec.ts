import { expect, test } from '@playwright/test'
import { freshApp, mockAssistant, task } from './helpers'

test('planning a week: Startly asks with answers to tap, then lays out each day', async ({ page }) => {
  await freshApp(page, '10:00')
  const sent = await mockAssistant(
    page,
    { body: { reply: 'Love it. Which days should I plan?', order: null, slots: null, suggestions: ['Mon 19 Oct – Sun 25 Oct', 'Mon – Fri only'], actions: [] } },
    { body: {
      reply: "Here's your week.", order: null, suggestions: null,
      actions: [
        { type: 'set_availability', key: '2026-10-19', windows: [{ start: '10:00', end: '22:00' }] },
        { type: 'set_availability', key: '2026-10-20', windows: [{ start: '10:00', end: '22:00' }] },
        { ...task('Portfolio', 150), date: '2026-10-19' },
        { ...task('Spanish', 60), date: '2026-10-20' },
      ],
      slots: [{ ref: 'Portfolio', date: '2026-10-19', start: '10:00' }, { ref: 'Spanish', date: '2026-10-20', start: '14:00' }],
    } },
  )
  await page.getByLabel('Tell me everything you have to do').fill('plan my vacation next week')
  await page.keyboard.press('Enter')
  const chat = page.getByRole('complementary', { name: 'Chat with Startly' })
  await expect(chat).toContainText('Which days should I plan?')
  await chat.getByRole('button', { name: 'Mon 19 Oct – Sun 25 Oct' }).click()
  await expect(chat).toContainText("Here's your week.")
  expect((sent[1] as { message: string }).message).toBe('Mon 19 Oct – Sun 25 Oct') // the tap is sent as your answer
  await expect(chat.getByRole('button', { name: 'Mon – Fri only' })).toHaveCount(0) // old answers go away

  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(chat).toBeVisible() // the chat stays open beside the week
  await page.getByRole('button', { name: 'Next week' }).click()
  const grid = page.getByRole('region', { name: 'Week grid' })
  await expect(grid.getByRole('list', { name: 'Monday 19 October' })).toContainText('Portfolio')
  await expect(grid.getByRole('list', { name: 'Monday 19 October' })).toContainText('10:00–12:30')
  await expect(grid.getByRole('list', { name: 'Tuesday 20 October' })).toContainText('14:00–15:00')

  // Hovering a task shows its whole name and time (columns are narrow).
  await grid.getByRole('list', { name: 'Monday 19 October' }).getByText('Portfolio').hover()
  await expect(page.getByRole('tooltip')).toContainText('Portfolio10:00–12:30')

  // A later day: you can look and rename, but checking off waits for the day itself.
  await grid.getByRole('button', { name: /Mon\s*19/ }).click()
  await page.getByRole('button', { name: 'List', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Done: Portfolio' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Done: Portfolio' }).hover({ force: true })
  await expect(page.getByRole('tooltip')).toContainText('on the day itself')
  await expect(page.locator('.stamp')).toHaveCount(0)
})

test('opening the week never hides a later morning above now', async ({ page }) => {
  await freshApp(page, '15:00')
  await mockAssistant(page, { body: {
    reply: 'Done.', order: null, suggestions: null,
    actions: [
      { type: 'set_availability', key: '2026-10-18', windows: [{ start: '09:00', end: '18:00' }] },
      task('Gym', 60),
      { ...task('Revise', 90), date: '2026-10-18' },
    ],
    slots: [{ ref: 'Revise', date: '2026-10-18', start: '09:00' }],
  } })
  await page.getByLabel('Tell me everything you have to do').fill('gym today, revise tomorrow morning')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  const sunday = page.getByRole('region', { name: 'Week grid' }).getByRole('list', { name: 'Sunday 18 October' })
  const revise = sunday.getByRole('listitem').filter({ hasText: 'Revise' })
  await expect(revise).toBeInViewport({ ratio: 1 })
  // …and not tucked under the sticky day headers.
  const header = await page.getByRole('region', { name: 'Week grid' }).getByRole('button', { name: /Sun\s*18/ }).boundingBox()
  expect((await revise.boundingBox())!.y).toBeGreaterThan(header!.y + header!.height)
})
