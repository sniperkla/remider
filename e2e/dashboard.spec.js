import { test, expect } from '@playwright/test';

test.describe('Dashboard Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { name: 'Test User', email: 'test@example.com' },
          expires: '2026-01-01T00:00:00.000Z',
        }),
      });
    });

    await page.route('**/api/data**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            balance: { bank: 1000, cash: 500 },
            accounts: [{ id: 'acc1', name: 'KBank', balance: 1000, type: 'bank', color: '#10b981' }],
            transactions: [],
            budget: 500,
            monthlyBudget: 15000,
            onboardingTasks: { completed: true }
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/');
  });

  test('should display initial balances correctly', async ({ page }) => {
    // Using a more specific selector to avoid ambiguity
    // Usually balances are in h2 or specific divs
    const bankBalance = page.locator('text=฿1,000.00').first();
    const cashBalance = page.locator('text=฿500.00').first();
    await expect(bankBalance).toBeVisible();
    await expect(cashBalance).toBeVisible();
  });

  test('should manually add an expense transaction', async ({ page }) => {
    const manualButton = page.locator('button:has-text("จดเอง"), button:has-text("Manual Entry")').first();
    await manualButton.click();
    
    const amountInput = page.locator('input[placeholder="0.00"], input[type="number"]').first();
    await amountInput.fill('200');
    
    const descInput = page.locator('input[placeholder*="รายละเอียด"], input[placeholder*="Description"]').first();
    await descInput.fill('Lunch Test');
    
    await page.route('**/api/transactions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ _id: 'new-tx', amount: 200, description: 'Lunch Test', type: 'expense', category: 'อาหาร', date: new Date().toISOString() })
        });
      }
    });

    const saveButton = page.locator('button:has-text("บันทึก"), button:has-text("Save")').first();
    await saveButton.click();
    
    // Check for the appearance of the new transaction
    await expect(page.locator('text=Lunch Test').first()).toBeVisible();
  });
});
