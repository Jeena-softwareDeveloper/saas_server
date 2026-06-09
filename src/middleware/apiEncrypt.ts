import { Request, Response, NextFunction } from 'express';
import { encrypt } from '../config/crypto';

export const apiEncryptionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function (body: any) {
    if ((req as any).skipEncryption) {
      return originalJson.call(this, body);
    }
    if (body && body.success !== false) {
      try {
        const rawString = JSON.stringify(body);
        const dynamicKey = (req as any).tenant?.encryptionKey || undefined;
        const encryptedString = encrypt(rawString, dynamicKey);
        res.setHeader('Content-Type', 'text/plain');
        return originalSend.call(this, encryptedString);
      } catch (err) {
        console.error('API Encryption failed:', err);
      }
    }
    return originalJson.call(this, body);
  };

  next();
};

