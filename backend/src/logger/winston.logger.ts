import winston, { format as winstonFormat, transports as winstonTransports, Logger } from "winston";

// Define your severity levels.
const levels: winston.config.AbstractConfigSetLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// This method sets the current severity based on
// the current NODE_ENV: show all the log levels
// if the server was run in development mode; otherwise,
// if it was run in production, show only warn and error messages.
const level = (): keyof typeof levels => {
  const env = process.env.NODE_ENV || "development";
  const isDevelopment = env === "development";
  return isDevelopment ? "debug" : "warn";
};

// Define different colors for each level.
// Colors make the log message more visible,
// adding the ability to focus or ignore messages.
const colors: winston.config.AbstractConfigSetColors = {
  error: "red",
  warn: "yellow",
  info: "blue",
  http: "magenta",
  debug: "white",
};

// Tell winston that you want to link the colors
// defined above to the severity levels.
winston.addColors(colors);

// Choose the aspect of your log customizing the log format.
const logFormat = winstonFormat.combine(
  // Add the message timestamp with the preferred format
  winstonFormat.timestamp({ format: "DD MMM, YYYY - HH:mm:ss:ms" }),
  // Tell Winston that the logs must be colored
  winstonFormat.colorize({ all: true }),
  // Define the format of the message showing the timestamp, the level, and the message
  winstonFormat.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
  )
);

// Define which transports the logger must use to print out messages.
// In this example, we are using three different transports
const loggerTransports: winston.transport[] = [
  // Allow the use of the console to print the messages
  new winstonTransports.Console(),
  new winstonTransports.File({ filename: "logs/error.log", level: "error" }),
  new winstonTransports.File({ filename: "logs/info.log", level: "info" }),
  new winstonTransports.File({ filename: "logs/http.log", level: "http" }),
];

// Create the logger instance that has to be exported
// and used to log messages.
const logger: Logger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports: loggerTransports,
});

export default logger;