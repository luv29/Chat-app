import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps async route handlers to catch errors and pass them to Express error middleware.
 *
 * @param requestHandler - The async Express route handler function.
 * @returns A new function with error handling logic.
 */
const asyncHandler =
  (requestHandler: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch(next);
  };

export { asyncHandler };
