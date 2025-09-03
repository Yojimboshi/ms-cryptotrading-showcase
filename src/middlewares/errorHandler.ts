import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '../constants';
import CustomError from '../utils/customError';

interface ErrorResponse {
    title: string;
    message: string;
    stackTrace?: string;
}

const errorHandler = (
    err: Error | CustomError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Log the error for debugging
    console.error('Error received in errorHandler:', err);

    // If the error is an instance of CustomError, respond with its status and message
    if (err instanceof CustomError) {
        res.status(err.status).json({
            title: getStatusTitle(err.status),
            message: err.message,
            stackTrace: process.env.NODE_ENV === 'development' ? err.stack : undefined // Only send stack trace in development
        } as ErrorResponse);
        return;
    }

    // Handle generic errors
    res.status(500).json({
        title: "SERVER_ERROR",
        message: err.message || 'An unexpected error occurred',
        stackTrace: process.env.NODE_ENV === 'development' ? err.stack : undefined // Only send stack trace in development
    } as ErrorResponse);
};

function getStatusTitle(status: number): string {
    switch (status) {
        case HTTP_STATUS.VALIDATION_ERROR:
            return "Validation failed";
        case HTTP_STATUS.NOT_FOUND:
            return "Not found";
        case HTTP_STATUS.UNAUTHORIZED:
            return "UNAUTHORIZED";
        case HTTP_STATUS.FORBIDDEN:
            return "FORBIDDEN";
        default:
            return "SERVER_ERROR";
    }
}

export default errorHandler; 