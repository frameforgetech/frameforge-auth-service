// Request and response types for Auth Service

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  userId: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
  user: {
    userId: string;
    username: string;
    email: string;
  };
}

export interface ValidateRequest {
  token: string;
}

export interface ValidateResponse {
  valid: boolean;
  userId?: string;
  username?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    requestId: string;
    timestamp: string;
  };
}
