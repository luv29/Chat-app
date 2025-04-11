import { body, ValidationChain } from "express-validator";

// Validator for creating a group chat
const createAGroupChatValidator = (): ValidationChain[] => {
    return [
        body("name")
            .trim()
            .notEmpty()
            .withMessage("Group name is required"),
        body("participants")
            .isArray({ min: 2, max: 100 })
            .withMessage(
                "Participants must be an array with more than 2 members and less than 100 members"
            ),
    ];
};

// Validator for updating group chat name
const updateGroupChatNameValidator = (): ValidationChain[] => {
    return [
        body("name")
            .trim()
            .notEmpty()
            .withMessage("Group name is required"),
    ];
};

export {
    createAGroupChatValidator,
    updateGroupChatNameValidator,
};
