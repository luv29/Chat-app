import { body, ValidationChain } from "express-validator";
import { AvailableUserRoles } from "../constants";

// Validator for user registration
const userRegisterValidator = (): ValidationChain[] => {
    return [
        body("email")
            .trim()
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
        body("username")
            .trim()
            .notEmpty()
            .withMessage("Username is required")
            .isLowercase()
            .withMessage("Username must be lowercase")
            .isLength({ min: 3 })
            .withMessage("Username must be at least 3 characters long"),
        body("password")
            .trim()
            .notEmpty()
            .withMessage("Password is required"),
        body("role")
            .optional()
            .isIn(AvailableUserRoles)
            .withMessage("Invalid user role"),
    ];
};

// Validator for user login
const userLoginValidator = (): ValidationChain[] => {
    return [
        body("email").optional().isEmail().withMessage("Email is invalid"),
        body("username").optional(),
        body("password").notEmpty().withMessage("Password is required"),
    ];
};

// Validator for changing current password
const userChangeCurrentPasswordValidator = (): ValidationChain[] => {
    return [
        body("oldPassword").notEmpty().withMessage("Old password is required"),
        body("newPassword").notEmpty().withMessage("New password is required"),
    ];
};

// Validator for forgot password
const userForgotPasswordValidator = (): ValidationChain[] => {
    return [
        body("email")
            .notEmpty()
            .withMessage("Email is required")
            .isEmail()
            .withMessage("Email is invalid"),
    ];
};

// Validator for resetting forgotten password
const userResetForgottenPasswordValidator = (): ValidationChain[] => {
    return [
        body("newPassword").notEmpty().withMessage("Password is required"),
    ];
};

// Validator for assigning role to user
const userAssignRoleValidator = (): ValidationChain[] => {
    return [
        body("role")
            .optional()
            .isIn(AvailableUserRoles)
            .withMessage("Invalid user role"),
    ];
};

export {
    userChangeCurrentPasswordValidator,
    userForgotPasswordValidator,
    userLoginValidator,
    userRegisterValidator,
    userResetForgottenPasswordValidator,
    userAssignRoleValidator,
};
