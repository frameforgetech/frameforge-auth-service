// Unit tests for token validation endpoint

import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock the database before importing app
jest.mock('../database', () => ({
  AppDataSource: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getRepository: jest.fn(),
  },
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

import app from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

describe('POST /api/v1/auth/validate', () => {
  describe('Valid token validation', () => {
    it('should return valid=true for a valid token with user information', async () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: 3600 });

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token })
        .expect(200);

      expect(response.body).toMatchObject({
        valid: true,
        userId: payload.userId,
        username: payload.username,
      });
    });

    it('should validate token with correct JWT signature', async () => {
      const payload = {
        userId: '456e7890-e89b-12d3-a456-426614174001',
        username: 'anotheruser',
        email: 'another@example.com',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: 3600 });

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.userId).toBe(payload.userId);
      expect(response.body.username).toBe(payload.username);
    });

    it('should validate token that is about to expire but still valid', async () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
      };

      // Token expires in 1 second
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: 1 });

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token })
        .expect(200);

      expect(response.body.valid).toBe(true);
    });
  });

  describe('Invalid token validation', () => {
    it('should return valid=false for expired token', async () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
      };

      // Create token that expired 1 hour ago
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: -3600 });

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token })
        .expect(200);

      expect(response.body).toMatchObject({
        valid: false,
      });
      expect(response.body).not.toHaveProperty('userId');
      expect(response.body).not.toHaveProperty('username');
    });

    it('should return valid=false for token with invalid signature', async () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
      };

      // Sign with wrong secret
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: 3600 });

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token })
        .expect(200);

      expect(response.body).toMatchObject({
        valid: false,
      });
    });

    it('should return valid=false for malformed token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: 'not.a.valid.jwt.token' })
        .expect(200);

      expect(response.body).toMatchObject({
        valid: false,
      });
    });

    it('should return valid=false for completely invalid token string', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: 'invalid-token-string' })
        .expect(200);

      expect(response.body).toMatchObject({
        valid: false,
      });
    });

    it('should return valid=false for empty token string', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: '' })
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Missing required field',
      });
    });

    it('should return valid=false for token with tampered payload', async () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: 3600 });
      
      // Tamper with the token by modifying the payload part
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({
        ...payload,
        username: 'hacker',
      })).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: tamperedToken })
        .expect(200);

      expect(response.body).toMatchObject({
        valid: false,
      });
    });
  });

  describe('Validation errors', () => {
    it('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({})
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Missing required field',
      });
      expect(response.body.error.details).toHaveProperty('token', 'Token is required');
    });

    it('should return 400 when token is null', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: null })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when token is undefined', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: undefined })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Edge cases', () => {
    it('should handle token with special characters', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: 'token@#$%^&*()' })
        .expect(200);

      expect(response.body.valid).toBe(false);
    });

    it('should handle extremely long token string', async () => {
      const longToken = 'a'.repeat(10000);
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: longToken })
        .expect(200);

      expect(response.body.valid).toBe(false);
    });

    it('should handle token with only header and payload (no signature)', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ userId: '123', username: 'test' })).toString('base64url');
      const incompleteToken = `${header}.${payload}`;

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: incompleteToken })
        .expect(200);

      expect(response.body.valid).toBe(false);
    });

    it('should handle token with different algorithm (none)', async () => {
      // Try to create a token with 'none' algorithm (security vulnerability test)
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
      })).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: noneToken })
        .expect(200);

      expect(response.body.valid).toBe(false);
    });

    it('should validate token with minimum valid expiration time', async () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: 1 });

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token })
        .expect(200);

      expect(response.body.valid).toBe(true);
    });

    it('should handle token with extra claims', async () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        extraClaim: 'extra-value',
        anotherClaim: 12345,
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: 3600 });

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.userId).toBe(payload.userId);
      expect(response.body.username).toBe(payload.username);
    });
  });

  describe('Response format', () => {
    it('should include requestId in error responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({})
        .expect(400);

      expect(response.body.error).toHaveProperty('requestId');
      expect(typeof response.body.error.requestId).toBe('string');
      expect(response.body.error.requestId.length).toBeGreaterThan(0);
    });

    it('should include timestamp in error responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({})
        .expect(400);

      expect(response.body.error).toHaveProperty('timestamp');
      expect(() => new Date(response.body.error.timestamp)).not.toThrow();
    });

    it('should return consistent response structure for valid tokens', async () => {
      const payload = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: 3600 });

      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token })
        .expect(200);

      expect(Object.keys(response.body).sort()).toEqual(['userId', 'username', 'valid'].sort());
    });

    it('should return consistent response structure for invalid tokens', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: 'invalid-token' })
        .expect(200);

      expect(Object.keys(response.body)).toEqual(['valid']);
      expect(response.body.valid).toBe(false);
    });
  });

  describe('Security considerations', () => {
    it('should not leak information about why token is invalid', async () => {
      const expiredToken = jwt.sign(
        { userId: '123', username: 'test', email: 'test@example.com' },
        JWT_SECRET,
        { expiresIn: -3600 }
      );

      const invalidSignatureToken = jwt.sign(
        { userId: '123', username: 'test', email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: 3600 }
      );

      const response1 = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: expiredToken })
        .expect(200);

      const response2 = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: invalidSignatureToken })
        .expect(200);

      // Both should return the same response structure
      expect(response1.body).toEqual({ valid: false });
      expect(response2.body).toEqual({ valid: false });
    });

    it('should handle SQL injection attempt in token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: "'; DROP TABLE users; --" })
        .expect(200);

      expect(response.body.valid).toBe(false);
    });

    it('should handle XSS attempt in token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: '<script>alert("xss")</script>' })
        .expect(200);

      expect(response.body.valid).toBe(false);
    });
  });
});
