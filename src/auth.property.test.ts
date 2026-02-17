import fc from 'fast-check';
import { DataSource } from 'typeorm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '@frameforge/shared-types/dist/entities/User.entity';
import { validatePasswordStrength } from './validation';

describe('Authentication Property Tests', () => {
  let dataSource: DataSource;
  const JWT_SECRET = 'test-secret-for-property-tests';
  const JWT_EXPIRATION = 3600; // 1 hour in seconds
  const BCRYPT_SALT_ROUNDS = 10;

  // Set timeout for all tests in this suite (property tests take longer)
  jest.setTimeout(60000); // 60 seconds

  beforeAll(async () => {
    // Initialize PostgreSQL database for testing
    // Requires a running PostgreSQL instance (e.g., via docker-compose up -d postgres)
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      username: process.env.TEST_DB_USER || 'frameforge',
      password: process.env.TEST_DB_PASSWORD || 'frameforge',
      database: process.env.TEST_DB_NAME || 'frameforge',
      entities: [User],
      synchronize: true, // Auto-create schema for tests
      dropSchema: true, // Clean slate for each test run
      logging: false,
      ssl: false,
      extra: {
        max: 10,
        connectionTimeoutMillis: 5000,
      },
    });

    try {
      await dataSource.initialize();
    } catch (error) {
      console.error('Failed to connect to test database. Make sure PostgreSQL is running.');
      console.error('You can start it with: docker-compose up -d postgres');
      throw error;
    }
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clean up all data before each test
    await dataSource.getRepository(User).createQueryBuilder().delete().execute();
  });

  /**
   * Feature: frameforge-video-processing-system
   * Property 1: Valid credentials produce valid JWT tokens
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Valid credentials produce valid JWT tokens', () => {
    it('should generate valid JWT tokens for any valid user credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }).filter(pwd => 
              /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
          }),
          async ({ username, email, password }) => {
            const userRepo = dataSource.getRepository(User);

            // Make username and email unique
            const uniqueSuffix = `_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const uniqueUsername = (username + uniqueSuffix).substring(0, 50);
            const uniqueEmail = email.replace('@', uniqueSuffix + '@');

            // Create user with hashed password
            const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
            const user = userRepo.create({
              username: uniqueUsername,
              email: uniqueEmail,
              passwordHash,
            });
            await userRepo.save(user);

            // Verify password matches
            const passwordMatch = await bcrypt.compare(password, user.passwordHash);
            expect(passwordMatch).toBe(true);

            // Generate JWT token
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

            // Verify token is valid
            const decoded = jwt.verify(token, JWT_SECRET) as any;
            expect(decoded.userId).toBe(user.userId);
            expect(decoded.username).toBe(user.username); // Should match the saved username
            expect(decoded.email).toBe(user.email); // Should match the saved email
            expect(decoded.exp).toBeDefined();
            expect(decoded.iat).toBeDefined();
            expect(decoded.exp - decoded.iat).toBe(JWT_EXPIRATION);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: frameforge-video-processing-system
   * Property 2: Invalid credentials are always rejected
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Invalid credentials are always rejected', () => {
    it('should reject authentication for non-existent usernames', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/),
          fc.string({ minLength: 8, maxLength: 50 }),
          async (username, _password) => {
            const userRepo = dataSource.getRepository(User);

            // Attempt to find non-existent user
            const user = await userRepo.findOne({ where: { username } });
            
            // User should not exist
            expect(user).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject authentication for incorrect passwords', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/),
            email: fc.emailAddress(),
            correctPassword: fc.string({ minLength: 8, maxLength: 50 }).filter(pwd => 
              /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
            wrongPassword: fc.string({ minLength: 8, maxLength: 50 }).filter(pwd => 
              /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
          }).filter(({ correctPassword, wrongPassword }) => correctPassword !== wrongPassword),
          async ({ username, email, correctPassword, wrongPassword }) => {
            const userRepo = dataSource.getRepository(User);

            // Make username and email unique
            const uniqueSuffix = `_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const uniqueUsername = (username + uniqueSuffix).substring(0, 50);
            const uniqueEmail = email.replace('@', uniqueSuffix + '@');

            // Create user with correct password
            const passwordHash = await bcrypt.hash(correctPassword, BCRYPT_SALT_ROUNDS);
            const user = userRepo.create({
              username: uniqueUsername,
              email: uniqueEmail,
              passwordHash,
            });
            await userRepo.save(user);

            // Verify correct password works
            const correctMatch = await bcrypt.compare(correctPassword, user.passwordHash);
            expect(correctMatch).toBe(true);

            // Verify wrong password fails
            const wrongMatch = await bcrypt.compare(wrongPassword, user.passwordHash);
            expect(wrongMatch).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: frameforge-video-processing-system
   * Property 3: Expired tokens are rejected
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: Expired tokens are rejected', () => {
    it('should reject tokens with expiration in the past', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/),
            email: fc.emailAddress(),
            userId: fc.uuid(),
          }),
          async ({ username, email, userId }) => {
            // Generate token that expired 1 hour ago
            const expiredToken = jwt.sign(
              {
                userId,
                username,
                email,
              },
              JWT_SECRET,
              {
                expiresIn: -3600, // Negative value = already expired
              }
            );

            // Attempt to verify expired token
            expect(() => {
              jwt.verify(expiredToken, JWT_SECRET);
            }).toThrow(jwt.TokenExpiredError);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept tokens that have not yet expired', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/),
            email: fc.emailAddress(),
            userId: fc.uuid(),
            expiresIn: fc.integer({ min: 1, max: 7200 }), // 1 second to 2 hours
          }),
          async ({ username, email, userId, expiresIn }) => {
            // Generate token that expires in the future
            const validToken = jwt.sign(
              {
                userId,
                username,
                email,
              },
              JWT_SECRET,
              {
                expiresIn,
              }
            );

            // Verify token is valid
            const decoded = jwt.verify(validToken, JWT_SECRET) as any;
            expect(decoded.userId).toBe(userId);
            expect(decoded.username).toBe(username);
            expect(decoded.email).toBe(email);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: frameforge-video-processing-system
   * Property 4: Passwords are never stored in plaintext
   * **Validates: Requirements 1.5**
   */
  describe('Property 4: Passwords are never stored in plaintext', () => {
    it('should always hash passwords before storing in database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }).filter(pwd => 
              /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
          }),
          async ({ username, email, password }) => {
            const userRepo = dataSource.getRepository(User);

            // Make username and email unique
            const uniqueSuffix = `_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const uniqueUsername = (username + uniqueSuffix).substring(0, 50);
            const uniqueEmail = email.replace('@', uniqueSuffix + '@');

            // Hash password with bcrypt
            const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
            
            // Verify hash is different from plaintext
            expect(passwordHash).not.toBe(password);
            
            // Verify hash starts with bcrypt identifier
            expect(passwordHash).toMatch(/^\$2[aby]\$/);

            // Create user with hashed password
            const user = userRepo.create({
              username: uniqueUsername,
              email: uniqueEmail,
              passwordHash,
            });
            await userRepo.save(user);

            // Retrieve user from database
            const savedUser = await userRepo.findOne({ where: { username: uniqueUsername } });
            expect(savedUser).toBeDefined();
            
            // Verify stored password is hashed, not plaintext
            expect(savedUser!.passwordHash).not.toBe(password);
            expect(savedUser!.passwordHash).toBe(passwordHash);
            expect(savedUser!.passwordHash).toMatch(/^\$2[aby]\$/);
            
            // Verify bcrypt can verify the password
            const isValid = await bcrypt.compare(password, savedUser!.passwordHash);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: frameforge-video-processing-system
   * Property 5: Username uniqueness is enforced
   * **Validates: Requirements 1.6**
   */
  describe('Property 5: Username uniqueness is enforced', () => {
    it('should prevent duplicate usernames', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username: fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/),
            email1: fc.emailAddress(),
            email2: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }).filter(pwd => 
              /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
          }).filter(({ email1, email2 }) => email1 !== email2),
          async ({ username, email1, email2, password }) => {
            const userRepo = dataSource.getRepository(User);

            // Create first user
            const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
            const user1 = userRepo.create({
              username,
              email: email1,
              passwordHash,
            });
            await userRepo.save(user1);

            // Attempt to create second user with same username
            const user2 = userRepo.create({
              username, // Same username
              email: email2, // Different email
              passwordHash,
            });

            // Should throw unique constraint violation
            await expect(userRepo.save(user2)).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent duplicate emails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            username1: fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/),
            username2: fc.stringMatching(/^[a-zA-Z0-9_]{3,50}$/),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 8, maxLength: 50 }).filter(pwd => 
              /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)
            ),
          }).filter(({ username1, username2 }) => username1 !== username2),
          async ({ username1, username2, email, password }) => {
            const userRepo = dataSource.getRepository(User);

            // Create first user
            const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
            const user1 = userRepo.create({
              username: username1,
              email,
              passwordHash,
            });
            await userRepo.save(user1);

            // Attempt to create second user with same email
            const user2 = userRepo.create({
              username: username2, // Different username
              email, // Same email
              passwordHash,
            });

            // Should throw unique constraint violation
            await expect(userRepo.save(user2)).rejects.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: frameforge-video-processing-system
   * Property 6: Password requirements are enforced
   * **Validates: Requirements 1.6**
   */
  describe('Property 6: Password requirements are enforced', () => {
    it('should reject passwords shorter than 8 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 7 }),
          async (password) => {
            const result = validatePasswordStrength(password);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must be at least 8 characters long');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject passwords without uppercase letters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(pwd => !/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)),
          async (password) => {
            const result = validatePasswordStrength(password);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least 1 uppercase letter');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject passwords without numbers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(pwd => /[A-Z]/.test(pwd) && !/[0-9]/.test(pwd)),
          async (password) => {
            const result = validatePasswordStrength(password);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password must contain at least 1 number');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept passwords meeting all requirements', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 8, maxLength: 50 })
            .filter(pwd => /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)),
          async (password) => {
            const result = validatePasswordStrength(password);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
