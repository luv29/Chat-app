import { Router } from "express";
import {
    deleteMessage,
    getAllMessages,
    sendMessage,
} from "../controllers/message.controllers";
import { verifyJWT } from "../middlewares/auth.middlewares";
import { upload } from "../middlewares/multer.middlewares";
import { sendMessageValidator } from "../validators/message.validators";
import { mongoIdPathVariableValidator } from "../validators/mongodb.validators";
import { validate } from "../validators/validate";

const router = Router();

// Ensure all routes require JWT auth
router.use(verifyJWT);

router
    .route("/:chatId")
    .get(
        mongoIdPathVariableValidator("chatId"),
        validate,
        getAllMessages
    )
    .post(
        upload.fields([{ name: "attachments", maxCount: 5 }]),
        mongoIdPathVariableValidator("chatId"),
        sendMessageValidator(),
        validate,
        sendMessage
    );

router
    .route("/:chatId/:messageId")
    .delete(
        mongoIdPathVariableValidator("chatId"),
        mongoIdPathVariableValidator("messageId"),
        validate,
        deleteMessage
    );

export default router;