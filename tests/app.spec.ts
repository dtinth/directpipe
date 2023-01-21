import { test, expect } from '@playwright/test'

test('has title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/direct/)
})

test('can join room', async ({ page }) => {
  await page.goto('/multi.html')
  await page
    .frameLocator('#left')
    .getByRole('button', { name: 'Share' })
    .click()
  const name = await page
    .frameLocator('#left')
    .getByTestId('Room name')
    .innerText()
  await page
    .frameLocator('#left')
    .getByRole('button', { name: 'Leave' })
    .click()
  await expect(
    page.frameLocator('#left').getByTestId('Room name'),
  ).not.toHaveText(name)
  await expect(
    page.frameLocator('#left').getByTestId('Online user count'),
  ).toHaveText('1')
  const href = await page
    .frameLocator('#left')
    .getByRole('link', { name: 'Open in new window' })
    .getAttribute('href')
  await page
    .frameLocator('#right')
    .locator('body')
    .evaluate(
      (body, href) => (body.ownerDocument.defaultView!.location.href = href!),
      href,
    )
  await expect(
    page.frameLocator('#left').getByTestId('Online user count'),
  ).toHaveText('2')
  await page.frameLocator('#left').locator('#closeRoomModal').click()
  await page
    .frameLocator('#left')
    .locator('body')
    .evaluate((body) =>
      (body.ownerDocument.defaultView! as any).updateState('Hello world!'),
    )
  await page
    .frameLocator('#right')
    .getByRole('button', { name: 'Show contents' })
    .click()
  await expect(page.frameLocator('#right').getByRole('textbox')).toHaveValue(
    'Hello world!',
  )
})
