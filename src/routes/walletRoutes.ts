import express, { Router } from 'express';
import extractUserFromHeader from '../middlewares/userExtractor';
import apiKeyAuth from '../middlewares/apiKeyAuth';
import {
    getUserBalances,
    transferToTrading,
    transferToWallet
} from '../controllers/walletController';

const router: Router = express.Router();

// All wallet routes require API key auth
router.use(apiKeyAuth);
router.use(extractUserFromHeader);

// Wallet-related endpoints
router.get('/balances', getUserBalances);
router.post('/transfer-to-trading', transferToTrading);
router.post('/transfer-to-wallet', transferToWallet);

export default router; 