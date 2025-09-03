import { Request, Response, NextFunction } from 'express';

interface User {
    id: number;
    [key: string]: any;  // Allow for additional user properties
}

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

const extractUserFromHeader = (req: Request, res: Response, next: NextFunction): void => {
    try {
        const userHeader = req.headers.user;
        if (!userHeader) {
            res.status(401).json({ message: "Missing user context" });
            return;
        }

        // Parse user header - could be string or string[]
        const userStr = Array.isArray(userHeader) ? userHeader[0] : userHeader;
        req.user = JSON.parse(userStr) as User;
        next();
    } catch (err) {
        console.error("User header extraction failed:", err);
        res.status(400).json({ 
            message: "Invalid user data", 
            error: err instanceof Error ? err.message : 'Unknown error' 
        });
    }
};

export default extractUserFromHeader; 