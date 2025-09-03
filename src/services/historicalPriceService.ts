import { MarketPair, PriceCandle } from '../models';
import CustomError from '../utils/customError';
import { Op } from 'sequelize';
import axios from 'axios';

interface Candle {
    timestamp: Date;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
}

interface CandleRow {
    marketPairId: number;
    timestamp: Date;
    interval: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface FetchParams {
    baseAsset: string;
    quoteAsset: string;
    interval: string;
    startTime: Date;
    endTime: Date;
}

// === Private Helpers ===
function _validateInterval(interval: string): string {
    const valid = ['1m', '5m', '15m', '1h', '4h', '1d'];
    if (!interval) return '1m';
    if (!valid.includes(interval)) {
        throw new CustomError(`Invalid interval. Must be one of: ${valid.join(', ')}`, 400);
    }
    return interval;
}

async function _fetchFromExchange({ baseAsset, quoteAsset, interval, startTime, endTime }: FetchParams): Promise<Candle[]> {
    try {
        const symbol = `${baseAsset}${quoteAsset}`;
        const response = await axios.get('https://data-api.binance.vision/api/v3/klines', {
            params: {
                symbol,
                interval,
                startTime: startTime.getTime(),
                endTime: endTime.getTime(),
                limit: 1000
            }
        });

        if (!Array.isArray(response.data)) {
            throw new Error('Invalid Binance response');
        }

        return response.data.map(k => ({
            timestamp: new Date(k[0]),
            open: k[1],
            high: k[2],
            low: k[3],
            close: k[4],
            volume: k[5]
        }));
    } catch (err) {
        const msg = err.response?.data?.msg || err.message;
        const code = err.response?.status || 500;

        if (msg === 'Invalid symbol.' || err.response?.data?.code === -1121) {
            throw new CustomError(`Invalid trading pair ${baseAsset}${quoteAsset}`, 404);
        }

        throw new CustomError(`Binance API error: ${msg}`, code);
    }
}

async function _storeCandles(candles: Candle[], marketPairId: number, interval: string = '1m'): Promise<void> {
    const rows: CandleRow[] = candles.map(c => ({
        marketPairId,
        timestamp: c.timestamp,
        interval,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume)
    }));

    await PriceCandle.bulkCreate(rows, {
        updateOnDuplicate: ['open', 'high', 'low', 'close', 'volume']
    });
}

async function _fetchAndStore(baseAsset: string, quoteAsset: string, interval: string = '1m', days: number): Promise<Candle[]> {
    interval = _validateInterval(interval);

    const marketPair = await MarketPair.findOne({
        where: { baseAsset, quoteAsset, status: 'ACTIVE' }
    });
    if (!marketPair) throw new CustomError('Market pair not found or inactive', 404);

    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const chunkSize = 8 * 60 * 60 * 1000;

    let allCandles: Candle[] = [];
    let current = start;

    while (current < end) {
        const next = new Date(Math.min(current.getTime() + chunkSize, end.getTime()));
        const chunk = await _fetchFromExchange({ baseAsset, quoteAsset, interval, startTime: current, endTime: next });
        allCandles.push(...chunk);
        await new Promise(r => setTimeout(r, 500));
        current = next;
    }

    await _storeCandles(allCandles, marketPair.id, interval);
    return allCandles;
}

// === Public Interface ===
let isInitialized = false;

async function initialize(): Promise<void> {
    if (isInitialized) {
        console.warn('Historical price service already initialized');
        return;
    }

    const pairs = await MarketPair.findAll({ where: { status: 'ACTIVE' } });
    console.log(`⏳ Initializing historical data for ${pairs.length} pairs`);

    for (const pair of pairs) {
        _fetchAndStore(pair.baseAsset, pair.quoteAsset, '1m', 2);
    }

    isInitialized = true;
}

async function shutdown(): Promise<void> {
    isInitialized = false;
    console.log('🔻 Historical service shut down');
}

async function getHistoricalCandles(
    baseAsset: string,
    quoteAsset: string,
    interval: string = '1m',
    startTime: Date,
    endTime: Date
): Promise<Candle[]> {
    if (!isInitialized) {
        throw new CustomError('Historical service not initialized', 500);
    }

    interval = _validateInterval(interval);

    const marketPair = await MarketPair.findOne({
        where: { baseAsset, quoteAsset, status: 'ACTIVE' }
    });
    if (!marketPair) throw new CustomError('Market pair not found or inactive', 404);

    const candles = await PriceCandle.findAll({
        where: {
            marketPairId: marketPair.id,
            interval,
            timestamp: { [Op.between]: [startTime, endTime] }
        },
        order: [['timestamp', 'ASC']]
    });

    if (candles.length === 0) {
        const days = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
        const fresh = await _fetchAndStore(baseAsset, quoteAsset, interval, days);
        return fresh.filter(c => c.timestamp >= startTime && c.timestamp <= endTime);
    }

    return candles;
}

export {
    initialize,
    shutdown,
    getHistoricalCandles
}; 