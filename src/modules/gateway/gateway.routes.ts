import express, { Router, Request, Response } from 'express';
import { decrypt } from '../../config/crypto';

const router = Router();

// Read raw text ciphertext regardless of content-type
router.use(express.text({ type: '*/*', limit: '10mb' }));

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const PORT = process.env.PORT || 5000;
    
    // 1. Get raw ciphertext from request body
    const ciphertext = req.body;
    if (!ciphertext || typeof ciphertext !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ciphertext payload' });
      return;
    }

    // 2. Decrypt the payload
    const decrypted = decrypt(ciphertext);
    if (!decrypted || (!decrypted.startsWith('{') && !decrypted.startsWith('['))) {
      res.status(400).json({ success: false, message: 'Payload decryption failed' });
      return;
    }

    const payload = JSON.parse(decrypted);
    const { url, method = 'GET', data, params } = payload;

    if (!url) {
      res.status(400).json({ success: false, message: 'Missing target URL in gateway payload' });
      return;
    }

    // 3. Construct local request URL query parameters
    let queryStr = '';
    if (params && typeof params === 'object') {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          q.append(key, String(val));
        }
      });
      const qString = q.toString();
      if (qString) {
        queryStr = '?' + qString;
      }
    }

    // Construct local target URL
    const targetPath = url.startsWith('/api') ? url : `/api${url.startsWith('/') ? url : '/' + url}`;
    const localUrl = `http://localhost:${PORT}${targetPath}${queryStr}`;

    // 4. Forward headers from original request
    const headers: Record<string, string> = {};
    Object.entries(req.headers).forEach(([key, val]) => {
      if (val && key !== 'host' && key !== 'content-length' && key !== 'content-type') {
        headers[key] = Array.isArray(val) ? val.join(', ') : val;
      }
    });

    if (data) {
      headers['content-type'] = 'application/json';
    }

    // 5. Send local fetch request
    const response = await fetch(localUrl, {
      method: method.toUpperCase(),
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    // 6. Read response body (which is already encrypted by routes, or error JSON)
    const resText = await response.text();

    // 7. Forward headers and status back to client
    res.status(response.status);
    
    response.headers.forEach((val, key) => {
      if (key !== 'content-encoding' && key !== 'transfer-encoding' && key !== 'connection') {
        res.setHeader(key, val);
      }
    });

    res.send(resText);
  } catch (err) {
    console.error('API Gateway error:', err);
    res.status(500).json({ success: false, message: 'Gateway dispatch error' });
  }
});

export default router;
