// `code` is a stable, locale-independent identifier (e.g. 'INVALID_CREDENTIALS') that the
// frontend can map to a translated string; `message` is always English and used as the
// fallback whenever the frontend has no translation for the code (or the code is absent).
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly errors?: unknown,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', code?: string) {
    super(`${resource} not found`, 404, undefined, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code?: string) {
    super(message, 401, undefined, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action', code?: string) {
    super(message, 403, undefined, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 409, undefined, code);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, errors?: unknown, code?: string) {
    super(message, 422, errors, code);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code?: string) {
    super(message, 400, undefined, code);
  }
}
