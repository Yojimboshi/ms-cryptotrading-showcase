import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import CustomError from '../utils/customError';
import { getHistoricalCandles } from '../services/historicalPriceService';

interface HistoricalCandleQuery {
    baseAsset: string;
    quoteAsset: string;
    interval: string;
    startTime: string;
    endTime: string;
}

interface HistoricalCandleResponse {
    success: boolean;
    marketPair: string;
    interval: string;
    candleCount: number;
    candles: any[]; // TODO: Define proper candle type when available
}

const getHistoricalData = asyncHandler(async (req: Request<{}, {}, {}, HistoricalCandleQuery>, res: Response<HistoricalCandleResponse>) => {
    const { baseAsset, quoteAsset, interval, startTime, endTime } = req.query;

    if (!baseAsset || !quoteAsset || !interval || !startTime || !endTime) {
        throw new CustomError('Missing required parameters', 400);
    }

    const candles = await getHistoricalCandles(
        baseAsset.toUpperCase(),
        quoteAsset.toUpperCase(),
        interval.toLowerCase(),
        new Date(startTime),
        new Date(endTime)
    );

    res.status(200).json({
        success: true,
        marketPair: `${baseAsset}/${quoteAsset}`,
        interval,
        candleCount: candles.length,
        candles
    });
});

export {
    getHistoricalData
}; 