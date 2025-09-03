import { Server as WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import priceService from '../services/priceService';
import { getHistoricalCandles } from '../services/historicalPriceService';
import { getDefaultTimeRange } from '../utils/candleUtils';

interface WebSocketRequest {
    type: string;
    baseAsset?: string;
    quoteAsset?: string;
    interval?: string;
}

interface WebSocketResponse {
    type: string;
    status?: string;
    symbol?: string;
    data?: any;
    interval?: string;
    message?: string;
}

let wss: WebSocketServer | null = null;

function initializeTradingSocket(server: HttpServer): WebSocketServer {
    wss = new WebSocketServer({ server });
    priceService.initialize(wss);

    console.log('✅ WebSocket Server Initialized');

    wss.on('connection', async (ws: WebSocket) => {
        console.log('🔗 New WebSocket Connection Established');

        ws.on('message', async (message: Buffer) => {
            try {
                const request: WebSocketRequest = JSON.parse(message.toString());
                console.log(`📩 Received WebSocket Request:`, request);

                if (request.type === 'getHistorical') {
                    if (!request.baseAsset || !request.quoteAsset) {
                        throw new Error('BaseAsset and QuoteAsset are required for historical data');
                    }

                    const baseAsset = request.baseAsset.toUpperCase();
                    const quoteAsset = request.quoteAsset.toUpperCase();
                    const interval = (request.interval || '1m').toLowerCase();

                    const { startTime, endTime } = getDefaultTimeRange(interval);

                    const candles = await getHistoricalCandles(
                        baseAsset,
                        quoteAsset,
                        interval,
                        startTime,
                        endTime
                    );

                    const response: WebSocketResponse = {
                        type: 'historical',
                        symbol: `${baseAsset}${quoteAsset}`.toLowerCase(),
                        data: candles,
                        interval
                    };

                    ws.send(JSON.stringify(response));
                }
            } catch (error) {
                console.error('Error processing message:', error);
                const errorResponse: WebSocketResponse = {
                    type: 'error',
                    message: error instanceof Error ? error.message : 'Failed to process request'
                };
                ws.send(JSON.stringify(errorResponse));
            }
        });

        ws.on('close', () => {
            console.log('❌ WebSocket Client Disconnected');
        });

        const connectionResponse: WebSocketResponse = {
            type: 'connection',
            status: 'connected'
        };
        ws.send(JSON.stringify(connectionResponse));
    });

    return wss;
}

export { initializeTradingSocket }; 