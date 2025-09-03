import express, { Router } from 'express';
import extractUserFromHeader from '../middlewares/userExtractor';
import apiKeyAuth from '../middlewares/apiKeyAuth';
import {
    placeOrder,
    getUserOrders,
    cancelOrder,
    getTradeHistory,
    getMarketPairs
} from '../controllers/tradingController';

const router: Router = express.Router();

// Public routes
router.get('/market-pairs', getMarketPairs);

// Authenticated routes
router.use(apiKeyAuth);
router.use(extractUserFromHeader);
router.post('/order', placeOrder);
router.get('/orders', getUserOrders);
router.post('/order/cancel', cancelOrder);
router.get('/trade-history', getTradeHistory);

export default router; 