// Express middleware

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Add requestId to all requests for traceability
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

// Extend Express Request type to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
