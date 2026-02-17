// User login endpoint

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '@frameforge/shared-contracts';
import { AppDataSource } from '../database';
import { LoginRequest, LoginResponse, ErrorResponse } from '../types';
import { loginAttemptsTotal } from '../metrics';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRATION = 3600; // 1 hour in seconds

export async function loginHandler(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body as LoginRequest;

    // Validate required fields
    if (!username || !password) {
      loginAttemptsTotal.inc({ status: 'failure' });
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields',
          details: {
            username: !username ? 'Username is required' : undefined,
            password: !password ? 'Password is required' : undefined,
          },
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Find user by username
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { username },
    });

    // If user not found or password doesn't match, return same error (security best practice)
    if (!user) {
      loginAttemptsTotal.inc({ status: 'failure' });
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Username or password is incorrect',
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      loginAttemptsTotal.inc({ status: 'failure' });
      const errorResponse: ErrorResponse = {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Username or password is incorrect',
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Generate JWT token with user claims
    const token = jwt.sign(
      {
        userId: user.userId,
        username: user.username,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRATION,
      }
    );

    // Track successful login
    loginAttemptsTotal.inc({ status: 'success' });

    // Return success response
    const response: LoginResponse = {
      token,
      expiresIn: JWT_EXPIRATION,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Login error:', error);
    
    loginAttemptsTotal.inc({ status: 'failure' });
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login',
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    };
    res.status(500).json(errorResponse);
  }
}
