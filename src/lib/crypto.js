// Optional encryption for the synced file: AES-GCM with a key derived from a passphrase (PBKDF2).
// Envelope: { enc: 'aes-gcm-v1', salt, iv, data } with base64 fields.

export const ENC = 'aes-gcm-v1';
const ITERATIONS = 250000;
export const isEncrypted = x => !!x && typeof x === 'object' && x.enc === ENC;

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// key derivation is slow on purpose; remember keys so syncing every 30 s stays quick
const keys = new Map();
async function keyFor(passphrase, saltB64) {
  const id = saltB64 + '\u0000' + passphrase;
  if (!keys.has(id)) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    keys.set(id, crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(saltB64), iterations: ITERATIONS, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
  }
  return keys.get(id);
}

// salt is kept between writes (pass the previous one) so the derived key can be reused
export async function encryptJson(value, passphrase, salt = toB64(crypto.getRandomValues(new Uint8Array(16)))) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(passphrase, salt),
    new TextEncoder().encode(JSON.stringify(value)));
  return { enc: ENC, salt, iv: toB64(iv), data: toB64(new Uint8Array(data)) };
}

// throws Error with code 'WRONG_PASSPHRASE' when the passphrase doesn't open it
export async function decryptJson(envelope, passphrase) {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) },
      await keyFor(passphrase, envelope.salt), fromB64(envelope.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw Object.assign(new Error('Wrong passphrase'), { code: 'WRONG_PASSPHRASE' });
  }
}
