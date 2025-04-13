import mongoose, { PipelineStage } from "mongoose";
import { Request, Response } from "express";
import { ChatEventEnum } from "../constants";
import { Chat, IChat } from "../models/chat.models";
import { ChatMessage, IChatMessage, IAttachment } from "../models/message.models";
import { emitSocketEvent } from "../socket";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import {
    getLocalPath,
    getStaticFilePath,
    removeLocalFile,
} from "../utils/helpers";
import { IUser } from "../models/user.models";

interface AuthenticatedRequest extends Request {
    user?: IUser;
    files?: {
        attachments?: Express.Multer.File[];
    };
}

/**
 * @description Utility function which returns the pipeline stages to structure the chat message schema with common lookups
 * @returns {PipelineStage[]}
 */
const chatMessageCommonAggregation = (): PipelineStage[] => {
    return [
        {
            $lookup: {
                from: "users",
                foreignField: "_id",
                localField: "sender",
                as: "sender",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            email: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                sender: { $first: "$sender" },
            },
        },
    ];
};

const getAllMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const selectedChat: IChat | null = await Chat.findById(chatId);

    if (!selectedChat) {
        throw new ApiError(404, "Chat does not exist");
    }

    if (!selectedChat.participants?.includes((req.user as IUser)?._id)) {
        throw new ApiError(400, "User is not a part of this chat");
    }

    const messages = await ChatMessage.aggregate([
        {
            $match: {
                chat: new mongoose.Types.ObjectId(chatId),
            },
        },
        ...chatMessageCommonAggregation(),
        {
            $sort: {
                createdAt: -1,
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, messages || [], "Messages fetched successfully"));
});

const sendMessage = asyncHandler(async (req, res: Response) => {
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content && !(req as AuthenticatedRequest).files?.attachments?.length) {
        throw new ApiError(400, "Message content or attachment is required");
    }

    const selectedChat: IChat | null = await Chat.findById(chatId);
    if (!selectedChat) {
        throw new ApiError(404, "Chat does not exist");
    }

    const messageFiles: IAttachment[] = [];

    if ((req as AuthenticatedRequest).files?.attachments?.length) {
        (req as AuthenticatedRequest).files?.attachments?.map((attachment) => {
            messageFiles.push({
                url: getStaticFilePath(req, attachment.filename),
                localPath: getLocalPath(attachment.filename),
            });
        });
    }

    const message: IChatMessage = await ChatMessage.create({
        sender: new mongoose.Types.ObjectId((req.user as IUser)!._id),
        content: content || "",
        chat: new mongoose.Types.ObjectId(chatId),
        attachments: messageFiles,
    });

    const chat = await Chat.findByIdAndUpdate(
        chatId,
        {
            $set: {
                lastMessage: message._id,
            },
        },
        { new: true }
    );

    const messages = await ChatMessage.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(message._id as string),
            },
        },
        ...chatMessageCommonAggregation(),
    ]);

    const receivedMessage = messages[0];

    if (!receivedMessage) {
        throw new ApiError(500, "Internal server error");
    }

    chat?.participants.forEach((participantObjectId) => {
        if (participantObjectId.toString() === (req.user as IUser)!._id.toString()) return;

        emitSocketEvent(
            req,
            participantObjectId.toString(),
            ChatEventEnum.MESSAGE_RECEIVED_EVENT,
            receivedMessage
        );
    });

    return res
        .status(201)
        .json(new ApiResponse(201, receivedMessage, "Message saved successfully"));
});

const deleteMessage = asyncHandler(async (req, res: Response) => {
    const { chatId, messageId } = req.params;

    const chat = await Chat.findOne({
        _id: new mongoose.Types.ObjectId(chatId),
        participants: (req.user as IUser)?._id,
    });

    if (!chat) {
        throw new ApiError(404, "Chat does not exist");
    }

    const message = await ChatMessage.findOne({
        _id: new mongoose.Types.ObjectId(messageId),
    });

    if (!message) {
        throw new ApiError(404, "Message does not exist");
    }

    if (message.sender.toString() !== (req.user as IUser)!._id.toString()) {
        throw new ApiError(
            403,
            "You are not the authorised to delete the message, you are not the sender"
        );
    }

    if (message.attachments.length > 0) {
        message.attachments.map((asset) => {
            removeLocalFile(asset.localPath);
        });
    }

    await ChatMessage.deleteOne({
        _id: new mongoose.Types.ObjectId(messageId),
    });

    if (chat.lastMessage?.toString() === message._id as string) {
        const lastMessage = await ChatMessage.findOne(
            { chat: chatId },
            {},
            { sort: { createdAt: -1 } }
        );

        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: lastMessage ? lastMessage._id : null,
        });
    }

    chat.participants.forEach((participantObjectId) => {
        if (participantObjectId.toString() === (req.user as IUser)!._id.toString()) return;

        emitSocketEvent(
            req,
            participantObjectId.toString(),
            ChatEventEnum.MESSAGE_DELETE_EVENT,
            message
        );
    });

    return res
        .status(200)
        .json(new ApiResponse(200, message, "Message deleted successfully"));
});

export { getAllMessages, sendMessage, deleteMessage };