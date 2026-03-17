// Global teardown: disconnect Prisma client after all tests in a suite
// Only disconnects if the db module was actually loaded by the test suite
afterAll(async () => {
  try {
    // Lazy-require so suites that don't use the DB don't trigger a connection
    const { db } = await import('@/lib/db');
    await db.$disconnect();
  } catch {
    // db module not loaded or already disconnected — safe to ignore
  }
});
