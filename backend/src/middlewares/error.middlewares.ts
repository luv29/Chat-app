import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import logger from "../logger/winston.logger";
import { ApiError } from "../utils/ApiError";
import { removeUnusedMulterImageFilesOnError } from "../utils/helpers";

/**
 * @description This middleware is responsible to catch the errors from any request handler wrapped inside the {@link asyncHandler}
 */
const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error: ApiError = err instanceof ApiError
    ? err
    : new ApiError(
        (err as any).statusCode || (err instanceof mongoose.Error ? 400 : 500),
        err.message || "Something went wrong",
        (err as any)?.errors || [],
        err.stack
      );

  const response: Partial<ApiError> & { stack?: string } = {
    ...error,
    message: error.message,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}), // Error stack traces should be visible in development for debugging
  };

  logger.error(`${error.message}`);

  removeUnusedMulterImageFilesOnError(req);
  // Send error response
  return res
    .status(error.statusCode)
    .json(response);
};

export { errorHandler };
