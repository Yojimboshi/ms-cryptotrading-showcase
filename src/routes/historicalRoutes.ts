import express, { Router } from 'express';
import { getHistoricalData } from '../controllers/historicalCandleController';

const router: Router = express.Router();

// Get stored historical data
router.get('/candles', getHistoricalData);

export default router; 