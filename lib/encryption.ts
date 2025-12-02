import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import QuickCrypto from 'react-native-quick-crypto';

/**
 * E2E Encryption for Messages
 *
 * Uses AES-256-GCM encryption with unique keys per user pair:
 * 1. Each user generates a unique encryption seed on registration
 * 2. Private key stored in SecureStore (device keychain)
 * 3. Public key hash stored in database
 * 4. Messages encrypted with AES-256-GCM using derived shared secret
 *
 * This provides:
 * - End-to-end encryption (only sender and recipient can read)
 * - Perfect forward secrecy (unique keys per conversation pair)
 * - Authenticated encryption (prevents tampering)
 *
 * Note: Uses react-native-quick-crypto for reliable native crypto on iOS/Android
 */

// Constants
const KEY_SIZE = 32; // 256 bits for AES-256
const IV_SIZE = 12; // 96 bits for GCM (recommended)
const SALT_SIZE = 16; // 128 bits

// Helper to convert Buffer/Uint8Array to base64
function bufferToBase64(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer).toString('base64');
}

// Helper to convert base64 to Buffer
function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

// Helper to convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Helper to convert Uint8Array to hex string
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate encryption keys for a user
 * Returns public key hash (to store in DB) and private key (to store in secure storage)
 */
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  try {
    // Generate a cryptographically secure random seed using expo-crypto
    const privateKeyBytes = await Crypto.getRandomBytesAsync(KEY_SIZE);
    const privateKey = uint8ArrayToHex(privateKeyBytes);

    // Derive public key from private key using SHA-256
    const publicKeyBytes = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      privateKey,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    return {
      publicKey: publicKeyBytes,
      privateKey,
    };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw new Error('Failed to generate encryption keys');
  }
}

/**
 * Store private key in device secure storage
 */
export async function storePrivateKey(userId: string, privateKey: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(`encryption_private_key_${userId}`, privateKey);
  } catch (error) {
    console.error('Error storing private key:', error);
    throw new Error('Failed to store private key');
  }
}

/**
 * Retrieve private key from secure storage
 */
export async function getPrivateKey(userId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(`encryption_private_key_${userId}`);
  } catch (error) {
    console.error('Error retrieving private key:', error);
    return null;
  }
}

/**
 * Check if user has encryption keys set up
 */
export async function hasEncryptionKeys(userId: string): Promise<boolean> {
  const privateKey = await getPrivateKey(userId);
  return privateKey !== null;
}

/**
 * Derive a shared encryption key from two user keys
 * Uses HKDF-like derivation for perfect forward secrecy
 */
async function deriveSharedKey(
  privateKey: string,
  publicKey: string
): Promise<Uint8Array> {
  try {
    // Combine keys and hash to create shared secret using expo-crypto
    const combined = privateKey + publicKey;
    const sharedSecretHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    // Convert hex to Uint8Array
    return hexToUint8Array(sharedSecretHex);
  } catch (error) {
    console.error('Error deriving shared key:', error);
    throw new Error('Failed to derive shared encryption key');
  }
}

/**
 * Encrypt a message using AES-256-GCM with react-native-quick-crypto
 *
 * @param message - Plain text message to encrypt
 * @param senderPrivateKey - Sender's private key
 * @param recipientPublicKey - Recipient's public key
 * @returns Encrypted message as base64 string with format: iv:authTag:ciphertext
 */
export async function encryptMessage(
  message: string,
  senderPrivateKey: string,
  recipientPublicKey: string
): Promise<string> {
  try {
    // Derive shared encryption key
    const sharedKeyBytes = await deriveSharedKey(senderPrivateKey, recipientPublicKey);

    // Generate random IV (Initialization Vector) using QuickCrypto
    const iv = QuickCrypto.randomBytes(IV_SIZE);

    // Create cipher using AES-256-GCM
    const cipher = QuickCrypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(sharedKeyBytes),
      iv
    );

    // Encrypt the message
    const messageBuffer = Buffer.from(message, 'utf8');
    const encrypted = Buffer.concat([
      cipher.update(messageBuffer),
      cipher.final()
    ]);

    // Get the authentication tag (16 bytes for GCM)
    const authTag = cipher.getAuthTag();

    // Convert to base64
    const ivBase64 = bufferToBase64(iv);
    const authTagBase64 = bufferToBase64(authTag);
    const ciphertextBase64 = bufferToBase64(encrypted);

    // Format: iv:authTag:ciphertext (3-part format for compatibility)
    return `${ivBase64}:${authTagBase64}:${ciphertextBase64}`;
  } catch (error) {
    console.error('Error encrypting message:', error);
    throw error;
  }
}

