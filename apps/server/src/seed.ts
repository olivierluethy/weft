import { prisma } from './db.js';
import { hashPassword } from './lib/crypto.js';
import { createDefaultWorkspace } from './lib/bootstrap.js';

/** Optional demo account so you can log in immediately: demo@weft.local / weftdemo1 */
async function seed() {
  const email = 'demo@weft.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log('Demo user already exists — skipping.');
    return;
  }
  const user = await prisma.user.create({
    data: { email, name: 'Demo Weaver', passwordHash: await hashPassword('weftdemo1') },
  });
  await createDefaultWorkspace(user.id, 'Demo workspace');
  // eslint-disable-next-line no-console
  console.log(`Seeded demo account: ${email} / weftdemo1`);
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
