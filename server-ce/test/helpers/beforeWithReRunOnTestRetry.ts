export function beforeWithReRunOnTestRetry(fn: () => void | Promise<any>) {
  let ranOnce = false
  beforeEach(() => {
    if (ranOnce && Cypress.currentRetry === 0) return
    ranOnce = true
    return fn()
  })
}
