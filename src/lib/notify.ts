/**
 * The timer's desktop notifications: asked once (on the first Start), shown only when Startly isn't the window
 * you're looking at (a Pomodoro break and its end: always, as browsers can think you're looking when you're not), silent (Startly's own sound already plays). One at a time: a new one replaces the last.
 * A click brings you back to the tab, where Startly says hello.
 */
const supported = () => typeof window !== 'undefined' && 'Notification' in window

/** From a click (browsers only ask after one). Asks once: Allow or Block is remembered by the browser. */
export function askNotifications() {
  if (supported() && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
}

export const BACK_EVENT = 'startly:back'

/** About what a Mac banner's title line shows before cutting it with "…". */
const MAX_TITLE = 40

export function notify(title: string, body: string, always = false) {
  if (!supported() || Notification.permission !== 'granted') return
  if (!always && document.visibilityState === 'visible' && document.hasFocus()) return // you're looking at Startly: the timer says it
  try {
    // renotify: a new one replacing the last still pops up (without it, a replacement only updates quietly in the
    // notification center, e.g. behind one sent while the computer was still blocking the browser).
    // All on the title line: Chrome on a Mac puts the site's address between the title and the body, so with no body
    // it comes last. Too long for one line (it would be cut), the rest goes under it.
    const line = `${title} · ${body}`
    const short = line.length <= MAX_TITLE
    const options = { ...(!short && { body }), icon: '/notification-icon.png', tag: 'startly-timer', renotify: true, silent: true }
    const n = new Notification(short ? line : title, options as NotificationOptions)
    n.onclick = () => {
      window.focus()
      n.close()
      window.dispatchEvent(new Event(BACK_EVENT))
    }
  } catch {
    // (Chrome on Android only allows notifications from a service worker: there, the sound is enough.)
  }
}
