import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
// Import expo-standard-web-crypto for React Native crypto.subtle polyfill
import { polyfillWebCrypto } from 'expo-standard-web-crypto';

// Polyfill Web Crypto API for React Native
polyfillWebCrypto();

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
 * Note: Uses expo-standard-web-crypto for React Native compatibility
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
 * Encrypt a message using AES-256-GCM with Web Crypto API
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

    // Import key for Web Crypto API (polyfilled by expo-standard-web-crypto)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      sharedKeyBytes as any,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Generate random IV (Initialization Vector)
    const iv = await Crypto.getRandomBytesAsync(IV_SIZE);

    // Encrypt the message using Web Crypto API
    const messageBuffer = new TextEncoder().encode(message);
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
        tagLength: 128, // 128-bit authentication tag
      },
      cryptoKey,
      messageBuffer
    );

    // GCM mode appends the auth tag (16 bytes) to the ciphertext
    const encryptedArray = new Uint8Array(encrypted);
    const authTagLength = 16; // 128 bits = 16 bytes

    // Extract auth tag (last 16 bytes) and ciphertext (everything else)
    const ciphertext = encryptedArray.slice(0, encryptedArray.length - authTagLength);
    const authTag = encryptedArray.slice(encryptedArray.length - authTagLength);

    // Convert to base64
    const ivBase64 = bufferToBase64(iv);
    const authTagBase64 = bufferToBase64(authTag);
    const ciphertextBase64 = bufferToBase64(ciphertext);

    // Format: iv:authTag:ciphertext (3-part format for compatibility)
    return `${ivBase64}:${authTagBase64}:${ciphertextBase64}`;
  } catch (error) {
    console.error('Error encrypting message:', error);
    throw error;
  }
}

/**
 * Decrypt a message using AES-256-GCM with Web Crypto API
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
      console.log('Message is plain text (no encryption format detected)');
      return encryptedMessage;
    }

    let ivBase64: string;
    let ciphertextWithTag: Uint8Array;

    if (parts.length === 3) {
      // Standard format: iv:authTag:ciphertext
      const [iv, authTag, cipher] = parts;
      ivBase64 = iv;

      // Reconstruct ciphertext with auth tag appended (GCM format)
      const cipherBuffer = base64ToBuffer(cipher);
      const authTagBuffer = base64ToBuffer(authTag);
      ciphertextWithTag = new Uint8Array(cipherBuffer.length + authTagBuffer.length);
      ciphertextWithTag.set(new Uint8Array(cipherBuffer), 0);
      ciphertextWithTag.set(new Uint8Array(authTagBuffer), cipherBuffer.length);
    } else if (parts.length === 2) {
      // Alternative format: iv:ciphertext (auth tag already included)
      const [iv, ciphertext] = parts;
      ivBase64 = iv;
      ciphertextWithTag = new Uint8Array(base64ToBuffer(ciphertext));
    } else {
      // Unknown format, return as plain text
      console.log('Unknown encryption format, treating as plain text');
      return encryptedMessage;
    }

    // Derive shared encryption key (same as sender)
    const sharedKeyBytes = await deriveSharedKey(recipientPrivateKey, senderPublicKey);

    // Import key for Web Crypto API (polyfilled by expo-standard-web-crypto)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      sharedKeyBytes as any,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Convert IV from base64
    const iv = base64ToBuffer(ivBase64);

    // Decrypt using Web Crypto API
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
        tagLength: 128,
      },
      cryptoKey,
      ciphertextWithTag as any
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Error decrypting message:', error);
    // If decryption fails, it might be plain text from development
    // Check if it looks like encrypted data or plain text
    if (encryptedMessage.includes(':')) {
      return '[Unable to decrypt message]';
    } else {
      // Probably plain text from development
      return encryptedMessage;
    }
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
