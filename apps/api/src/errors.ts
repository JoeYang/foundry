export type ErrorCode = 'VALIDATION_FAILED' | 'NOT_FOUND' | 'CONFLICT' | 'CAPACITY' | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (msg: string) => new AppError('NOT_FOUND', 404, msg);
export const conflict = (msg: string) => new AppError('CONFLICT', 409, msg);
export const validation = (msg: string) => new AppError('VALIDATION_FAILED', 400, msg);
export const capacity = (msg: string) => new AppError('CAPACITY', 503, msg);
