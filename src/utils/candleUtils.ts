interface Candle {
    timestamp: Date | string;
    marketPairId: string;
    open: string | number;
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
    MarketPair?: any;
    marketPair?: any;
}

interface ConvertedCandle {
    timestamp: Date;
    marketPairId: string;
    interval: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    marketPair: any;
}

interface TimeRange {
    startTime: Date;
    endTime: Date;
}

type ValidInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

const VALID_INTERVALS: ValidInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

function normalizeInterval(interval: string = '1m'): string {
    return interval.toLowerCase();
}

/**
 * Converts 1-minute candles to a larger time interval
 */
const convertCandles = (minuteCandles: Candle[], targetInterval: string): ConvertedCandle[] => {
    if (!Array.isArray(minuteCandles) || minuteCandles.length === 0) return [];

    const interval = normalizeInterval(targetInterval);
    if (!VALID_INTERVALS.includes(interval as ValidInterval)) {
        console.warn(`Invalid interval: ${interval}`);
        return minuteCandles as unknown as ConvertedCandle[];
    }

    const groupedCandles = new Map<number, ConvertedCandle>();

    for (const candle of minuteCandles) {
        if (!candle?.timestamp) continue;

        const timestamp = candle.timestamp instanceof Date ? candle.timestamp : new Date(candle.timestamp);
        const intervalDate = getIntervalStartTime(timestamp, interval);
        const intervalKey = intervalDate.getTime();

        const open = parseFloat(candle.open as string) || 0;
        const high = parseFloat(candle.high as string) || 0;
        const low = parseFloat(candle.low as string) || 0;
        const close = parseFloat(candle.close as string) || 0;
        const volume = parseFloat(candle.volume as string) || 0;

        if (!groupedCandles.has(intervalKey)) {
            groupedCandles.set(intervalKey, {
                timestamp: intervalDate,
                marketPairId: candle.marketPairId,
                interval,
                open,
                high,
                low,
                close,
                volume,
                marketPair: candle.MarketPair || candle.marketPair
            });
        } else {
            const existing = groupedCandles.get(intervalKey)!;
            existing.high = Math.max(existing.high, high);
            existing.low = Math.min(existing.low, low);
            existing.close = close;
            existing.volume += volume;
        }
    }

    return Array.from(groupedCandles.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};

/**
 * Calculates the start time of a candle interval
 */
function getIntervalStartTime(date: Date | string, interval: string): Date {
    const d = new Date(date);
    switch (interval) {
        case '5m': d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0); break;
        case '15m': d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0); break;
        case '1h': d.setMinutes(0, 0, 0); break;
        case '4h': d.setHours(Math.floor(d.getHours() / 4) * 4, 0, 0, 0); break;
        case '1d': d.setHours(0, 0, 0, 0); break;
        default: d.setSeconds(0, 0);
    }
    return d;
}

/**
 * Provides a default time range for a given interval
 */
function getDefaultTimeRange(interval: string = '1m'): TimeRange {
    const normalized = normalizeInterval(interval);
    const endTime = new Date();
    const startTime = new Date(endTime);

    switch (normalized) {
        case '1m':
        case '5m':
            startTime.setHours(endTime.getHours() - 1); break;
        case '15m':
        case '1h':
            startTime.setDate(endTime.getDate() - 1); break;
        case '4h':
        case '1d':
            startTime.setDate(endTime.getDate() - 2); break;
        default:
            startTime.setHours(endTime.getHours() - 1);
    }

    return { startTime, endTime };
}

// Export types
export type {
    Candle,
    ConvertedCandle,
    TimeRange,
    ValidInterval
};

// Export functions
export {
    convertCandles,
    getIntervalStartTime,
    getDefaultTimeRange
};

// Export the hourly candles converter as a named function
export const convertToHourlyCandles = (data: Candle[]) => convertCandles(data, '1h'); 