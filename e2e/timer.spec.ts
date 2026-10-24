import { expect, test, type Page } from '@playwright/test'
import { freshApp, mockAssistant, rows, task } from './helpers'

async function planned(page: Page, actions = [task('Hackathon', 90), task('Gym', 60)], opts = {}) {
  await freshApp(page, '14:00', opts)
  await mockAssistant(page, { body: { reply: 'ok', order: null, actions } })
  await page.getByLabel('What do you need to get done today or this week?').fill('x')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
}

test('focus timer: start late and the day follows, time up asks Done / +15 min / Tomorrow', async ({ page }) => {
  await planned(page)
  const panel = page.getByRole('region', { name: 'Focus timer' })
  await expect(panel).toContainText('Now · until 15:30')
  await page.clock.fastForward('10:00') // 14:10: starting 10 minutes late
  await panel.getByRole('button', { name: 'Start' }).click()
  await expect(panel.getByRole('timer')).toHaveText(/^1:29:\d\d$/)
  await expect.poll(() => rows(page)).toContain('task 14:10–15:40 Hackathon 1h30')
  await expect(page).toHaveTitle(/· Hackathon$/)

  await page.clock.fastForward('01:31:00') // past 15:40
  await expect(panel).toContainText("Time's up")
  await panel.getByRole('button', { name: '+15 min' }).click()
  await expect(panel.getByRole('timer')).toBeVisible()
  await expect.poll(() => rows(page)).toContain('task 15:45–16:00 Hackathon (cont.) 15m')
  await panel.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('checkbox', { name: 'Done: Hackathon' })).toBeChecked()
})

test('focus timer: Pomodoro shows rounds and a short break', async ({ page }) => {
  await planned(page)
  const panel = page.getByRole('region', { name: 'Focus timer' })
  await panel.getByRole('button', { name: 'Start' }).click()
  await panel.getByRole('button', { name: /Countdown/ }).click() // the chip on the running timer
  await page.getByRole('menuitemradio', { name: /Pomodoro/ }).click()
  await expect(panel).toContainText('Focus 1/3')
  await page.clock.fastForward('26:00')
  await expect(panel).toContainText('Short break')
  await page.clock.fastForward('05:00')
  await expect(panel).toContainText('Focus 2/3')
  await panel.getByRole('button', { name: 'Stop' }).click()
  await expect(panel.getByRole('button', { name: 'Start' })).toBeVisible()
})

test('pause in school mode: nothing moves, and the paused minutes are offered back', async ({ page }) => {
  await planned(page)
  const panel = page.getByRole('region', { name: 'Focus timer' })
  await panel.getByRole('button', { name: 'Start' }).click()
  await page.clock.fastForward('20:00')
  await panel.getByRole('button', { name: 'Pause' }).click()
  await expect(panel).toContainText('Paused')
  await page.clock.fastForward('12:00')
  await panel.getByRole('button', { name: 'Resume' }).click()
  expect(await rows(page)).toContain('break 15:30–15:45 Break') // the timetable didn't move
  await page.clock.fastForward('01:00:00')
  await panel.getByRole('button', { name: 'Add back 10 min' }).click()
  await expect.poll(() => rows(page)).toContain('task 15:35–15:45 Hackathon (cont.) 10m')
})

