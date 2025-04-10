import morgan, { StreamOptions } from "morgan";
import logger from "./winston.logger.js";

// Define a stream object with a `write` function that passes messages to Winston
const stream: StreamOptions = {
  // Use the http severity level for logging HTTP requests
  write: (message: string) => logger.http(message.trim()),
};

// Define a skip function to avoid logging in production (or non-development)
const skip = (): boolean => {
  const env = process.env.NODE_ENV || "development";
  return env !== "development"; // Skip logging if not in dev
};

// Create the morgan middleware with a custom format and stream
const morganMiddleware = morgan(
  ":remote-addr :method :url :status - :response-time ms",
  { stream, skip }
);

export default morganMiddleware;