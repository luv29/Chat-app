import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Application, Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import session from "express-session";
import fs from "fs";
import { createServer, Server as HTTPServer } from "http";
import passport from "passport";
import path from "path";
import requestIp from "request-ip";
import { Server as SocketIOServer } from "socket.io";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import YAML from "yaml";
import morganMiddleware from "./logger/morgan.logger.js";
import { initializeSocketIO } from "./socket/index.js";
import { ApiError } from "./utils/ApiError.js";

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);

const file: string = fs.readFileSync(path.resolve(__dirname, "./swagger.yaml"), "utf8");
const swaggerDocument = YAML.parse(
  file?.replace(
    "- url: ${{server}}",
    `- url: http://localhost:8080/api/v1`
  )
);

const app: Application = express();
const httpServer: HTTPServer = createServer(app);

const io: SocketIOServer = new SocketIOServer(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});

app.set("io", io); // using set method to mount the `io` instance on the app to avoid usage of `global`

// global middlewares
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN === "*"
        ? "*" // This might give CORS error for some origins due to credentials set to true
        : process.env.CORS_ORIGIN?.split(","), // For multiple cors origin for production. 
    credentials: true,
  })
);

app.use(requestIp.mw());

// Rate limiter to avoid misuse of the service and avoid cost spikes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    return req.clientIp || req.ip || "unknown-ip"; // IP address from requestIp.mw(), as opposed to req.ip
  },
  handler: (_req: Request, _res: Response, _next: NextFunction, options) => {
    throw new ApiError(
      options.statusCode || 500,
      `There are too many requests. You are only allowed ${options.max} requests per ${options.windowMs / 60000} minutes`
    );
  },
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); // configure static file to save images locally
app.use(cookieParser());

// required for passport
app.use(
  session({
    secret: process.env.EXPRESS_SESSION_SECRET || "default_secret", // fallback in case env is undefined
    resave: true,
    saveUninitialized: true,
  })
); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

app.use(morganMiddleware);

// * App routes
import userRouter from "./routes/apps/auth/user.routes.js";
import chatRouter from "./routes/apps/chat-app/chat.routes.js";
import messageRouter from "./routes/apps/chat-app/message.routes.js";

// * App apis
app.use("/api/v1/users", userRouter);
app.use("/api/v1/chat-app/chats", chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);

initializeSocketIO(io);

// * API DOCS
// ? Keeping swagger code at the end so that we can load swagger on "/" route
app.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      docExpansion: "none", // keep all the sections collapsed by default
    },
    customSiteTitle: "FreeAPI docs",
  })
);

// common error handling middleware
import { errorHandler } from "./middlewares/error.middlewares.js";
app.use(errorHandler);

export { httpServer };