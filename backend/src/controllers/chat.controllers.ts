import mongoose from "mongoose";
import { ChatEventEnum } from "../constants";
import { IUser, User } from "../models/user.models";
import { Chat } from "../models/chat.models";
import { ChatMessage, IAttachment } from "../models/message.models";
import { emitSocketEvent } from "../socket/index";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { removeLocalFile } from "../utils/helpers";
import { Response } from "express";

/**
 * @description Utility function which returns the pipeline stages to structure the chat schema with common lookups
 * @returns {mongoose.PipelineStage[]}
 */
const chatCommonAggregation = () => {
    return [
        {
            // lookup for the participants present
            $lookup: {
                from: "users",
                foreignField: "_id",
                localField: "participants",
                as: "participants",
                pipeline: [
                    {
                        $project: {
                            password: 0,
                            refreshToken: 0,
                            forgotPasswordToken: 0,
                            forgotPasswordExpiry: 0,
                            emailVerificationToken: 0,
                            emailVerificationExpiry: 0,
                        },
                    },
                ],
            },
        },
        {
            // lookup for the group chats
            $lookup: {
                from: "chatmessages",
                foreignField: "_id",
                localField: "lastMessage",
                as: "lastMessage",
                pipeline: [
                    {
                        // get details of the sender
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
                ],
            },
        },
        {
            $addFields: {
                lastMessage: { $first: "$lastMessage" },
            },
        },
    ];
};

/**
 * @description Utility function responsible for removing all the messages and file attachments attached to the deleted chat
 * @param chatId - The ID of the chat whose messages and attachments should be deleted
 */
const deleteCascadeChatMessages = async (chatId: string): Promise<void> => {
    // Fetch the messages associated with the chat to remove
    const messages = await ChatMessage.find({
        chat: new mongoose.Types.ObjectId(chatId),
    });

    let attachments: IAttachment[] = [];

    // Get the attachments present in the messages
    attachments = attachments.concat(
        ...messages.map((message) => message.attachments)
    );

    // Remove attachment files from local storage
    attachments.forEach((attachment) => {
        removeLocalFile(attachment.localPath);
    });

    // Delete all the messages associated with the chat
    await ChatMessage.deleteMany({
        chat: new mongoose.Types.ObjectId(chatId),
    });
};

const searchAvailableUsers = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const users = await User.aggregate([
            {
                $match: {
                    _id: { $ne: (req.user as IUser)?._id },
                },
            },
            {
                $project: {
                    avatar: 1,
                    username: 1,
                    email: 1,
                },
            },
        ]);

        res
            .status(200)
            .json(new ApiResponse(200, users, "Users fetched successfully"));
    }
);

const createOrGetAOneOnOneChat = asyncHandler(
    async (req, res: Response) => {
        const { receiverId } = req.params;

        const receiver = await User.findById(receiverId);
        if (!receiver) {
            throw new ApiError(404, "Receiver does not exist");
        }

        if (receiver._id.toString() === (req.user as IUser)?._id.toString()) {
            throw new ApiError(400, "You cannot chat with yourself");
        }

        const chat = await Chat.aggregate([
            {
                $match: {
                    isGroupChat: false,
                    $and: [
                        {
                            participants: { $elemMatch: { $eq: (req.user as IUser)?._id } },
                        },
                        {
                            participants: {
                                $elemMatch: {
                                    $eq: new mongoose.Types.ObjectId(receiverId),
                                },
                            },
                        },
                    ],
                },
            },
            ...chatCommonAggregation(),
        ]);

        if (chat.length) {
            return res
                .status(200)
                .json(new ApiResponse(200, chat[0], "Chat retrieved successfully"));
        }

        const newChatInstance = await Chat.create({
            name: "One on one chat",
            participants: [
                (req.user as IUser)?._id,
                new mongoose.Types.ObjectId(receiverId),
            ],
            admin: (req.user as IUser)?._id,
        });

        const createdChat = await Chat.aggregate([
            { $match: { _id: newChatInstance._id } },
            ...chatCommonAggregation(),
        ]);

        const payload = createdChat[0];
        if (!payload) {
            throw new ApiError(500, "Internal server error");
        }

        payload?.participants?.forEach((participant: any) => {
            if (participant._id.toString() === (req.user as IUser)?._id.toString()) return;

            emitSocketEvent(
                req,
                participant._id?.toString(),
                ChatEventEnum.NEW_CHAT_EVENT,
                payload
            );
        });

        res
            .status(201)
            .json(new ApiResponse(201, payload, "Chat retrieved successfully"));
    }
);

