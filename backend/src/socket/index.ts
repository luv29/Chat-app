import cookie from "cookie";
import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { AvailableChatEvents, ChatEventEnum } from "../constants";
import { User, IUser } from "../models/user.models";
import { ApiError } from "../utils/ApiError";
import { Request } from "express";
import { JwtPayload } from "jsonwebtoken";

// Extend the Socket type to include a custom user property
interface CustomSocket extends Socket {
    user?: IUser;
}

// Extend JWT payload to include user _id
interface CustomJwtPayload extends JwtPayload {
    _id: string;
}

const mountJoinChatEvent = (socket: CustomSocket): void => {
    socket.on(ChatEventEnum.JOIN_CHAT_EVENT, (chatId: string) => {
        console.log(`User joined the chat 🤝. chatId: `, chatId);
        socket.join(chatId);
    });
};

const mountParticipantTypingEvent = (socket: CustomSocket): void => {
    socket.on(ChatEventEnum.TYPING_EVENT, (chatId: string) => {
        socket.in(chatId).emit(ChatEventEnum.TYPING_EVENT, chatId);
    });
};

const mountParticipantStoppedTypingEvent = (socket: CustomSocket): void => {
    socket.on(ChatEventEnum.STOP_TYPING_EVENT, (chatId: string) => {
        socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
    });
};

const initializeSocketIO = (io: Server): void => {
    io.on("connection", async (socket: CustomSocket) => {
        try {
            const cookies = cookie.parse(socket.handshake.headers?.cookie || "");
            let token = cookies?.accessToken || socket.handshake.auth?.token;

            if (!token) {
                throw new ApiError(401, "Un-authorized handshake. Token is missing");
            }

            const decodedToken = jwt.verify(
                token,
                process.env.ACCESS_TOKEN_SECRET!
            ) as CustomJwtPayload;

            const user = await User.findById(decodedToken?._id).select(
                "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
            );

            if (!user) {
                throw new ApiError(401, "Un-authorized handshake. Token is invalid");
            }

            socket.user = user;
            socket.join(user._id.toString());
            socket.emit(ChatEventEnum.CONNECTED_EVENT);
            console.log("User connected 🗼. userId: ", user._id.toString());

            mountJoinChatEvent(socket);
            mountParticipantTypingEvent(socket);
            mountParticipantStoppedTypingEvent(socket);

            socket.on(ChatEventEnum.DISCONNECT_EVENT, () => {
                console.log("user has disconnected 🚫. userId: " + socket.user?._id);
                if (socket.user?._id) {
                    socket.leave(socket.user._id.toString());
                }
            });
        } catch (error: any) {
            socket.emit(
                ChatEventEnum.SOCKET_ERROR_EVENT,
                error?.message || "Something went wrong while connecting to the socket."
            );
        }
    });
};

const emitSocketEvent = (
    req: Request,
    roomId: string,
    event: (typeof AvailableChatEvents)[number],
    payload: any
): void => {
    req.app.get("io").in(roomId).emit(event, payload);
};

export { initializeSocketIO, emitSocketEvent };
