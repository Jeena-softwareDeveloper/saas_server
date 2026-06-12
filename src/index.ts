console.log("Starting server script...");
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import paymentRoutes from './modules/payments/payments.routes';
import webhookRoutes from './modules/webhooks/webhooks.routes';
import adminRoutes from './modules/admin/admin.routes';
import storeRoutes from './modules/store/store.routes';


// trigger restart
import { errorHandler, notFound } from './middleware/errorHandler';
import { apiEncryptionMiddleware } from './middleware/apiEncrypt';

import prisma from './config/db';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: (origin, callback) => {
      // Dynamically allow all origins to support unlimited decoupled SaaS UI deployments
      callback(null, true);
    },
    credentials: true,
  })
);

app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
import path from 'path';
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});


app.use('/api/auth', apiEncryptionMiddleware, authRoutes);
app.use('/api/users', apiEncryptionMiddleware, userRoutes);
app.use('/api/admin', apiEncryptionMiddleware, adminRoutes);
app.use('/api/store', apiEncryptionMiddleware, storeRoutes);

console.log("Setting up routes...");

app.use(notFound);
app.use(errorHandler);

import http from 'http';

console.log("Starting to listen on port", PORT);
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
