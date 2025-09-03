import WebSocket from 'ws';
import { Op } from 'sequelize';
import { MarketPair, PriceCandle } from '../models';
import * as binanceKlineSocket from './binanceKlineSocket';
import { convertCandles } from '../utils/candleUtils';
import { KlineData } from './binanceKlineSocket';

interface PriceState {
    lastPrice: number;
    prevPrice: number;
    volume24h: number;
}

interface ServiceState {
    priceData: Map<string, PriceState>;
    marketPairCache: Map<string, string>;
    lastCandleTime: Map<string, Date>;
}

interface CandleData {
    timestamp: Date;
    interval: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// Store state
const state: ServiceState = {
    priceData: new Map(),
    marketPairCache: new Map(),
    lastCandleTime: new Map()
};

let wss: WebSocket.Server | null = null; // WebSocket server instance

// Initialize with WebSocket server
const initialize = (webSocketServer: WebSocket.Server): void => {
    wss = webSocketServer;
};

const startPriceFeed = async (symbol: string, marketPairId: string): Promise<void> => {
    try {
        console.log(`[PriceService] Starting price feed for ${symbol} (ID: ${marketPairId})...`);

        // Initialize the maps for this symbol if they don't exist
        if (!state.priceData.has(symbol)) {
            state.priceData.set(symbol, {
                lastPrice: 0,
                prevPrice: 0,
                volume24h: 0
            });
        }

        if (!state.marketPairCache.has(symbol)) {
            state.marketPairCache.set(symbol, marketPairId);
        }

        await binanceKlineSocket.initializeWebSocket(symbol, async (priceData: KlineData) => {
            try {
                if (!priceData || !priceData.timestamp) {
                    console.warn(`[PriceService] Invalid price data received for ${symbol}`);
                    return;
                }

                // Create minute-based timestamp
                const candleTime = new Date(priceData.timestamp);
                candleTime.setSeconds(0, 0);

                // Prepare candle data
                const candleData: CandleData = {
                    timestamp: candleTime,
                    interval: '1m',
                    open: priceData.open,
                    high: priceData.high,
                    low: priceData.low,
                    close: priceData.close,
                    volume: priceData.volume
                };

                // Save to database        
                bufferPriceCandle(marketPairId, candleData);

                if (wss) {
                    // Send the 1-minute update to all clients
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                type: 'priceUpdate',
                                symbol: symbol,
                                data: {
                                    ...candleData,
                                    marketPairId,
                                    interval: '1m'  // Explicitly mark as 1-minute data
                                }
                            }));
                        }
                    });
                }

                // Update state
                const currentState = state.priceData.get(symbol);
                if (currentState) {
                    state.priceData.set(symbol, {
                        lastPrice: priceData.close,
                        prevPrice: currentState.lastPrice,
                        volume24h: priceData.volume
                    });
                }

            } catch (error) {
                console.error(`[PriceService] Error processing price data for ${symbol}:`, error);
            }
        });

    } catch (error) {
        console.error(`[PriceService] Failed to start price feed for ${symbol}:`, error);
        throw error;
    }
};

// Modified to get historical candles based on interval
const getHistoricalCandles = async (marketPairId: string, interval: string = '1m'): Promise<any[]> => {
    try {
        const endTime = new Date();
        let startTime = new Date();

        // Calculate start time based on interval
        switch (interval) {
            case '1m':
            case '5m':
                startTime.setHours(startTime.getHours() - 1);
                break;
            case '15m':
            case '1h':
                startTime.setDate(startTime.getDate() - 1);
                break;
            case '4h':
            case '1d':
                startTime.setDate(startTime.getDate() - 2);
                break;
            default:
                startTime.setHours(startTime.getHours() - 1);
        }

        console.log(`[PriceService] Fetching ${interval} candles from ${startTime.toISOString()} to ${endTime.toISOString()}`);

        // Always fetch the base 1m candles from database for the calculated time range
        const minuteCandles = await PriceCandle.findAll({
            where: {
                marketPairId,
                interval: '1m',
                timestamp: {
                    [Op.between]: [startTime, endTime]
                }
            },
            order: [['timestamp', 'ASC']]
        });

        console.log(`[PriceService] Found ${minuteCandles.length} minute candles`);

        // If we need 1m candles, return them directly
        if (interval === '1m') {
            return minuteCandles;
        }

        // Otherwise convert to the requested interval
        const convertedCandles = convertCandles(minuteCandles, interval);
        console.log(`[PriceService] Converted to ${convertedCandles.length} ${interval} candles`);

        return convertedCandles;
    } catch (error) {
        console.error(`[PriceService] Error fetching historical candles for marketPairId ${marketPairId}:`, error);
        return [];
    }
};

const initializePriceFeeds = async (): Promise<void> => {
    try {
        const marketPairs = await MarketPair.findAll({
            where: { status: 'ACTIVE' }
        });

        console.log(`[PriceService] Found ${marketPairs.length} active market pairs`);

        for (const pair of marketPairs) {
            const symbol = `${pair.baseAsset}${pair.quoteAsset}`.toLowerCase();
            await startPriceFeed(symbol, pair.id);
        }

        console.log('[PriceService] Successfully initialized all price feeds');
    } catch (error) {
        console.error('[PriceService] Failed to initialize price feeds:', error);
        throw error;
    }
};

const closeAllConnections = async (): Promise<void> => {
    try {
        await binanceKlineSocket.closeAllConnections();
        state.priceData.clear();
        state.marketPairCache.clear();
        state.lastCandleTime.clear();
        console.log('[PriceService] Successfully closed all connections');
    } catch (error) {
        console.error('[PriceService] Error closing connections:', error);
        throw error;
    }
};

const BATCH_INTERVAL = 30000; // 30 seconds
const batchBuffer = new Map<string, CandleData[]>(); // Stores pending price updates

// Function to add price data to batch buffer
const bufferPriceCandle = (marketPairId: string, data: CandleData): void => {
    if (!batchBuffer.has(marketPairId)) {
        batchBuffer.set(marketPairId, []);
    }
    const buffer = batchBuffer.get(marketPairId);
    if (buffer) {
        buffer.push(data);
    }
};

// Flush batch updates to the database
const flushPriceCandles = async (): Promise<void> => {
    try {
        const bulkData = [];

        batchBuffer.forEach((candles, marketPairId) => {
            candles.forEach(candle => {
                bulkData.push({
                    marketPairId,
                    timestamp: candle.timestamp,
                    interval: candle.interval,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume
                });
            });
        });

        if (bulkData.length > 0) {
            await PriceCandle.bulkCreate(bulkData, {
                updateOnDuplicate: ['open', 'high', 'low', 'close', 'volume']
            });
            console.log(`[PriceService] Batch updated ${bulkData.length} price candles`);
        }

        batchBuffer.clear(); // Clear buffer after flushing
    } catch (error) {
        console.error('[PriceService] Error in batch processing:', error);
    }
};

// Set an interval to process batch updates
setInterval(flushPriceCandles, BATCH_INTERVAL);

export {
    initialize,
    startPriceFeed,
    initializePriceFeeds,
    getHistoricalCandles,
    closeAllConnections
}; 