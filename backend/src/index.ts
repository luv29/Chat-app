import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});

import { httpServer } from "./app";
import connectDB from "./db";
import logger from "./logger/winston.logger";

const majorNodeVersion: number = parseInt(process.versions.node.split(".")[0], 10);

const startServer = () => {
  const port = process.env.PORT || 8080;
  httpServer.listen(port, () => {
    logger.info(`⚙️ Server is running on port: ${port}`);
  });
};

if (majorNodeVersion >= 14) {
  (async () => {
    try {
      await connectDB();
      startServer();
    } catch (err) {
      logger.error("Mongo db connect error: ", err);
    }
  })();
} else {
  connectDB()
    .then(() => {
      startServer();
    })
    .catch((err: unknown) => {
      logger.error("Mongo db connect error: ", err);
    });
}
