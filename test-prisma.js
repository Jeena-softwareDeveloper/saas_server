require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const s = await prisma.activeSession.findUnique({
      where: { sessionId_path: { sessionId: 'test', path: '/admin' } }
    });
    console.log('success findUnique');
  } catch(e) {
    console.error('Error in findUnique:', e.message);
  }
  
  try {
    const reqBody = { action: 'ENTER', entity: 'Page', details: { path: '/admin' }, sessionId: 'test1234' };
    await prisma.activityLog.create({
      data: {
        tenantId: null,
        userId: null,
        action: reqBody.action,
        entity: reqBody.entity,
        entityId: null,
        details: reqBody.details
      }
    });
    console.log('success activityLog');
  } catch (e) {
    console.error('Error in activityLog:', e.message);
  }

  process.exit(0);
})();
