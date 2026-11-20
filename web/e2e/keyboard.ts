import type { Page } from '@playwright/test'

/** Safari on macOS uses Option+Tab to include buttons in keyboard navigation. */
export async function tabToNextControl(page: Page, backwards = false) {
  const safariOnMac = process.platform === 'darwin' && page.context().browser()?.browserType().name() === 'webkit'
  await page.keyboard.press(`${safariOnMac ? 'Alt+' : ''}${backwards ? 'Shift+' : ''}Tab`)
}
