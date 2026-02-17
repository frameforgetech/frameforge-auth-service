# FrameForge Auth Service

Authentication and JWT token management microservice for FrameForge.

## 🚀 Features

- User registration with password validation
- Login with JWT token generation
- Token validation endpoint
- Prometheus metrics
- PostgreSQL database integration

## 📋 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get JWT token
- `POST /api/v1/auth/validate` - Validate JWT token

### Monitoring
- `GET /metrics` - Prometheus metrics endpoint

## 🔧 Environment Variables

Create a `.env` file with:

```env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/frameforge
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRATION=24h
```

## 💻 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Start production server
npm start
```

## 🏗️ Build

```bash
npm run build
```

## 📦 Dependencies

- Express.js for HTTP server
- TypeORM for database ORM
- bcrypt for password hashing
- jsonwebtoken for JWT tokens
- prom-client for metrics

---

**Part of the FrameForge microservices ecosystem**
