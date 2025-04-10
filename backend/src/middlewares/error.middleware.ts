import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import logger from "../logger/winston.logger.ts";
import { ApiError } from "../utils/ApiError.js";
import { removeUnusedMulterImageFilesOnError } from "../utils/helpers.js";

/**
 * @description This middleware is responsible to catch the errors from any request handler wrapped inside the {@link asyncHandler}
 */
const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  // Check if the error is an instance of an ApiError class which extends native Error class
  if (!(error instanceof ApiError)) {
    // if not
    // create a new ApiError instance to keep the consistency

    // assign an appropriate status code
    const statusCode =
      (error as any).statusCode || error instanceof mongoose.Error ? 400 : 500;

    // set a message from native Error instance or a custom one
    const message = error.message || "Something went wrong";
    error = new ApiError(
      statusCode,
      message,
      (error as any)?.errors || [],
      err.stack
    );
  }

  // Now we are sure that the `error` variable will be an instance of ApiError class
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
