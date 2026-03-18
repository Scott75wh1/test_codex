const { initDb } = require('../shared/db');
const { seedDemoData } = require('../pipeline/virtualPrinter');

async function run() {
  await initDb();
  const count = await seedDemoData();
  console.log(`Seeded ${count} demo jobs.`);
}

run();
