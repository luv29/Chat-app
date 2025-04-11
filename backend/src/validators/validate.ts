import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

export const validate = (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }

    const extractedErrors: { [key: string]: string }[] = [];

    errors.array().forEach((error: ValidationError) => {
    if (error.type === 'field') {
        extractedErrors.push({ [error.path]: error.msg });
    } else {
        // Handle other error types if necessary
        extractedErrors.push({ general: error.msg });
    }
    });

    throw new ApiError(422, 'Received data is not valid', extractedErrors);
};
