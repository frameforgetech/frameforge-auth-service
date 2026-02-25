import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'FrameForge Auth Service',
    version: '1.0.0',
    description: 'Authentication and Authorization Service for FrameForge Video Processing System',
    contact: {
      name: 'FrameForge Team',
      email: 'support@frameforge.tech',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:3001',
      description: 'Development server',
    },
    {
      url: 'https://auth.frameforge.tech',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token in the format: Bearer {token}',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
          },
          requestId: {
            type: 'string',
            description: 'Unique request identifier for tracking',
          },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ok'],
            description: 'Service health status',
          },
          service: {
            type: 'string',
            description: 'Service name',
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User unique identifier',
          },
          username: {
            type: 'string',
            description: 'Username',
            minLength: 3,
            maxLength: 50,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Account creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 50,
            pattern: '^[a-zA-Z0-9_-]+$',
            description: 'Username (alphanumeric, underscore, hyphen)',
            example: 'johndoe',
          },
          password: {
            type: 'string',
            minLength: 8,
            format: 'password',
            description: 'Password (min 8 chars, must include uppercase, lowercase, number, special char)',
            example: 'SecurePass123!',
          },
        },
      },
      RegisterResponse: {
        type: 'object',
        properties: {
          user: {
            $ref: '#/components/schemas/User',
          },
          message: {
            type: 'string',
            example: 'User created successfully',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
            type: 'string',
            description: 'Username',
            example: 'johndoe',
          },
          password: {
            type: 'string',
            format: 'password',
            description: 'Password',
            example: 'SecurePass123!',
          },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            description: 'JWT authentication token',
          },
          user: {
            $ref: '#/components/schemas/User',
          },
        },
      },
      ValidateResponse: {
        type: 'object',
        properties: {
          valid: {
            type: 'boolean',
            description: 'Whether the token is valid',
          },
          user: {
            $ref: '#/components/schemas/User',
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Access token is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Unauthorized',
              requestId: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Validation failed',
              requestId: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Internal server error',
              requestId: '123e4567-e89b-12d3-a456-426614174000',
            },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Health',
      description: 'Service health check endpoints',
    },
    {
      name: 'Authentication',
      description: 'User authentication and authorization endpoints',
    },
  ],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/index.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
