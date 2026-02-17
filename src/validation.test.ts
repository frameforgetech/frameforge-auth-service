// Unit tests for password validation

import { validatePasswordStrength } from './validation';

describe('Password Validation', () => {
  describe('validatePasswordStrength', () => {
    it('should accept valid password with 8+ chars, uppercase, and number', () => {
      const result = validatePasswordStrength('Password123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePasswordStrength('Pass1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePasswordStrength('password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least 1 uppercase letter');
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('PasswordABC');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least 1 number');
    });

    it('should return multiple errors for password with multiple issues', () => {
      const result = validatePasswordStrength('pass');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least 1 uppercase letter');
      expect(result.errors).toContain('Password must contain at least 1 number');
    });

    it('should accept password with special characters', () => {
      const result = validatePasswordStrength('Password123!@#');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with exactly 8 characters', () => {
      const result = validatePasswordStrength('Pass1234');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with multiple uppercase letters', () => {
      const result = validatePasswordStrength('PASSWORD123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept password with multiple numbers', () => {
      const result = validatePasswordStrength('Password123456');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
