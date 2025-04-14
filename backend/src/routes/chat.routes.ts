import { Router } from "express";
import {
    addNewParticipantInGroupChat,
    createAGroupChat,
    createOrGetAOneOnOneChat,
    deleteGroupChat,
    deleteOneOnOneChat,
    getAllChats,
    getGroupChatDetails,
    leaveGroupChat,
    removeParticipantFromGroupChat,
    renameGroupChat,
    searchAvailableUsers,
} from "../controllers/chat.controllers";
import { verifyJWT } from "../middlewares/auth.middlewares";
import {
    createAGroupChatValidator,
    updateGroupChatNameValidator,
} from "../validators//chat.validators";
import { mongoIdPathVariableValidator } from "../validators/mongodb.validators";
import { validate } from "../validators/validate";

const router = Router();

// Middleware to protect all chat routes
router.use(verifyJWT);

// Get all user chats
router.route("/").get(getAllChats);

// Search users to start a chat with
router.route("/users").get(searchAvailableUsers);

// Create or fetch one-on-one chat
router
    .route("/c/:receiverId")
    .post(
        mongoIdPathVariableValidator("receiverId"),
        validate,
        createOrGetAOneOnOneChat
    );

// Create a new group chat
router
    .route("/group")
    .post(createAGroupChatValidator(), validate, createAGroupChat);

// Get, rename, or delete a group chat
router
    .route("/group/:chatId")
    .get(mongoIdPathVariableValidator("chatId"), validate, getGroupChatDetails)
    .patch(
        mongoIdPathVariableValidator("chatId"),
        updateGroupChatNameValidator(),
        validate,
        renameGroupChat
    )
    .delete(mongoIdPathVariableValidator("chatId"), validate, deleteGroupChat);

// Add or remove participant from group chat
router
    .route("/group/:chatId/:participantId")
    .post(
        mongoIdPathVariableValidator("chatId"),
        mongoIdPathVariableValidator("participantId"),
        validate,
        addNewParticipantInGroupChat
    )
    .delete(
        mongoIdPathVariableValidator("chatId"),
        mongoIdPathVariableValidator("participantId"),
        validate,
        removeParticipantFromGroupChat
    );

// Leave a group chat
router
    .route("/leave/group/:chatId")
    .delete(mongoIdPathVariableValidator("chatId"), validate, leaveGroupChat);

// Delete a one-on-one chat
router
    .route("/remove/:chatId")
    .delete(mongoIdPathVariableValidator("chatId"), validate, deleteOneOnOneChat);

export default router;