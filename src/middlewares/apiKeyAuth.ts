import { Request, Response, NextFunction } from 'express';

const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
    // Get the API key from request headers
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;

    if (!apiKey || apiKey !== validApiKey) {
        res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid API key'
        });
        return;
    }
    next();
};

export default apiKeyAuth; 