export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') => new AppError(404, 'NOT_FOUND', `${what} não encontrado`);
export const premiumRequired = (message: string) => new AppError(402, 'PREMIUM_REQUIRED', message);
export const unauthorized = (message = 'Não autenticado') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Acesso negado') => new AppError(403, 'FORBIDDEN', message);
