// Token validation endpoint (internal use)

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ValidateRequest, ValidateResponse, ErrorResponse } from '../types';
import { tokenValidationTotal } from '../metrics';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * @swagger
 * /api/v1/auth/validate:
 *   post:
 *     summary: Validate JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: JWT token to validate
 *     responses:
 *       200:
 *         description: Token validation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidateResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
export async function validateHandler(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body as ValidateRequest;

    // Validate required field
    if (!token) {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field',
          details: {
            token: 'Token is required',
          },
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(400).json(errorResponse);
      return;
    }

    // Verify JWT signature and expiration
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

      // Track successful validation
      tokenValidationTotal.inc({ result: 'valid' });

      // Return valid response with user information
      const response: ValidateResponse = {
        valid: true,
        userId: decoded.userId,
        username: decoded.username,
      };

      res.status(200).json(response);
    } catch (error) {
      // Token is invalid or expired
      tokenValidationTotal.inc({ result: 'invalid' });
      
      if (error instanceof jwt.TokenExpiredError) {
        const response: ValidateResponse = {
          valid: false,
        };
        res.status(200).json(response);
      } else if (error instanceof jwt.JsonWebTokenError) {
        const response: ValidateResponse = {
          valid: false,
        };
        res.status(200).json(response);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Token validation error:', error);
    
    const errorResponse: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during token validation',
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      },
    };
    res.status(500).json(errorResponse);
  }
}
