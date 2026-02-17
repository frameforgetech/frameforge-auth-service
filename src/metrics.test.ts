// Tests for Prometheus metrics

import request from 'supertest';
import app from './index';
import { register, registrationAttemptsTotal, loginAttemptsTotal, tokenValidationTotal } from './metrics';

describe('Prometheus Metrics', () => {
  beforeEach(() => {
    // Reset metrics before each test
    register.resetMetrics();
  });

  describe('GET /metrics', () => {
    it('should expose metrics endpoint', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should include default metrics', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('process_cpu_user_seconds_total');
      expect(response.text).toContain('nodejs_heap_size_total_bytes');
    });

    it('should include custom auth metrics', async () => {
      const response = await request(app).get('/metrics');
      
      expect(response.status).toBe(200);
      expect(response.text).toContain('auth_registration_attempts_total');
      expect(response.text).toContain('auth_login_attempts_total');
      expect(response.text).toContain('auth_token_validation_total');
    });
  });

  describe('Registration Metrics', () => {
    it('should track successful registration attempts', () => {
      registrationAttemptsTotal.inc({ status: 'success' });
      
      const metrics = register.getSingleMetric('auth_registration_attempts_total');
      expect(metrics).toBeDefined();
    });

    it('should track failed registration attempts', () => {
      registrationAttemptsTotal.inc({ status: 'failure' });
      
      const metrics = register.getSingleMetric('auth_registration_attempts_total');
      expect(metrics).toBeDefined();
    });
  });

  describe('Login Metrics', () => {
    it('should track successful login attempts', () => {
      loginAttemptsTotal.inc({ status: 'success' });
      
      const metrics = register.getSingleMetric('auth_login_attempts_total');
      expect(metrics).toBeDefined();
    });

    it('should track failed login attempts', () => {
      loginAttemptsTotal.inc({ status: 'failure' });
      
      const metrics = register.getSingleMetric('auth_login_attempts_total');
      expect(metrics).toBeDefined();
    });
  });

  describe('Token Validation Metrics', () => {
    it('should track valid token validations', () => {
      tokenValidationTotal.inc({ result: 'valid' });
      
      const metrics = register.getSingleMetric('auth_token_validation_total');
      expect(metrics).toBeDefined();
    });

    it('should track invalid token validations', () => {
      tokenValidationTotal.inc({ result: 'invalid' });
      
      const metrics = register.getSingleMetric('auth_token_validation_total');
      expect(metrics).toBeDefined();
    });
  });
});
