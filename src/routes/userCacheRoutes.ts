import express, { Router } from 'express';
import apiKeyAuth from '../middlewares/apiKeyAuth'; // Internal system access only

import {
    syncUserCache,
    getUserCacheById,
    deleteUserCache,
    listCachedUsers
} from '../controllers/userCacheController';

const router: Router = express.Router();

// Apply API key auth for all routes
router.use(apiKeyAuth);

// User cache routes (for system use only)
router.post('/', syncUserCache);                   // Sync or create user cache
router.get('/', listCachedUsers);                  // Optional: list all cached users
router.get('/:userId', getUserCacheById);          // Get cached user by ID
router.delete('/:userId', deleteUserCache);        // Optional: delete user cache

export default router; 