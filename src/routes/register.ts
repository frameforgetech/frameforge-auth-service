// User registration endpoint

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User } from '@frameforge/shared-contracts';
import { AppDataSource } from '../database';
import { RegisterRequest, RegisterResponse, ErrorResponse } from '../types';
import { validatePasswordStrength } from '../validation';
import { registrationAttemptsTotal } from '../metrics';

const BCRYPT_SALT_ROUNDS = 10;

export async function registerHandler(req: Request, res: Response): Promise<void> {
  try {
    const { username, email, password } = req.body as RegisterRequest;

    // Validate required fields
    if (!username || !email || !password) {
      registrationAttemptsTotal.inc({ status: 'failure' });
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
          details: {
            username: !username ? 'Username is required' : undefined,
            email: !email ? 'Email is required' : undefined,
            password: !password ? 'Password is required' : undefined,
          },
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      registrationAttemptsTotal.inc({ status: 'failure' });
      const errorResponse: ErrorResponse = {
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password does not meet security requirements',
          details: {
            password: passwordValidation.errors,
          },
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Check username uniqueness
    const userRepository = AppDataSource.getRepository(User);
    const existingUser = await userRepository.findOne({
      where: [{ username }, { email }],
    });

    if (existingUser) {
      registrationAttemptsTotal.inc({ status: 'failure' });
      const errorResponse: ErrorResponse = {
        error: {
          code: 'USER_ALREADY_EXISTS',
          message: 'Username or email already exists',
          details: {
            username: existingUser.username === username ? 'Username is already taken' : undefined,
            email: existingUser.email === email ? 'Email is already registered' : undefined,
          },
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(409).json(errorResponse);
      return;
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Create new user
    const newUser = userRepository.create({
      username,
      email,
      passwordHash,
    });

    // Save to database
    const savedUser = await userRepository.save(newUser);

    // Track successful registration
    registrationAttemptsTotal.inc({ status: 'success' });

    // Return success response
    const response: RegisterResponse = {
      userId: savedUser.userId,
      username: savedUser.username,
      email: savedUser.email,
      createdAt: savedUser.createdAt.toISOString(),
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    
    registrationAttemptsTotal.inc({ status: 'failure' });
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during registration',
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    };
    res.status(500).json(errorResponse);
  }
}
