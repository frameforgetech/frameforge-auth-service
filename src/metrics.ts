// Prometheus metrics for Auth Service

import { Request, Response } from 'express';
import { Registry, Counter, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register the metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// Registration attempts counter
export const registrationAttemptsTotal = new Counter({
  name: 'auth_registration_attempts_total',
  help: 'Total number of registration attempts',
  labelNames: ['status'],
  registers: [register],
});

// Login attempts counter
export const loginAttemptsTotal = new Counter({
  name: 'auth_login_attempts_total',
  help: 'Total number of login attempts',
  labelNames: ['status'],
  registers: [register],
});

// Token validation requests counter
export const tokenValidationTotal = new Counter({
  name: 'auth_token_validation_total',
  help: 'Total number of token validation requests',
  labelNames: ['result'],
  registers: [register],
});

// Metrics endpoint handler
export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).end('Error generating metrics');
  }
}
