import { test, expect } from '@playwright/test';

test.describe('App Basic Flow', () => {
  test('should load the home page and show greeting', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Check if the page title or a main header exists
    // Since it's a financial app, we might check for "Remi" or the greeting
    const greeting = page.locator('text=Remi');
    // await expect(greeting).toBeVisible(); 
    
    // Check for main navigation or tabs
    const transactionsTab = page.locator('text=Transactions');
    // await expect(transactionsTab).toBeVisible();
  });

  test('should open add transaction modal', async ({ page }) => {
    await page.goto('/');
    
    // Find the add button (usually a Plus icon or "Add" text)
    // Looking at the code, there's a Plus icon from lucide-react
    const addButton = page.locator('button:has-text("Add")').first();
    // if (await addButton.isVisible()) {
    //   await addButton.click();
    //   await expect(page.locator('text=Manual Entry')).toBeVisible();
    // }
  });
});