test('an activity gets no Start button, but can use the timer anyway', async ({ page }) => {
  await planned(page, [task('Gym', 60, false), task('Hackathon', 90)])
  const panel = page.getByRole('region', { name: 'Focus timer' })
  await expect(panel).toContainText('Gym')
  await expect(panel.getByRole('button', { name: 'Start' })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Use the timer' }).click()
  await expect(panel.getByRole('timer')).toBeVisible()
})

test('an activity that is next up can use the timer too, and the first time asks how to focus', async ({ page }) => {
  await freshApp(page, '14:00', { chooseTimer: true })
  await mockAssistant(page, { body: { reply: 'ok', order: null, slots: [{ ref: 'Gym', date: null, start: '15:00' }], actions: [task('Gym', 60, false)] } })
  await page.getByLabel('What do you need to get done today or this week?').fill('x')
  await page.keyboard.press('Enter')
  const panel = page.getByRole('region', { name: 'Focus timer' })
  await expect(panel).toContainText('Next · 15:00')
  await panel.getByRole('button', { name: 'Use the timer' }).click()
  await page.getByRole('dialog', { name: 'How do you want to focus?' }).getByRole('button', { name: /One countdown/ }).click()
  await expect(panel.getByRole('timer')).toBeVisible()
})

test('the first Start asks how you want to focus, once, and the mute button turns the sound off', async ({ page }) => {
  await planned(page, undefined, { chooseTimer: true })
  const panel = page.getByRole('region', { name: 'Focus timer' })
  await panel.getByRole('button', { name: 'Start' }).click()
  const bubble = page.getByRole('dialog', { name: 'How do you want to focus?' })
  await expect(bubble).toContainText('You can switch anytime from the timer.')
  await bubble.getByRole('button', { name: /Pomodoro/ }).click()
  await expect(panel).toContainText('Focus 1/3')
  await expect(page.getByText('🍅 Pomodoro on. Tap the label on the timer to switch.')).toBeVisible()
  await panel.getByRole('button', { name: 'Mute the timer' }).click()
  await expect(panel.getByRole('button', { name: 'Turn the timer sound on' })).toBeVisible()
  await panel.getByRole('button', { name: 'Stop' }).click()
  await panel.getByRole('button', { name: 'Start' }).click() // asked only once
  await expect(bubble).toHaveCount(0)
  await expect(panel.getByRole('timer')).toBeVisible()
})

test('notifications: asked on the first Start, Pomodoro breaks always, the rest only when you are elsewhere, a click says welcome back', async ({ page }) => {
  // A stand-in for the browser's notifications that records what Startly sends; "elsewhere" = the window isn't focused.
  await page.addInitScript(() => {
    const w = window as unknown as { __notes: object[]; __asked: number; __focused: boolean; __last: { onclick?: () => void } }
    w.__notes = []
    w.__asked = 0
    w.__focused = true
    class FakeNotification {
      static permission = 'default'
      static requestPermission() {
        w.__asked++
        FakeNotification.permission = 'granted'
        return Promise.resolve('granted')
      }
      onclick?: () => void
      constructor(title: string, opts: NotificationOptions) {
        w.__notes.push({ title, body: opts.body, icon: opts.icon, renotify: (opts as { renotify?: boolean }).renotify, silent: opts.silent })
        w.__last = this
      }
      close() {}
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification })
    Document.prototype.hasFocus = () => w.__focused
  })
  const notes = () => page.evaluate(() => (window as unknown as { __notes: { title: string; body: string }[] }).__notes)
  await planned(page)
  const panel = page.getByRole('region', { name: 'Focus timer' })
  await panel.getByRole('button', { name: 'Start' }).click()
  expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(1)
  await panel.getByRole('button', { name: /Countdown/ }).click()
  await page.getByRole('menuitemradio', { name: /Pomodoro/ }).click()

  // A Pomodoro break and its end always notify, even while Startly seems to be in front.
  await page.clock.fastForward('26:00')
  await expect(panel).toContainText('Short break')
  await expect.poll(async () => (await notes()).map((n) => n.title)).toEqual([expect.stringMatching(/^Break time ☕ · Back to it at \d\d:\d\d\.$/)])
  await page.clock.fastForward('05:00')
  await expect.poll(async () => (await notes()).at(-1)).toEqual({ title: 'Back to work · “Hackathon”', body: undefined, icon: '/notification-icon.png', renotify: true, silent: true })

  // In another app from here on.
  await page.evaluate(() => ((window as unknown as { __focused: boolean }).__focused = false))
  await page.clock.fastForward('25:00')
  await expect.poll(async () => (await notes()).at(-1)).toMatchObject({ title: expect.stringMatching(/^Break time ☕ · Back to it at \d\d:\d\d\.$/) })

  // Clicking it brings you back, and Startly says hello.
  await page.evaluate(() => (window as unknown as { __last: { onclick: () => void } }).__last.onclick())
  await expect(page.getByRole('status').filter({ hasText: 'Welcome back 👋' })).toBeVisible()

  // Away again until the task's time runs out.
  await page.evaluate(() => ((window as unknown as { __focused: boolean }).__focused = false))
  await page.clock.fastForward('40:00')
  await expect(panel).toContainText("Time's up")
  await expect.poll(async () => (await notes()).at(-1)).toMatchObject({ title: "Time's up", body: '“Hackathon”: done, or need more time?' })
})