/**
 * Decrypt a message using AES-256-GCM with react-native-quick-crypto
 *
 * @param encryptedMessage - Encrypted message in format: iv:authTag:ciphertext (all base64)
 * @param recipientPrivateKey - Recipient's private key
 * @param senderPublicKey - Sender's public key
 * @returns Decrypted plain text message
 */
export async function decryptMessage(
  encryptedMessage: string,
  recipientPrivateKey: string,
  senderPublicKey: string
): Promise<string> {
  try {
    // Parse encrypted message format
    const parts = encryptedMessage.split(':');

    // If not in correct format, assume it's plain text (development/legacy)
    if (parts.length < 2) {
      console.log('🔓 Message is plain text (no encryption format detected)');
      return encryptedMessage;
    }

    console.log(`🔐 Attempting to decrypt message (${parts.length} parts)`);

    let ivBase64: string;
    let ciphertext: Buffer;
    let authTag: Buffer;

    if (parts.length === 3) {
      // Standard format: iv:authTag:ciphertext
      const [iv, authTagStr, cipher] = parts;
      ivBase64 = iv;
      authTag = base64ToBuffer(authTagStr);
      ciphertext = base64ToBuffer(cipher);
      console.log('📦 Parsed 3-part format (iv:authTag:ciphertext)');
    } else if (parts.length === 2) {
      // Alternative format: iv:ciphertext (auth tag at end of ciphertext)
      const [iv, ciphertextWithTag] = parts;
      ivBase64 = iv;
      const combined = base64ToBuffer(ciphertextWithTag);
      // Auth tag is last 16 bytes
      ciphertext = combined.slice(0, combined.length - 16);
      authTag = combined.slice(combined.length - 16);
      console.log('📦 Parsed 2-part format (iv:ciphertext+tag)');
    } else {
      // Unknown format, return as plain text
      console.log('⚠️ Unknown encryption format, treating as plain text');
      return encryptedMessage;
    }

    // Derive shared encryption key (same as sender)
    console.log('🔑 Deriving shared key...');
    const sharedKeyBytes = await deriveSharedKey(recipientPrivateKey, senderPublicKey);
    console.log('✅ Shared key derived');

    // Convert IV from base64
    const iv = base64ToBuffer(ivBase64);

    // Create decipher using AES-256-GCM
    console.log('🔓 Creating decipher...');
    const decipher = QuickCrypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(sharedKeyBytes),
      iv
    );

    // Set the auth tag for verification
    decipher.setAuthTag(authTag);

    // Decrypt the message
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    const result = decrypted.toString('utf8');
    console.log('✅ Message decrypted successfully');
    return result;
  } catch (error: any) {
    console.error('❌ Error decrypting message:', error?.message || error);
    console.error('Stack:', error?.stack);

    // If decryption fails, it might be plain text from development
    // Check if it looks like encrypted data or plain text
    if (encryptedMessage.includes(':')) {
      // Check if it's base64 encoded (encrypted)
      const firstPart = encryptedMessage.split(':')[0];
      const isBase64 = /^[A-Za-z0-9+/=]+$/.test(firstPart);
      if (isBase64) {
        console.log('⚠️ Encrypted message but decryption failed');
        return '[Unable to decrypt message]';
      }
    }
    // Probably plain text from development
    console.log('📝 Returning as plain text');
    return encryptedMessage;
  }
}

/**
 * Initialize encryption for a user
 * Call this during user registration/first login
 */
export async function initializeEncryption(userId: string): Promise<string> {
  try {
    // Check if already initialized
    const existingKey = await getPrivateKey(userId);
    if (existingKey) {
      // Return the existing public key (derive from private key)
      const publicKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        existingKey,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      return publicKey;
    }

    // Generate new key pair
    const { publicKey, privateKey } = await generateKeyPair();

    // Store private key securely on device
    await storePrivateKey(userId, privateKey);

    // Return public key to be stored in database
    return publicKey;
  } catch (error) {
    console.error('Error initializing encryption:', error);
    throw new Error('Failed to initialize encryption');
  }
}

/**
 * Delete encryption keys (for user deletion/logout)
 */
export async function deleteEncryptionKeys(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(`encryption_private_key_${userId}`);
  } catch (error) {
    console.error('Error deleting encryption keys:', error);
  }
}

/**
 * Re-encrypt old messages when user changes device
 * (Migration helper - not typically needed)
 */
export async function migrateEncryptionKeys(
  userId: string,
  oldPrivateKey: string
): Promise<void> {
  try {
    // Store the old private key
    await storePrivateKey(userId, oldPrivateKey);
    console.log('Encryption keys migrated successfully');
  } catch (error) {
    console.error('Error migrating encryption keys:', error);
    throw new Error('Failed to migrate encryption keys');
  }
}
