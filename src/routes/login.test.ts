// Unit tests for login endpoint

import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Mock the database before importing app
jest.mock('../database', () => ({
  AppDataSource: {
    initialize: jest.fn().mockResolvedValue(undefined),
    getRepository: jest.fn(),
  },
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

import app from '../index';
import { AppDataSource } from '../database';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

describe('POST /api/v1/auth/login', () => {
  let mockUserRepository: any;
  let testUserPasswordHash: string;

  beforeEach(async () => {
    // Create password hash for test user
    testUserPasswordHash = await bcrypt.hash('TestPass123', 10);

    mockUserRepository = {
      findOne: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful login', () => {
    it('should return 200 and JWT token for valid credentials', async () => {
      const testUser = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: testUserPasswordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPass123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresIn', 3600);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        userId: testUser.userId,
        username: 'testuser',
        email: 'test@example.com',
      });

      // Verify token is valid JWT
      const decoded = jwt.verify(response.body.token, JWT_SECRET) as any;
      expect(decoded).toHaveProperty('userId', testUser.userId);
      expect(decoded).toHaveProperty('username', 'testuser');
      expect(decoded).toHaveProperty('email', 'test@example.com');
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
    });

    it('should generate token with 1 hour expiration', async () => {
      const testUser = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: testUserPasswordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPass123',
        })
        .expect(200);

      const decoded = jwt.verify(response.body.token, JWT_SECRET) as any;
      const expirationTime = decoded.exp - decoded.iat;
      expect(expirationTime).toBe(3600); // 1 hour in seconds
    });
  });

  describe('Invalid credentials', () => {
    it('should return 401 for non-existent username', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent',
          password: 'TestPass123',
        })
        .expect(401);

      expect(response.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Username or password is incorrect',
      });
      expect(response.body.error).toHaveProperty('requestId');
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should return 401 for incorrect password', async () => {
      const testUser = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: testUserPasswordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Username or password is incorrect',
      });
    });

    it('should return same error message for non-existent user and wrong password (security)', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(null);

      const response1 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent',
          password: 'TestPass123',
        });

      const testUser = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: testUserPasswordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValueOnce(testUser);

      const response2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: 'WrongPassword123',
        });

      expect(response1.body.error.message).toBe(response2.body.error.message);
      expect(response1.body.error.code).toBe(response2.body.error.code);
    });
  });

  describe('Validation errors', () => {
    it('should return 400 when username is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'TestPass123',
        })
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields',
      });
      expect(response.body.error.details).toHaveProperty('username', 'Username is required');
    });

    it('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
        })
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields',
      });
      expect(response.body.error.details).toHaveProperty('password', 'Password is required');
    });

    it('should return 400 when both fields are missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields',
      });
      expect(response.body.error.details).toHaveProperty('username');
      expect(response.body.error.details).toHaveProperty('password');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string username', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: '',
          password: 'TestPass123',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle empty string password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: '',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle SQL injection attempt in username', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: "admin' OR '1'='1",
          password: 'TestPass123',
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should handle special characters in username', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'test@#$%user',
          password: 'TestPass123',
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should handle extremely long password', async () => {
      const longPassword = 'a'.repeat(10000);
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'testuser',
          password: longPassword,
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('Response format', () => {
    it('should include requestId in error responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent',
          password: 'TestPass123',
        })
        .expect(401);

      expect(response.body.error).toHaveProperty('requestId');
      expect(typeof response.body.error.requestId).toBe('string');
      expect(response.body.error.requestId.length).toBeGreaterThan(0);
    });

    it('should include timestamp in error responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent',
          password: 'TestPass123',
        })
        .expect(401);

      expect(response.body.error).toHaveProperty('timestamp');
      expect(() => new Date(response.body.error.timestamp)).not.toThrow();
    });
  });
});
