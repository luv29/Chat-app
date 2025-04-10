import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IChat extends Document {
    name: string;
    isGroupChat: boolean;
    lastMessage?: Types.ObjectId;
    participants: Types.ObjectId[];
    admin?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

const chatSchema = new Schema<IChat>(
    {
        name: {
            type: String,
            required: true,
        },
        isGroupChat: {
            type: Boolean,
            default: false,
        },
        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: "ChatMessage",
        },
        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
        ],
        admin: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

export const Chat: Model<IChat> = mongoose.model<IChat>("Chat", chatSchema);