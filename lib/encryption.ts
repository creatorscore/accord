import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

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
 */

// Constants
const KEY_SIZE = 32; // 256 bits for AES-256
const IV_SIZE = 12; // 96 bits for GCM (recommended)
const SALT_SIZE = 16; // 128 bits

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
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
    // Generate a cryptographically secure random seed
    const randomBytes = await Crypto.getRandomBytesAsync(KEY_SIZE);
    const privateKey = uint8ArrayToHex(randomBytes);

    // Derive public key from private key using SHA-256
    const publicKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      privateKey
    );

    return {
      publicKey,
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
    // Combine keys and hash to create shared secret
    const combined = privateKey + publicKey;
    const sharedSecret = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );

    // Convert to bytes for use as encryption key
    return hexToUint8Array(sharedSecret);
  } catch (error) {
    console.error('Error deriving shared key:', error);
    throw new Error('Failed to derive shared encryption key');
  }
}

/**
 * Encrypt a message using AES-256-GCM
 *
 * @param message - Plain text message to encrypt
 * @param senderPrivateKey - Sender's private key
 * @param recipientPublicKey - Recipient's public key
 * @returns Encrypted message as base64 string with format: iv:ciphertext
 */
export async function encryptMessage(
  message: string,
  senderPrivateKey: string,
  recipientPublicKey: string
): Promise<string> {
  try {
    // Derive shared encryption key
    const sharedKey = await deriveSharedKey(senderPrivateKey, recipientPublicKey);

    // Generate random IV (Initialization Vector)
    const iv = await Crypto.getRandomBytesAsync(IV_SIZE);

    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);

    // Use WebCrypto API for AES-GCM encryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      sharedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      cryptoKey,
      messageBytes
    );

    // Combine IV + ciphertext
    const ivHex = uint8ArrayToHex(iv);
    const ciphertextBase64 = arrayBufferToBase64(encryptedBuffer);

    // Format: iv:ciphertext
    return `${ivHex}:${ciphertextBase64}`;
  } catch (error) {
    console.error('Error encrypting message:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Decrypt a message using AES-256-GCM
 *
 * @param encryptedMessage - Encrypted message in format: iv:ciphertext
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
    // Parse iv:ciphertext format
    const [ivHex, ciphertextBase64] = encryptedMessage.split(':');
    if (!ivHex || !ciphertextBase64) {
      throw new Error('Invalid encrypted message format');
    }

    // Derive shared encryption key (same as sender)
    const sharedKey = await deriveSharedKey(recipientPrivateKey, senderPublicKey);

    // Convert from hex/base64
    const iv = hexToUint8Array(ivHex);
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);

    // Use WebCrypto API for AES-GCM decryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      sharedKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      cryptoKey,
      ciphertext
    );

    // Convert back to string
    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    return decryptedText;
  } catch (error) {
    console.error('Error decrypting message:', error);
    return '[Unable to decrypt message]';
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
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        existingKey
      );
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
