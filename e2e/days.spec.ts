import { expect, test, type Page } from '@playwright/test'
import { TODAY, freshApp, mockAssistant, rows, task } from './helpers'

const SUN = '2026-10-18'
const say = async (page: Page, text: string) => {
  await page.getByLabel('Message Startly').fill(text)
  await page.getByLabel('Message Startly').press('Enter')
}
async function dump(page: Page, time: string, ...responses: { status?: number; body: unknown }[]) {
  await freshApp(page, time)
  const sent = await mockAssistant(page, ...responses)
  await page.getByLabel('What do you need to get done today or this week?').fill('my day')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  return sent
}

test('a change that would run late asks first; nothing moves until you answer; Keep it / Move it work', async ({ page }) => {
  const sent = await dump(page, '19:30',
    { body: { reply: 'Here you go.', order: null, actions: [task('Hack', 120), task('Review notes', 60)] } },
    { body: { reply: 'Got it.', order: null, actions: [{ type: 'extend_task', id: 't1', extraMin: 60 }] } },
    { body: { reply: 'Got it.', order: null, actions: [{ type: 'extend_task', id: 't1', extraMin: 60 }] } },
  )
  const before = await rows(page)
  await say(page, 'I need one more hour on the hack')
  await expect(page.getByText("That puts you until 23:45. OK, or should I move 'Review notes' to Sunday?")).toBeVisible()
  expect(await rows(page)).toEqual(before) // nothing changed yet

  // The AI is told about the open question.
  await page.getByRole('button', { name: 'Keep it' }).click()
  await expect.poll(() => rows(page)).toContainEqual(expect.stringMatching(/Review notes/))
  await expect(page.locator('main section > div.sticky')).toContainText('until 23:45')
  await expect(page.getByText('You chose: Keep it')).toBeVisible()

  // Same question again, this time "Move it" → it goes to Sunday, visible in the week strip.
  await page.clock.setFixedTime(new Date(`${TODAY}T19:31:00`))
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('startly-v1')!)
    s.state.dayEnds = {}
    localStorage.setItem('startly-v1', JSON.stringify(s))
  })
  await page.reload()
  await page.getByRole('button', { name: 'Ask Startly' }).click()
  await say(page, 'one more hour on the hack')
  await page.getByRole('button', { name: 'Move it' }).click()
  await expect.poll(() => rows(page)).not.toContainEqual(expect.stringMatching(/Review notes/))
  expect((sent[2] as { context: { pending: unknown } }).context.pending).toBeNull()

  await page.getByRole('button', { name: /show the week/ }).click()
  await page.getByRole('button', { name: /Sunday 18 October/ }).click()
  await expect(page.getByRole('heading', { name: 'Tomorrow' })).toBeVisible()
  await expect(page.getByRole('list', { name: "Tomorrow's tasks" })).toContainText('Review notes')
  await expect(page.getByText('Free time unknown')).toBeVisible()
})

