import express, { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { PriceCandle, MarketPair } from '../models';
import { convertCandles, Candle } from '../utils/candleUtils';
import marketPairs from '../../shared/marketPairs.json';

const router: Router = express.Router();

interface MarketPairData {
    status: string;
    [key: string]: any;
}

interface MarketSummary {
    marketPair: MarketPairData;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: Date;
}

router.get('/list', (req: Request, res: Response) => {
    const activePairs = marketPairs.filter((p: MarketPairData) => p.status === 'ACTIVE');
    res.status(200).json(activePairs);
});

// Get historical price data
router.get('/history/:marketPairId', async (req: Request, res: Response) => {
    try {
        const { marketPairId } = req.params;
        const { interval = '1m', start, end } = req.query;

        // Validate the interval
        const validIntervals = ['1m', '5m', '15m', '1h', '4h', '1d'];
        if (!validIntervals.includes(interval as string)) {
            return res.status(400).json({
                error: 'Invalid interval',
                message: `Interval must be one of: ${validIntervals.join(', ')}`
            });
        }

        console.log(`Fetching price history for marketPairId: ${marketPairId}`);
        console.log(`Time range: ${new Date(parseInt(start as string))} to ${new Date(parseInt(end as string))}`);
        console.log(`Requested interval: ${interval}`);

        // Always fetch 1m data first
        const priceData = await PriceCandle.findAll({
            where: {
                marketPairId,
                interval: '1m', // Always fetch 1m data
                timestamp: {
                    [Op.between]: [new Date(parseInt(start as string)), new Date(parseInt(end as string))]
                }
            },
            order: [['timestamp', 'ASC']],
            include: [{
                model: MarketPair,
                attributes: ['baseAsset', 'quoteAsset']
            }]
        });

        console.log(`Found ${priceData.length} candles for marketPairId: ${marketPairId}`);

        // If not 1m interval, convert the data
        if (interval !== '1m') {
            const candles: Candle[] = priceData.map(candle => ({
                timestamp: candle.timestamp,
                marketPairId: candle.marketPairId.toString(),
                open: candle.open.toString(),
                high: candle.high.toString(),
                low: candle.low.toString(),
                close: candle.close.toString(),
                volume: candle.volume.toString(),
                marketPair: candle.get('MarketPair')
            }));
            const convertedCandles = convertCandles(candles, interval as string);
            return res.json(convertedCandles);
        }

        // Return minute data as is
        res.json(priceData);
    } catch (error) {
        console.error('Error fetching price history:', error);
        res.status(500).json({
            error: 'Failed to fetch price history',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get latest price
router.get('/latest/:marketPairId', async (req: Request, res: Response) => {
    try {
        const { marketPairId } = req.params;

        const latestPrice = await PriceCandle.findOne({
            where: { marketPairId },
            order: [['timestamp', 'DESC']],
            include: [{
                model: MarketPair,
                attributes: ['baseAsset', 'quoteAsset']
            }]
        });

        if (!latestPrice) {
            return res.status(404).json({ error: 'No price data found for this market pair' });
        }

        res.json(latestPrice);
    } catch (error) {
        console.error('Error fetching latest price:', error);
        res.status(500).json({ error: 'Failed to fetch latest price' });
    }
});

// Get market summary (24h stats)
router.get('/summary/:marketPairId', async (req: Request, res: Response) => {
    try {
        const { marketPairId } = req.params;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const dayStats = await PriceCandle.findAll({
            where: {
                marketPairId,
                timestamp: {
                    [Op.gte]: oneDayAgo
                }
            },
            order: [['timestamp', 'ASC']],
            include: [{
                model: MarketPair,
                attributes: ['baseAsset', 'quoteAsset']
            }]
        });

        if (dayStats.length === 0) {
            return res.status(404).json({ error: 'No recent price data found' });
        }

        const summary: MarketSummary = {
            marketPair: dayStats[0].get('MarketPair') as MarketPairData,
            open: parseFloat(dayStats[0].open.toString()),
            high: Math.max(...dayStats.map(candle => parseFloat(candle.high.toString()))),
            low: Math.min(...dayStats.map(candle => parseFloat(candle.low.toString()))),
            close: parseFloat(dayStats[dayStats.length - 1].close.toString()),
            volume: dayStats.reduce((sum, candle) => sum + parseFloat(candle.volume.toString()), 0),
            timestamp: new Date()
        };

        res.json(summary);
    } catch (error) {
        console.error('Error fetching market summary:', error);
        res.status(500).json({ error: 'Failed to fetch market summary' });
    }
});

export default router; 