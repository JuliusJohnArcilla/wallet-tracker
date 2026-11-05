import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptJson, decryptJson, isEncrypted } from '../../src/lib/crypto.js';

test('round trip with the right passphrase', async () => {
  const data = { wallets: [{ id: 'g', name: 'GCash', opening: 12500.5 }], note: 'ñ ₱ 日本 😀' };
  const env = await encryptJson(data, 'correct horse battery');
  assert.ok(isEncrypted(env));
  assert.doesNotMatch(JSON.stringify(env), /GCash|12500/, 'nothing readable in the envelope');
  assert.deepEqual(await decryptJson(env, 'correct horse battery'), data);
});

test('wrong passphrase is rejected', async () => {
  const env = await encryptJson({ a: 1 }, 'right one here');
  await assert.rejects(decryptJson(env, 'wrong one here'), e => e.code === 'WRONG_PASSPHRASE');
});

test('fresh IV every time; salt can be reused', async () => {
  const a = await encryptJson({ a: 1 }, 'passphrase!');
  const b = await encryptJson({ a: 1 }, 'passphrase!', a.salt);
  assert.equal(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.data, b.data);
});

test('large data (a background photo) survives', async () => {
  const big = { prefs: { bg: 'x'.repeat(400000) } };
  assert.deepEqual(await decryptJson(await encryptJson(big, 'passphrase!'), 'passphrase!'), big);
});

test('plain data is not mistaken for encrypted', () => {
  assert.equal(isEncrypted({ wallets: [] }), false);
  assert.equal(isEncrypted(null), false);
});
