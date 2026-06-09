import { v2 as cloudinary } from 'cloudinary';
import prisma from './db';

// Global Fallback Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Get a Cloudinary instance dynamically scoped to a tenant
 */
const getTenantCloudinary = async (tenantId?: string) => {
  if (!tenantId) return null;

  const configs = await prisma.siteConfig.findMany({
    where: { tenantId, group: 'integrations' },
    select: { key: true, value: true }
  });

  const { decrypt } = await import('./crypto');
  const cloudName = decrypt(configs.find(c => c.key === 'CLOUDINARY_CLOUD_NAME')?.value || '');
  const apiKey = decrypt(configs.find(c => c.key === 'CLOUDINARY_API_KEY')?.value || '');
  const apiSecret = decrypt(configs.find(c => c.key === 'CLOUDINARY_API_SECRET')?.value || '');

  if (cloudName && apiKey && apiSecret) {
    // Create a fresh instance for this specific tenant
    // (Note: Cloudinary v2 SDK allows configuration overriding on methods directly, but setting it globally might have side effects, 
    // however cloudinary v2 exposes config(). Let's use standard v2 method options).
    return { cloudName, apiKey, apiSecret };
  }
  
  return null;
};

/**
 * Upload a file buffer to Cloudinary.
 * Keeps the same signature as the old uploadToS3 but accepts an optional tenantId.
 */
export const uploadToS3 = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder = 'ecommerce',
  tenantId?: string
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const tenantConfig = await getTenantCloudinary(tenantId);
      
      const options: any = {
        folder,
        resource_type: 'image',
        use_filename: false,
        unique_filename: true,
      };

      const doUpload = (opts: any): Promise<string> => {
        return new Promise((resolveStream, rejectStream) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            opts,
            (error, result) => {
              if (error || !result) {
                rejectStream(error || new Error('Cloudinary upload failed'));
              } else {
                resolveStream(result.secure_url);
              }
            }
          );
          uploadStream.end(buffer);
        });
      };

      if (tenantConfig) {
        options.cloud_name = tenantConfig.cloudName;
        options.api_key = tenantConfig.apiKey;
        options.api_secret = tenantConfig.apiSecret;
      }

      try {
        const url = await doUpload(options);
        resolve(url);
      } catch (err) {
        if (tenantConfig) {
          console.warn('Tenant Cloudinary upload failed, falling back to global config:', err);
          try {
            const globalOptions = { ...options };
            delete globalOptions.cloud_name;
            delete globalOptions.api_key;
            delete globalOptions.api_secret;
            const url = await doUpload(globalOptions);
            resolve(url);
          } catch (globalErr) {
            reject(globalErr);
          }
        } else {
          reject(err);
        }
      }
    } catch (e) {
      reject(e);
    }
  });
};

/**
 * Delete an image from Cloudinary by its URL.
 * Extracts the public_id from the Cloudinary URL automatically.
 */
export const deleteFromS3 = async (url: string, tenantId?: string): Promise<void> => {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.[a-z]+)?$/i);
    if (!match) return;
    const publicId = match[1];

    const tenantConfig = await getTenantCloudinary(tenantId);
    const options: any = {};
    if (tenantConfig) {
        options.cloud_name = tenantConfig.cloudName;
        options.api_key = tenantConfig.apiKey;
        options.api_secret = tenantConfig.apiSecret;
    }

    await cloudinary.uploader.destroy(publicId, options);
  } catch {
    // Silently ignore delete errors (image may already be removed)
  }
};

// Keep a named export alias for compatibility
export { cloudinary };
