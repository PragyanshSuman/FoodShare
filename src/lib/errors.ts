export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Please sign in") => new AppError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "You are not allowed to do that") => new AppError(403, "FORBIDDEN", msg);
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (msg: string) => new AppError(409, "CONFLICT", msg);
export const tooMany = (msg = "Too many requests, slow down") => new AppError(429, "RATE_LIMITED", msg);
