import { body, ValidationChain } from "express-validator";

// Validator for sending a message
const sendMessageValidator = (): ValidationChain[] => {
    return [
        body("content")
            .trim()
            .optional()
            .notEmpty()
            .withMessage("Content is required"),
    ];
};

export { sendMessageValidator };
