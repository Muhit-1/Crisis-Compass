/**
 * Makes a transient error message disappear on its own.
 *
 * Call from a component's script. `getMessage` is read reactively; once a
 * message has been visible for `ms` it is hidden until a *different* message
 * (or a cleared-then-returning one) arrives, so a retry that fails again shows
 * its error afresh.
 */
export const ERROR_TOAST_MS = 8000

export function autoDismiss(
  getMessage: () => string | null | undefined,
  ms: number = ERROR_TOAST_MS,
) {
  let dismissed = $state<string | null>(null)

  $effect(() => {
    const message = getMessage() ?? null
    if (!message) {
      dismissed = null
      return 
    }
    if (message === dismissed) return

    const timer = setTimeout(() => {
      dismissed = message
    }, ms)
    return () => clearTimeout(timer)
  })

  return {
    /** The message while it should be shown, otherwise null. */
    get message(): string | null {
      const message = getMessage() ?? null
      return message && message !== dismissed ? message : null
    },
  }
}
