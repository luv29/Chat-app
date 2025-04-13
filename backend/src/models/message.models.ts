import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAttachment {
    url: string;
    localPath: string;
}

export interface IChatMessage extends Document {
    sender: Types.ObjectId;
    content?: string;
    attachments: IAttachment[];
    chat: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
    {
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: {
            type: String,
        },
        attachments: {
            type: [
                {
                    url: { type: String, required: true },
                    localPath: { type: String, required: true },
                },
            ],
            default: [],
        },
        chat: {
            type: Schema.Types.ObjectId,
            ref: "Chat",
            required: true,
        },
    },
    { timestamps: true }
);

export const ChatMessage: Model<IChatMessage> = mongoose.model<IChatMessage>(
    "ChatMessage",
    chatMessageSchema
);
