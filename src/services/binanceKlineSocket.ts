import WebSocket from 'ws';

interface ServiceState {
    connections: Map<string, WebSocket>;
    retryAttempts: Map<string, number>;
}

interface KlineData {
    symbol: string;
    timestamp: number;
    interval: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    isClosed: boolean;
}

interface BinanceKlineMessage {
    e: string;
    s: string;
    k: {
        t: number;
        i: string;
        o: string;
        h: string;
        l: string;
        c: string;
        v: string;
        x: boolean;
    };
}

const state: ServiceState = {
    connections: new Map(),
    retryAttempts: new Map()
};

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

const initializeWebSocket = async (symbol: string, callback: (data: KlineData) => void): Promise<void> => {
    try {
        console.log(`[WebSocketService] Initializing WebSocket for ${symbol}...`);

        const wsUrl = `wss://data-stream.binance.vision/ws/${symbol.toLowerCase()}@kline_1m`;
        console.log(`[WebSocketService] Connecting to WebSocket URL: ${wsUrl}`);

        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log(`[WebSocketService] ✅ WebSocket connection established for ${symbol}`);
            state.retryAttempts.set(symbol, 0);
        });

        ws.on('message', (data: WebSocket.Data) => {
            try {
                const message = JSON.parse(data.toString()) as BinanceKlineMessage;

                if (message.e === 'kline') {
                    const kline = message.k;

                    if (kline.i === '1m') {
                        const priceData: KlineData = {
                            symbol: message.s,
                            timestamp: kline.t,
                            interval: '1m',
                            open: parseFloat(kline.o),
                            high: parseFloat(kline.h),
                            low: parseFloat(kline.l),
                            close: parseFloat(kline.c),
                            volume: parseFloat(kline.v),
                            isClosed: kline.x
                        };

                        callback(priceData);
                    }
                }
            } catch (error) {
                console.error(`[WebSocketService] Error processing message for ${symbol}:`, error);
            }
        });

        ws.on('error', (error: Error) => {
            console.error(`[WebSocketService] WebSocket error for ${symbol}:`, error.message);
            handleReconnection(symbol, callback);
        });

        ws.on('close', () => {
            console.log(`[WebSocketService] WebSocket connection closed for ${symbol}`);
            handleReconnection(symbol, callback);
        });

        state.connections.set(symbol, ws);
    } catch (error) {
        console.error(`[WebSocketService] Failed to initialize WebSocket for ${symbol}:`, error);
        throw error;
    }
};

const handleReconnection = async (symbol: string, callback: (data: KlineData) => void): Promise<void> => {
    const attempts = state.retryAttempts.get(symbol) || 0;

    if (attempts < MAX_RETRIES) {
        console.log(`[WebSocketService] Attempting to reconnect ${symbol} (Attempt ${attempts + 1}/${MAX_RETRIES})`);
        state.retryAttempts.set(symbol, attempts + 1);

        setTimeout(async () => {
            await reconnect(symbol, callback);
        }, RETRY_DELAY);
    } else {
        console.error(`[WebSocketService] Failed to establish connection for ${symbol} after ${MAX_RETRIES} attempts`);
    }
};

const reconnect = async (symbol: string, callback: (data: KlineData) => void): Promise<void> => {
    const ws = state.connections.get(symbol);
    if (ws) {
        ws.terminate();
    }
    await initializeWebSocket(symbol, callback);
};

const closeConnection = (symbol: string): void => {
    const ws = state.connections.get(symbol);
    if (ws) {
        ws.close();
        state.connections.delete(symbol);
    }
};

const closeAllConnections = async (): Promise<void> => {
    for (const [symbol, ws] of state.connections) {
        console.log(`[WebSocketService] Closing connection for ${symbol}`);
        closeConnection(symbol);
    }
    state.connections.clear();
};

export {
    initializeWebSocket,
    closeConnection,
    closeAllConnections,
    KlineData
}; 