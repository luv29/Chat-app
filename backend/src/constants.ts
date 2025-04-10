export const UserRolesEnum = {
    ADMIN: "ADMIN",
    USER: "USER",
} as const;

export type UserRole = keyof typeof UserRolesEnum;
export const AvailableUserRoles: UserRole[] = Object.keys(UserRolesEnum) as UserRole[];

// User Login Types
export const UserLoginType = {
    GOOGLE: "GOOGLE",
    GITHUB: "GITHUB",
    EMAIL_PASSWORD: "EMAIL_PASSWORD",
} as const;

export type LoginType = keyof typeof UserLoginType;
export const AvailableSocialLogins: LoginType[] = Object.keys(UserLoginType) as LoginType[];

// Constants
export const USER_TEMPORARY_TOKEN_EXPIRY = 20 * 60 * 1000; // 20 minutes
export const MAXIMUM_SUB_IMAGE_COUNT = 4;
export const MAXIMUM_SOCIAL_POST_IMAGE_COUNT = 6;
export const DB_NAME = "chat-app";

// Chat Events
export const ChatEventEnum = Object.freeze({
    CONNECTED_EVENT: "connected",
    DISCONNECT_EVENT: "disconnect",
    JOIN_CHAT_EVENT: "joinChat",
    LEAVE_CHAT_EVENT: "leaveChat",
    UPDATE_GROUP_NAME_EVENT: "updateGroupName",
    MESSAGE_RECEIVED_EVENT: "messageReceived",
    NEW_CHAT_EVENT: "newChat",
    SOCKET_ERROR_EVENT: "socketError",
    STOP_TYPING_EVENT: "stopTyping",
    TYPING_EVENT: "typing",
    MESSAGE_DELETE_EVENT: "messageDeleted",
} as const);

export type ChatEvent = typeof ChatEventEnum[keyof typeof ChatEventEnum];
export const AvailableChatEvents: ChatEvent[] = Object.values(ChatEventEnum);