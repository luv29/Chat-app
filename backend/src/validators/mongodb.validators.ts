import { body, param, ValidationChain } from 'express-validator';

/**
 * Validates MongoDB ObjectId passed as a URL path parameter.
 *
 * @param {string} idName - The name of the URL parameter containing the ObjectId.
 * @returns {ValidationChain[]} An array of validation chains.
 */
export const mongoIdPathVariableValidator = (idName: string): ValidationChain[] => {
    return [
        param(idName)
            .notEmpty()
            .withMessage(`${idName} parameter is required`)
            .isMongoId()
            .withMessage(`Invalid ${idName}`),
    ];
};

/**
 * Validates MongoDB ObjectId passed in the request body.
 *
 * @param {string} idName - The name of the body field containing the ObjectId.
 * @returns {ValidationChain[]} An array of validation chains.
 */
export const mongoIdRequestBodyValidator = (idName: string): ValidationChain[] => {
    return [
        body(idName)
            .notEmpty()
            .withMessage(`${idName} field is required`)
            .isMongoId()
            .withMessage(`Invalid ${idName}`),
    ];
};
