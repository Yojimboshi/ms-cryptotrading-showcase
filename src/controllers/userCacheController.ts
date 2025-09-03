import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { sequelize } from '../config/database';
import { LocalUserCache } from '../models';
import CustomError from '../utils/customError';

interface UserCacheRequest {
    userId: number;
    username: string;
    email: string;
}

interface UserCacheResponse {
    success: boolean;
    message?: string;
    data?: any;
    count?: number;
}

const syncUserCache = asyncHandler(async (req: Request<{}, {}, UserCacheRequest>, res: Response<UserCacheResponse>) => {
    console.log(req.body);
    const { userId, username, email } = req.body;

    if (!userId || !username || !email) {
        throw new CustomError("Missing userId, username, or email", 400);
    }

    await LocalUserCache.upsert({
        userId,
        username,
        email,
        lastUpdated: new Date()
    });

    res.status(200).json({
        success: true,
        message: "User cache synced successfully"
    });
});

const getUserCacheById = asyncHandler(async (req: Request<{ userId: string }>, res: Response<UserCacheResponse>) => {
    const { userId } = req.params;

    const user = await LocalUserCache.findOne({ where: { userId: Number(userId) } });

    if (!user) {
        throw new CustomError("User not found in cache", 404);
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

const deleteUserCache = asyncHandler(async (req: Request<{ userId: string }>, res: Response<UserCacheResponse>) => {
    const { userId } = req.params;

    const deleted = await LocalUserCache.destroy({ where: { userId: Number(userId) } });

    if (!deleted) {
        throw new CustomError("User not found in cache", 404);
    }

    res.status(200).json({
        success: true,
        message: "User cache deleted"
    });
});

const listCachedUsers = asyncHandler(async (_req: Request, res: Response<UserCacheResponse>) => {
    const users = await LocalUserCache.findAll({ limit: 100 });

    res.status(200).json({
        success: true,
        count: users.length,
        data: users
    });
});

export {
    syncUserCache,
    getUserCacheById,
    deleteUserCache,
    listCachedUsers
}; 