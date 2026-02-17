import express from 'express';
import dotenv from 'dotenv';
import { initializeDatabase } from './database';
import { requestIdMiddleware } from './middleware';
import { registerHandler } from './routes/register';
import { loginHandler } from './routes/login';
import { validateHandler } from './routes/validate';
import { metricsHandler } from './metrics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(requestIdMiddleware);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

// Metrics endpoint
app.get('/metrics', metricsHandler);

// Auth endpoints
app.post('/api/v1/auth/register', registerHandler);
app.post('/api/v1/auth/login', loginHandler);
app.post('/api/v1/auth/validate', validateHandler);

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Auth Service listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
