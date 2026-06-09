import CryptoJS from 'crypto-js';

const getEncryptionKey = (dynamicKey?: string): string => {
  if (dynamicKey) return dynamicKey;
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not defined');
  }
  return envKey;
};

export const encrypt = (text: string, dynamicKey?: string): string => {
  if (!text) return '';
  return CryptoJS.AES.encrypt(text, getEncryptionKey(dynamicKey)).toString();
};

export const decrypt = (encryptedText: string, dynamicKey?: string): string => {
  if (!encryptedText) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, getEncryptionKey(dynamicKey));
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      // Fallback for legacy plaintext records
      return encryptedText;
    }
    return decrypted;
  } catch (err) {
    // Fallback if decryption throws an error (e.g. legacy plaintext values)
    return encryptedText;
  }
};
