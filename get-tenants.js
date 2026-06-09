require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.tenant.findMany().then(t => { console.log(JSON.stringify(t, null, 2)); prisma.$disconnect(); }).catch(console.error);