test("first dump: a new task that doesn't fit → the plan still appears, Startly asks Stay / Sunday / Drop it", async ({ page }) => {
  await dump(page, '20:00', { body: { reply: 'Here you go.', order: null, actions: [task('Hack', 150), task('Groceries', 45)] } })
  expect(await rows(page)).toContainEqual(expect.stringMatching(/Hack/))
  await expect(page.getByText(/^'Groceries' doesn't fit before 23:00\. Stay until \d\d:\d\d, move it to Sunday, or drop it\?$/)).toBeVisible()
  await expect(page.getByRole('list', { name: "Doesn't fit today" })).toContainText('Groceries')
  await page.getByRole('button', { name: 'Drop it' }).click()
  await expect(page.getByRole('list', { name: "Doesn't fit today" })).toBeHidden()
})

test('the week strip: fixed Monday to Sunday, arrows a week at a time, Today, past days read-only', async ({ page }) => {
  await dump(page, '10:00', { body: { reply: 'ok', order: null, actions: [
    task('Gym', 60),
    { type: 'add_fixed', title: 'Interview', date: '2026-10-21', start: '11:30', end: '12:00' },
    { ...task('Revise', 90), date: SUN },
  ] } })
  const strip = page.getByRole('navigation', { name: 'This week' })
  await expect(strip).toBeHidden()
  await page.getByRole('button', { name: /show the week/ }).click()
  const days = strip.getByRole('listitem')
  await expect(days).toHaveCount(7)
  await expect(days.first()).toContainText('Mon12') // Saturday 17: the week of Monday 12
  await expect(days.nth(5)).toContainText('Today')
  await expect(strip).toContainText('October 2026')
  await expect(page.getByRole('button', { name: /Sunday 18 October: 1h30 planned/ })).toBeVisible()
  await expect(strip.getByRole('button', { name: 'Today' })).toBeDisabled() // already on today

  // Next week: the same weekday, one week later.
  await strip.getByRole('button', { name: 'Next week' }).click()
  await expect(days.first()).toContainText('Mon19')
  await expect(page.getByRole('heading', { name: 'Saturday 24 October' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Wednesday 21 October: 30m planned, fixed appointment/ })).toContainText('Fixed')
  await page.getByRole('button', { name: /Wednesday 21 October/ }).click()
  await expect(page.getByRole('heading', { name: 'Wednesday 21 October' })).toBeVisible()
  await expect(page.getByRole('list', { name: "Wednesday 21 October's tasks" })).toContainText('11:30Interview')

  // Today brings you back; a past day of the week opens read-only.
  await strip.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.getByRole('button', { name: /Monday 12 October/ }).click()
  await expect(page.getByRole('heading', { name: 'Monday 12 October' })).toBeVisible()
  await strip.getByRole('button', { name: 'Previous week' }).click()
  await expect(days.first()).toContainText('Mon5')
  await page.getByRole('button', { name: /hide the week/ }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
})

test('Week view: 7 columns of hours, a click on a day opens it, the chat stays open', async ({ page }) => {
  await dump(page, '10:00', { body: { reply: 'ok', order: null, actions: [
    task('Gym', 60),
    { type: 'add_fixed', title: 'Interview', date: '2026-10-21', start: '11:30', end: '12:00' },
    { ...task('Revise', 90), date: SUN },
  ] } })
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Chat with Startly' })).toBeVisible()
  const grid = page.getByRole('region', { name: 'Week grid' })
  await expect(page.getByRole('heading', { name: /^12\s*–\s*18 Oct$/ })).toBeVisible()
  await expect(grid.getByRole('list', { name: 'Saturday 17 October' })).toContainText('Gym')
  await expect(grid).toContainText('No time yet') // Sunday's revision has no time: free time that day is unknown
  await expect(grid.getByRole('list', { name: 'Saturday 17 October' }).getByLabel('Now')).toBeVisible()
  await page.getByRole('button', { name: 'Next week' }).click()
  await expect(page.getByRole('heading', { name: /^19\s*–\s*25 Oct$/ })).toBeVisible()
  await expect(grid).toContainText('Interview')
  await grid.getByRole('button', { name: /Wed\s*21/ }).click()
  await expect(page.getByRole('heading', { name: 'Wednesday 21 October' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Day', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('a reply that does not answer keeps the question open; a question from yesterday expires', async ({ page }) => {
  await dump(page, '19:30',
    { body: { reply: 'Here you go.', order: null, actions: [task('Hack', 120), task('Review notes', 60)] } },
    { body: { reply: 'Got it.', order: null, actions: [{ type: 'extend_task', id: 't1', extraMin: 60 }] } },
    { body: { reply: 'Until about 23:45.', order: null, actions: [] } },
  )
  await say(page, 'one more hour on the hack')
  await expect(page.getByRole('button', { name: 'Keep it' })).toBeEnabled()
  await say(page, 'how late is that?')
  await expect(page.getByText('Until about 23:45.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Keep it' })).toBeEnabled()

  // Next morning: a fresh chat; yesterday's question is gone and can't be answered anymore.
  await page.clock.setFixedTime(new Date('2026-10-18T09:00:00'))
  await page.reload()
  await expect(page.locator('[data-role=assistant]').first()).toContainText(/Good morning/)
  await expect(page.getByRole('button', { name: 'Keep it' })).toHaveCount(0)
})

test('a day that is over: stamped with how it went, nothing to check; you can still read it', async ({ page }) => {
  await dump(page, '10:00', { body: { reply: 'ok', order: null, actions: [task('Gym', 60), task('Read', 30)] } })
  await page.getByRole('checkbox', { name: 'Done: Gym' }).click()
  await page.clock.setFixedTime(new Date('2026-10-18T09:00:00'))
  await page.reload()
  await page.getByRole('button', { name: /show the week/ }).click()
  await page.getByRole('button', { name: /Saturday 17 October/ }).click()
  await expect(page.getByRole('heading', { name: 'Saturday 17 October' })).toBeVisible()
  await expect(page.locator('.stamp')).toHaveText('1/2 done') // grey: not everything was checked
  await expect(page.locator('.stamp')).toHaveClass(/text-mut/)
  await expect(page.getByRole('checkbox', { name: 'Done: Gym' })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: 'Done: Gym' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Done: Read' })).toBeDisabled()
  // (Hover again until the tooltip shows: a hover during the day's slide-in animation can be missed.)
  await expect(async () => {
    await page.mouse.move(0, 0)
    await page.getByRole('checkbox', { name: 'Done: Read' }).hover({ force: true })
    await expect(page.getByRole('tooltip')).toContainText('This day is over', { timeout: 1000 })
  }).toPass()
  // Today has no stamp.
  await page.getByRole('navigation', { name: 'This week' }).getByRole('button', { name: 'Today' }).click()
  await expect(page.locator('.stamp')).toHaveCount(0)
})

/** Plan Gym and Read today, check some of them, then open the day from tomorrow. */
async function yesterday(page: Page, check: string[]) {
  await dump(page, '10:00', { body: { reply: 'ok', order: null, actions: [task('Gym', 60), task('Read', 30)] } })
  for (const name of check) await page.getByRole('checkbox', { name: `Done: ${name}` }).click()
  await page.clock.setFixedTime(new Date('2026-10-18T09:00:00'))
  await page.reload()
  await page.getByRole('button', { name: /show the week/ }).click()
  await page.getByRole('button', { name: /Saturday 17 October/ }).click()
  await expect(page.getByRole('heading', { name: 'Saturday 17 October' })).toBeVisible()
}

test('a day with everything checked is stamped Done ✓ in the accent color', async ({ page }) => {
  await yesterday(page, ['Gym', 'Read'])
  await expect(page.locator('.stamp')).toHaveText('Done ✓')
  await expect(page.locator('.stamp')).toHaveClass(/text-acc/)
})

test('a day with nothing checked gets no stamp', async ({ page }) => {
  await yesterday(page, [])
  await expect(page.getByRole('checkbox', { name: 'Done: Gym' })).toBeDisabled() // still read-only
  await expect(page.locator('.stamp')).toHaveCount(0)
})

test('an empty day says so in the middle of the page', async ({ page }) => {
  await dump(page, '10:00', { body: { reply: 'ok', order: null, actions: [task('Gym', 60)] } })
  await page.getByRole('button', { name: /show the week/ }).click()
  const centered = async (text: string) => {
    const line = page.getByText(text, { exact: true })
    await expect(line).toBeVisible()
    const box = (await line.boundingBox())!
    const main = (await page.locator('main').boundingBox())!
    expect(Math.abs(box.x + box.width / 2 - (main.x + main.width / 2))).toBeLessThan(30) // centered across
    expect(box.y + box.height / 2).toBeGreaterThan(main.y + 250) // down in the page, not by the title
  }
  await page.getByRole('button', { name: /Friday 16 October/ }).click() // a past day with nothing
  await centered('Nothing planned that day')
  await page.getByRole('button', { name: /Sunday 18 October/ }).click() // a later day with nothing
  await centered('Nothing planned for this day yet.')
})

test('a day at a time: arrows by the title, Today to come back, ← → keys; with the week strip open, the strip does it', async ({ page }) => {
  await dump(page, '10:00', { body: { reply: 'ok', order: null, actions: [task('Gym', 60)] } })
  const heading = page.getByRole('heading', { level: 2 })
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveCount(0) // already on today
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(heading).toHaveText('Tomorrow')
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(heading).toHaveText('Monday 19 October')
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(heading).toHaveText('Today')
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(heading).toHaveText('Friday 16 October')

  // The keyboard, but not while typing in the chat.
  await page.locator('main').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('ArrowRight')
  await expect(heading).toHaveText('Today')
  await page.getByLabel('Message Startly').fill('hello')
  await page.getByLabel('Message Startly').press('ArrowLeft')
  await expect(heading).toHaveText('Today')

  // The week strip open: its own arrows and days, no second set by the title.
  await page.getByRole('button', { name: /show the week/ }).click()
  await expect(page.getByRole('button', { name: 'Next day' })).toHaveCount(0)
})
