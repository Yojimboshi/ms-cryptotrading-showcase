/**
 * Custom error class with HTTP status code support
 * @extends Error
 */
export class CustomError extends Error {
    status: number;

    /**
     * Create a custom error
     * @param {string} message - Error message
     * @param {number} status - HTTP status code
     */
    constructor(message: string, status: number = 500) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Trading-specific error types
export class InsufficientBalanceError extends CustomError {
    constructor(message?: string) {
        super(message || 'Insufficient balance for this operation', 400);
    }
}

export class InvalidOrderError extends CustomError {
    constructor(message?: string) {
        super(message || 'Invalid order parameters', 400);
    }
}

export class OrderNotFoundError extends CustomError {
    constructor(message?: string) {
        super(message || 'Order not found', 404);
    }
}

export class ExchangeError extends CustomError {
    constructor(message?: string, status: number = 502) {
        super(message || 'Error communicating with exchange', status);
    }
}

export default CustomError; 