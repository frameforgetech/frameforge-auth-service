// Unit tests for user registration endpoint

import request from 'supertest';
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

describe('POST /api/v1/auth/register', () => {
  let mockUserRepository: any;

  beforeEach(() => {
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful registration', () => {
    it('should register a new user with valid credentials', async () => {
      const newUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: newUser.username,
        email: newUser.email,
        passwordHash: 'hashed_password',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty('userId');
      expect(response.body.username).toBe(newUser.username);
      expect(response.body.email).toBe(newUser.email);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should hash the password with bcrypt before storage', async () => {
      const newUser = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.save.mockImplementation(async (user: any) => {
        // Verify password is hashed
        const isHashed = await bcrypt.compare(newUser.password, user.passwordHash);
        expect(isHashed).toBe(true);
        
        return {
          ...user,
          userId: '123e4567-e89b-12d3-a456-426614174000',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      await request(app)
        .post('/api/v1/auth/register')
        .send(newUser)
        .expect(201);
    });
  });

  describe('Username uniqueness validation', () => {
    it('should reject registration with existing username', async () => {
      const existingUser = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'existinguser',
        email: 'existing@example.com',
        passwordHash: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'existinguser',
          email: 'newemail@example.com',
          password: 'Password123',
        })
        .expect(409);

      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
      expect(response.body.error.details.username).toBeDefined();
    });

    it('should reject registration with existing email', async () => {
      const existingUser = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        username: 'existinguser',
        email: 'existing@example.com',
        passwordHash: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'Password123',
        })
        .expect(409);

      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
      expect(response.body.error.details.email).toBeDefined();
    });
  });

  describe('Password strength validation', () => {
    it('should reject password shorter than 8 characters', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Pass1',
        })
        .expect(400);

      expect(response.body.error.code).toBe('WEAK_PASSWORD');
      expect(response.body.error.details.password).toContain(
        'Password must be at least 8 characters long'
      );
    });

    it('should reject password without uppercase letter', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error.code).toBe('WEAK_PASSWORD');
      expect(response.body.error.details.password).toContain(
        'Password must contain at least 1 uppercase letter'
      );
    });

    it('should reject password without number', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'PasswordABC',
        })
        .expect(400);

      expect(response.body.error.code).toBe('WEAK_PASSWORD');
      expect(response.body.error.details.password).toContain(
        'Password must contain at least 1 number'
      );
    });

    it('should reject password with multiple validation failures', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'pass',
        })
        .expect(400);

      expect(response.body.error.code).toBe('WEAK_PASSWORD');
      expect(response.body.error.details.password.length).toBeGreaterThan(1);
    });
  });

  describe('Input validation', () => {
    it('should reject request with missing username', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.username).toBeDefined();
    });

    it('should reject request with missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          password: 'Password123',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.email).toBeDefined();
    });

    it('should reject request with missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.password).toBeDefined();
    });
  });

  describe('Error responses', () => {
    it('should include requestId in error responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body.error.requestId).toBeDefined();
      expect(typeof response.body.error.requestId).toBe('string');
    });

    it('should include timestamp in error responses', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body.error.timestamp).toBeDefined();
      expect(new Date(response.body.error.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('should handle database errors gracefully', async () => {
      mockUserRepository.findOne.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123',
        })
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.requestId).toBeDefined();
    });
  });
});
