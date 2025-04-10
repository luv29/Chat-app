import mongoose, { Mongoose } from "mongoose";
import { DB_NAME } from "../constants";
import logger from "../logger/winston.logger";

// Exported instance for external usage (optional)
export let dbInstance: Mongoose | undefined = undefined;

const connectDB = async (): Promise<void> => {
    try {
        const connectionInstance = await mongoose.connect(
            `${process.env.MONGODB_URI}/${DB_NAME}`
        );

        dbInstance = connectionInstance;

        logger.info(`\nMongoDB Connected! DB Host: ${connectionInstance.connection.host}\n`);
    } catch (error) {
        logger.error("MongoDB connection error: ", error);
        process.exit(1); // Exit on DB connection failure
    }
};

export default connectDB;
