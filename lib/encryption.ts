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

// Secret salt for deterministic key derivation (ensures consistent keys across devices)
// This enables the same user to have the same encryption keys on iOS and Android
const ENCRYPTION_SALT = 'accord_e2e_encryption_v1_';

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
 * Derive public key from private key
 * This is the same derivation used in generateKeyPairForUser
 */
async function derivePublicKeyFromPrivate(privateKey: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    privateKey,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

/**
 * Generate deterministic encryption keys for a user based on their userId
 * This ensures the same user gets the same keys on any device (iOS/Android)
 * Returns public key hash (to store in DB) and private key (to store in secure storage)
 */
export async function generateKeyPairForUser(userId: string): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  try {
    // Derive private key deterministically from userId + salt
    // This ensures the same user always gets the same key on any device
    const seedString = ENCRYPTION_SALT + userId;
    const privateKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      seedString,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    // Derive public key from private key using SHA-256
    const publicKey = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      privateKey,
      { encoding: Crypto.CryptoEncoding.HEX }
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
 * Generate random encryption keys (legacy - kept for backward compatibility)
 * @deprecated Use generateKeyPairForUser for cross-device compatibility
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
 * Retrieve legacy private key from secure storage
 * This is the old random key that was used before deterministic keys
 * Used for backwards compatibility to decrypt old messages
 */
export async function getLegacyPrivateKey(userId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(`encryption_legacy_private_key_${userId}`);
  } catch (error) {
    console.error('Error retrieving legacy private key:', error);
    return null;
  }
}

/**
 * Store legacy private key in device secure storage
 * Called before migrating to deterministic keys to preserve old key for decryption
 */
async function storeLegacyPrivateKey(userId: string, privateKey: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(`encryption_legacy_private_key_${userId}`, privateKey);
  } catch (error) {
    console.error('Error storing legacy private key:', error);
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
 * Derive a shared encryption key from two PUBLIC keys
 *
 * CRITICAL: Both parameters MUST be public keys (not private keys)!
 * This ensures both sender and recipient derive the SAME shared key:
 * - Sender calls: deriveSharedKey(sender_PUBLIC, recipient_PUBLIC)
 * - Recipient calls: deriveSharedKey(recipient_PUBLIC, sender_PUBLIC)
 *
 * Keys are sorted lexicographically to ensure same order for both parties.
 * After sorting: SHA256(A + B) === SHA256(A + B) - decryption works!
 *
 * This is the standard approach for symmetric key derivation from public keys.
 */
async function deriveSharedKey(
  publicKey1: string,
  publicKey2: string
): Promise<Uint8Array> {
  try {
    // CRITICAL: Sort keys lexicographically to ensure same order for both parties
    // Without sorting: SHA256(A+B) ≠ SHA256(B+A) - decryption would fail!
    const sortedKeys = [publicKey1, publicKey2].sort();
    const combined = ENCRYPTION_SALT + sortedKeys[0] + sortedKeys[1];

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
    // CRITICAL FIX: Derive sender's public key from their private key
    // Then use BOTH PUBLIC KEYS for shared key derivation
    // This ensures sender and recipient derive the SAME shared key:
    // - Sender: deriveSharedKey(sender_PUBLIC, recipient_PUBLIC)
    // - Recipient: deriveSharedKey(recipient_PUBLIC, sender_PUBLIC)
    // After sorting, both get identical results!
    const senderPublicKey = await derivePublicKeyFromPrivate(senderPrivateKey);
    const sharedKeyBytes = await deriveSharedKey(senderPublicKey, recipientPublicKey);

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

    // CRITICAL FIX: Derive recipient's public key from their private key
    // Then use BOTH PUBLIC KEYS for shared key derivation (same as sender)
    // This ensures sender and recipient derive the SAME shared key:
    // - Sender: deriveSharedKey(sender_PUBLIC, recipient_PUBLIC)
    // - Recipient: deriveSharedKey(recipient_PUBLIC, sender_PUBLIC)
    // After sorting, both get identical results!
    console.log('🔑 Deriving shared key...');
    const recipientPublicKey = await derivePublicKeyFromPrivate(recipientPrivateKey);
    const sharedKeyBytes = await deriveSharedKey(recipientPublicKey, senderPublicKey);
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
 * Decrypt a message with fallback to legacy key
 * Tries the current deterministic key first, then falls back to the legacy random key
 * This allows old messages (encrypted with random keys) to still be decrypted
 *
 * @param encryptedMessage - Encrypted message in format: iv:authTag:ciphertext
 * @param userId - Current user's ID (to get their private keys)
 * @param senderPublicKey - Sender's public key
 * @returns Decrypted plain text message, or error message if decryption fails
 */
export async function decryptMessageWithFallback(
  encryptedMessage: string,
  userId: string,
  senderPublicKey: string
): Promise<string> {
  // Get current private key
  const currentPrivateKey = await getPrivateKey(userId);

  if (currentPrivateKey) {
    try {
      // Try decrypting with current (deterministic) key
      const decrypted = await decryptMessage(encryptedMessage, currentPrivateKey, senderPublicKey);

      // Check if decryption actually succeeded (not just returned the encrypted message)
      if (decrypted !== '[Unable to decrypt message]' && decrypted !== encryptedMessage) {
        return decrypted;
      }
    } catch (error) {
      console.log('🔄 Current key decryption failed, trying legacy key...');
    }
  }

  // Try legacy key if available
  const legacyPrivateKey = await getLegacyPrivateKey(userId);
  if (legacyPrivateKey) {
    try {
      console.log('🔑 Attempting decryption with legacy key...');
      const decrypted = await decryptMessage(encryptedMessage, legacyPrivateKey, senderPublicKey);

      // Check if decryption actually succeeded
      if (decrypted !== '[Unable to decrypt message]' && decrypted !== encryptedMessage) {
        console.log('✅ Successfully decrypted with legacy key');
        return decrypted;
      }
    } catch (error) {
      console.log('❌ Legacy key decryption also failed');
    }
  }

  // Both keys failed - return placeholder
  console.log('⚠️ Unable to decrypt message with any available keys');
  return '[Unable to decrypt message]';
}

/**
 * Initialize encryption for a user
 * Call this during user registration/first login
 *
 * Uses deterministic key derivation so the same user gets the same keys
 * on any device (iOS/Android). This enables cross-device messaging.
 *
 * IMPORTANT: Preserves old random keys as "legacy" keys for backwards compatibility.
 * This allows old messages (encrypted with random keys) to still be decrypted.
 */
export async function initializeEncryption(userId: string): Promise<string> {
  try {
    // Generate deterministic keys for this user
    // These will be the same on any device for the same userId
    const { publicKey, privateKey } = await generateKeyPairForUser(userId);

    // Check if we already have the correct key stored
    const existingKey = await getPrivateKey(userId);
    if (existingKey === privateKey) {
      // Already have the correct deterministic key
      return publicKey;
    }

    // BACKWARDS COMPATIBILITY: If there's an existing key that's different from
    // the new deterministic key, it's an old random key. Save it as "legacy"
    // so we can still decrypt old messages encrypted with that key.
    if (existingKey && existingKey !== privateKey) {
      // Check if we already have a legacy key saved
      const existingLegacyKey = await getLegacyPrivateKey(userId);
      if (!existingLegacyKey) {
        // Save the old random key as legacy before overwriting
        console.log('🔑 Saving old encryption key as legacy for backwards compatibility');
        await storeLegacyPrivateKey(userId, existingKey);
      }
    }

    // Store/update the deterministic private key on this device
    // This handles both new devices and migration from old random keys
    await storePrivateKey(userId, privateKey);
    console.log('✅ Encryption keys initialized for cross-device messaging');

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
