interface HttpStatus {
    VALIDATION_ERROR: number;
    UNAUTHORIZED: number;
    FORBIDDEN: number;
    NOT_FOUND: number;
}

interface Constants {
    HTTP_STATUS: HttpStatus;
}

export const constants: Constants = {
    HTTP_STATUS: {
        VALIDATION_ERROR: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        // You can add other status codes here if needed
    },
}; 