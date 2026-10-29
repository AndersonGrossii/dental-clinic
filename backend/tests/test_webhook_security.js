// ============================================
// Security regression tests for Meta webhook signatures
// ============================================
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import whatsappService from '../services/whatsapp.service.js';
import instagramService from '../services/instagram.service.js';
import { verifyMetaSignature } from '../middlewares/webhook.middleware.js';

const TEST_SECRET = 'test-meta-app-secret-do-not-use-in-production';
const rawBody = Buffer.from('{"entry":[{"id":"test"}]}', 'utf8');

const sign = (secret, body) => `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

function invokeMiddleware(path, signature, body = rawBody) {
  let nextCalled = false;
  let statusCode = null;
  let responseBody = null;
  const req = {
    path,
    rawBody: body,
    headers: signature ? { 'x-hub-signature-256': signature } : {},
    get(name) {
      return this.headers[name.toLowerCase()];
    },
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      responseBody = payload;
      return this;
    },
  };

  verifyMetaSignature(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, responseBody };
}

function run() {
  const originalWhatsAppSecret = whatsappService.appSecret;
  const originalInstagramSecret = instagramService.appSecret;

  try {
    whatsappService.appSecret = TEST_SECRET;
    instagramService.appSecret = TEST_SECRET;

    const validSignature = sign(TEST_SECRET, rawBody);
    assert.equal(whatsappService.validateSignature(validSignature, rawBody), true);
    assert.equal(instagramService.validateSignature(validSignature, rawBody), true);
    assert.equal(whatsappService.validateSignature(sign(TEST_SECRET, Buffer.from('different')), rawBody), false);
    assert.equal(instagramService.validateSignature('sha256=not-a-hex-signature', rawBody), false);
    assert.equal(whatsappService.validateSignature(undefined, rawBody), false);

    assert.equal(invokeMiddleware('/whatsapp', validSignature).nextCalled, true);
    assert.equal(invokeMiddleware('/instagram', validSignature).nextCalled, true);

    const missingSignature = invokeMiddleware('/whatsapp', undefined);
    assert.equal(missingSignature.nextCalled, false);
    assert.equal(missingSignature.statusCode, 401);

    const malformedSignature = invokeMiddleware('/instagram', 'sha256=invalid', rawBody);
    assert.equal(malformedSignature.nextCalled, false);
    assert.equal(malformedSignature.statusCode, 401);

    const missingRawBody = invokeMiddleware('/whatsapp', validSignature, null);
    assert.equal(missingRawBody.nextCalled, false);
    assert.equal(missingRawBody.statusCode, 400);

    whatsappService.appSecret = '';
    instagramService.appSecret = '';
    assert.equal(whatsappService.validateSignature(validSignature, rawBody), false);
    assert.equal(instagramService.validateSignature(validSignature, rawBody), false);
    const unconfigured = invokeMiddleware('/whatsapp', validSignature);
    assert.equal(unconfigured.nextCalled, false);
    assert.equal(unconfigured.statusCode, 503);
  } finally {
    whatsappService.appSecret = originalWhatsAppSecret;
    instagramService.appSecret = originalInstagramSecret;
  }

  console.log('✅ Meta webhook security tests passed');
}

run();