const createAGroupChat = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const { name, participants }: { name: string; participants: string[] } = req.body;

        if (participants.includes((req.user as IUser)?._id.toString())) {
            throw new ApiError(
                400,
                "Participants array should not contain the group creator"
            );
        }

        const members = [...new Set([...participants, (req.user as IUser)?._id.toString()])];

        if (members.length < 3) {
            throw new ApiError(
                400,
                "Seems like you have passed duplicate participants."
            );
        }

        const groupChat = await Chat.create({
            name,
            isGroupChat: true,
            participants: members,
            admin: (req.user as IUser)?._id,
        });

        const chat = await Chat.aggregate([
            { $match: { _id: groupChat._id } },
            ...chatCommonAggregation(),
        ]);

        const payload = chat[0];
        if (!payload) {
            throw new ApiError(500, "Internal server error");
        }

        payload?.participants?.forEach((participant: any) => {
            if (participant._id.toString() === (req.user as IUser)?._id.toString()) return;

            emitSocketEvent(
                req,
                participant._id?.toString(),
                ChatEventEnum.NEW_CHAT_EVENT,
                payload
            );
        });

        res
            .status(201)
            .json(new ApiResponse(201, payload, "Group chat created successfully"));
    }
);

const getGroupChatDetails = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const { chatId } = req.params;

        const groupChat = await Chat.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(chatId),
                    isGroupChat: true,
                },
            },
            ...chatCommonAggregation(),
        ]);

        const chat = groupChat[0];

        if (!chat) {
            throw new ApiError(404, "Group chat does not exist");
        }

        res
            .status(200)
            .json(new ApiResponse(200, chat, "Group chat fetched successfully"));
    }
);

const renameGroupChat = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const { chatId } = req.params;
        const { name }: { name: string } = req.body;

        const groupChat = await Chat.findOne({
            _id: new mongoose.Types.ObjectId(chatId),
            isGroupChat: true,
        });

        if (!groupChat) {
            throw new ApiError(404, "Group chat does not exist");
        }

        if (groupChat.admin?.toString() !== (req.user as IUser)?._id.toString()) {
            throw new ApiError(403, "You are not an admin");
        }

        const updatedGroupChat = await Chat.findByIdAndUpdate(
            chatId,
            { $set: { name } },
            { new: true }
        );

        const chat = await Chat.aggregate([
            {
                $match: {
                    _id: updatedGroupChat?._id,
                },
            },
            ...chatCommonAggregation(),
        ]);

        const payload = chat[0];

        if (!payload) {
            throw new ApiError(500, "Internal server error");
        }

        payload.participants?.forEach((participant: any) => {
            emitSocketEvent(
                req,
                participant._id?.toString(),
                ChatEventEnum.UPDATE_GROUP_NAME_EVENT,
                payload
            );
        });

        res
            .status(200)
            .json(new ApiResponse(200, payload, "Group chat name updated successfully"));
    }
);

const deleteGroupChat = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const { chatId } = req.params;

        const groupChat = await Chat.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(chatId),
                    isGroupChat: true,
                },
            },
            ...chatCommonAggregation(),
        ]);

        const chat = groupChat[0];

        if (!chat) {
            throw new ApiError(404, "Group chat does not exist");
        }

        if (chat.admin?.toString() !== (req.user as IUser)?._id.toString()) {
            throw new ApiError(403, "Only admin can delete the group");
        }

        await Chat.findByIdAndDelete(chatId);
        await deleteCascadeChatMessages(chatId);

        chat.participants?.forEach((participant: any) => {
            if (participant._id.toString() === (req.user as IUser)?._id.toString()) return;

            emitSocketEvent(
                req,
                participant._id?.toString(),
                ChatEventEnum.LEAVE_CHAT_EVENT,
                chat
            );
        });

        res
            .status(200)
            .json(new ApiResponse(200, {}, "Group chat deleted successfully"));
    }
);

