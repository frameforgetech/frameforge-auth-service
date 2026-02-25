// Integration tests for metrics tracking in Auth Service

import request from 'supertest';
import app from './index';
import { AppDataSource } from './database';
import { User } from '@frameforgetech/shared-contracts';
import { register } from './metrics';

describe('Metrics Integration Tests', () => {
  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clean up database
    const userRepository = AppDataSource.getRepository(User);
    await userRepository.clear();
    
    // Reset metrics
    register.resetMetrics();
  });

  describe('Registration Metrics Tracking', () => {
    it('should increment success metric on successful registration', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'Password123',
        });

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('auth_registration_attempts_total{status="success"}');
    });

    it('should increment failure metric on validation error', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'weak',
        });

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('auth_registration_attempts_total{status="failure"}');
    });

    it('should increment failure metric on duplicate username', async () => {
      // Create first user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test1@example.com',
          password: 'Password123',
        });

      // Reset metrics to isolate the duplicate attempt
      register.resetMetrics();

      // Try to create duplicate
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test2@example.com',
          password: 'Password123',
        });

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('auth_registration_attempts_total{status="failure"}');
    });
  });

  describe('Login Metrics Tracking', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'loginuser',
          email: 'login@example.com',
          password: 'Password123',
        });
      
      // Reset metrics after registration
      register.resetMetrics();
    });

    it('should increment success metric on successful login', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'loginuser',
          password: 'Password123',
        });

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('auth_login_attempts_total{status="success"}');
    });

    it('should increment failure metric on wrong password', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'loginuser',
          password: 'WrongPassword123',
        });

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('auth_login_attempts_total{status="failure"}');
    });

    it('should increment failure metric on non-existent user', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'nonexistent',
          password: 'Password123',
        });

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('auth_login_attempts_total{status="failure"}');
    });
  });

  describe('Token Validation Metrics Tracking', () => {
    let validToken: string;

    beforeEach(async () => {
      // Create and login a user to get a valid token
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: 'tokenuser',
          email: 'token@example.com',
          password: 'Password123',
        });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'tokenuser',
          password: 'Password123',
        });

      validToken = loginResponse.body.token;
      
      // Reset metrics after setup
      register.resetMetrics();
    });

    it('should increment valid metric on successful token validation', async () => {
      await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: validToken });

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('auth_token_validation_total{result="valid"}');
    });

    it('should increment invalid metric on invalid token', async () => {
      await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: 'invalid.token.here' });

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('auth_token_validation_total{result="invalid"}');
    });

    it('should increment invalid metric on expired token', async () => {
      // This is a token that's already expired (exp claim in the past)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJ1c2VybmFtZSI6InRlc3QiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyMn0.4Adcj0MqsM0W9sNbB8FvnxhP0qkQ8rJ9K7V8nZ9xYzE';
      
      await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: expiredToken });

      const metricsResponse = await request(app).get('/metrics');
      expect(metricsResponse.text).toContain('auth_token_validation_total{result="invalid"}');
    });
  });
});