const deleteOneOnOneChat = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const { chatId } = req.params;

        const chat = await Chat.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(chatId),
                },
            },
            ...chatCommonAggregation(),
        ]);

        const payload = chat[0];

        if (!payload) {
            throw new ApiError(404, "Chat does not exist");
        }

        await Chat.findByIdAndDelete(chatId);
        await deleteCascadeChatMessages(chatId);

        const otherParticipant = payload.participants?.find(
            (participant: any) =>
                participant._id.toString() !== (req.user as IUser)?._id.toString()
        );

        emitSocketEvent(
            req,
            otherParticipant._id.toString(),
            ChatEventEnum.LEAVE_CHAT_EVENT,
            payload
        );

        res.status(200).json(new ApiResponse(200, {}, "Chat deleted successfully"));
    }
);

const leaveGroupChat = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const { chatId } = req.params;

        const groupChat = await Chat.findOne({
            _id: new mongoose.Types.ObjectId(chatId),
            isGroupChat: true,
        });

        if (!groupChat) {
            throw new ApiError(404, "Group chat does not exist");
        }

        if (!groupChat.participants.includes((req.user as IUser)?._id)) {
            throw new ApiError(400, "You are not a part of this group chat");
        }

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            {
                $pull: { participants: (req.user as IUser)?._id },
            },
            { new: true }
        );

        const chat = await Chat.aggregate([
            { $match: { _id: updatedChat!._id } },
            ...chatCommonAggregation(),
        ]);

        const payload = chat[0];

        if (!payload) {
            throw new ApiError(500, "Internal server error");
        }

        res.status(200).json(new ApiResponse(200, payload, "Left a group successfully"));
    }
);

const addNewParticipantInGroupChat = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const { chatId, participantId } = req.params;

        const groupChat = await Chat.findOne({
            _id: new mongoose.Types.ObjectId(chatId),
            isGroupChat: true,
        });

        if (!groupChat) {
            throw new ApiError(404, "Group chat does not exist");
        }

        if (groupChat.admin?.toString() !== (req.user as IUser)?._id.toString()) {
            throw new ApiError(403, "You are not an admin");
        }

        const participantObjectId = new mongoose.Types.ObjectId(participantId);

        if (groupChat.participants.includes(participantObjectId)) {
            throw new ApiError(409, "Participant already in a group chat");
        }

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            {
                $push: { participants: participantObjectId },
            },
            { new: true }
        );


        const chat = await Chat.aggregate([
            { $match: { _id: updatedChat!._id } },
            ...chatCommonAggregation(),
        ]);

        const payload = chat[0];

        if (!payload) {
            throw new ApiError(500, "Internal server error");
        }

        emitSocketEvent(req, participantId, ChatEventEnum.NEW_CHAT_EVENT, payload);

        res.status(200).json(new ApiResponse(200, payload, "Participant added successfully"));
    }
);

const removeParticipantFromGroupChat = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const { chatId, participantId } = req.params;

        const groupChat = await Chat.findOne({
            _id: new mongoose.Types.ObjectId(chatId),
            isGroupChat: true,
        });

        if (!groupChat) {
            throw new ApiError(404, "Group chat does not exist");
        }

        if (groupChat.admin?.toString() !== (req.user as IUser)?._id.toString()) {
            throw new ApiError(403, "You are not an admin");
        }

        const participantObjectId = new mongoose.Types.ObjectId(participantId);

        if (!groupChat.participants.includes(participantObjectId)) {
            throw new ApiError(400, "Participant does not exist in the group chat");
        }

        const updatedChat = await Chat.findByIdAndUpdate(
            chatId,
            {
                $pull: { participants: participantObjectId },
            },
            { new: true }
        );

        const chat = await Chat.aggregate([
            { $match: { _id: updatedChat!._id } },
            ...chatCommonAggregation(),
        ]);

        const payload = chat[0];

        if (!payload) {
            throw new ApiError(500, "Internal server error");
        }

        emitSocketEvent(req, participantId, ChatEventEnum.LEAVE_CHAT_EVENT, payload);

        res.status(200).json(new ApiResponse(200, payload, "Participant removed successfully"));
    }
);

const getAllChats = asyncHandler(
    async (req, res: Response): Promise<void> => {
        const chats = await Chat.aggregate([
            {
                $match: {
                    participants: { $elemMatch: { $eq: (req.user as IUser)?._id } },
                },
            },
            {
                $sort: {
                    updatedAt: -1,
                },
            },
            ...chatCommonAggregation(),
        ]);

        res.status(200).json(
            new ApiResponse(200, chats || [], "User chats fetched successfully!")
        );
    }
);

export {
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
};