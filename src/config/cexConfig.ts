import dotenv from 'dotenv';
dotenv.config();

interface Endpoints {
    ACCOUNT_INFO: string;
    ORDER: string;
    OPEN_ORDERS: string;
    ORDER_STATUS: string;
    CANCEL_ORDER: string;
    EXCHANGE_INFO: string;
    TICKER_PRICE: string;
    KLINES: string;
    DEPTH: string;
}

interface CexConfig {
    BINANCE_API_URL: string;
    CEX_API_KEY: string;
    CEX_SECRET_KEY: string;
    CEX_API_URL: string;
    ENDPOINTS: Endpoints;
    TRADING_FEE_RATE: number;
    BINANCE_WS_URL: string;
    DEFAULT_MARKET_PAIRS: string[];
}

const config: CexConfig = {
    // Binance API base URL - Use testnet for development
    BINANCE_API_URL: process.env.BINANCE_API_URL || '',

    // Binance API key and secret - Load from environment variables
    CEX_API_KEY: process.env.BINANCE_API_KEY || '',
    CEX_SECRET_KEY: process.env.BINANCE_API_SECRET || '',

    // Use the same URL for API calls
    CEX_API_URL: process.env.BINANCE_API_URL || '',

    ENDPOINTS: {
        ACCOUNT_INFO: '/api/v3/account', // Get account info
        ORDER: '/api/v3/order', // Place an order
        OPEN_ORDERS: '/api/v3/openOrders', // Get open orders
        ORDER_STATUS: '/api/v3/order', // Check order status
        CANCEL_ORDER: '/api/v3/order', // Cancel an order
        EXCHANGE_INFO: '/api/v3/exchangeInfo', // Get exchange info
        TICKER_PRICE: '/api/v3/ticker/price', // Get latest price for a symbol
        KLINES: '/api/v3/klines', // Get candlestick data
        DEPTH: '/api/v3/depth', // Get market depth
    },

    // Trading fee rate (0.1% standard)
    TRADING_FEE_RATE: parseFloat(process.env.TRADING_FEE_RATE || '0.001'),

    // Websocket endpoints
    BINANCE_WS_URL: process.env.BINANCE_WS_URL || 'wss://testnet.binance.vision/ws',

    // Default market pairs to track
    DEFAULT_MARKET_PAIRS: (process.env.DEFAULT_MARKET_PAIRS || 'BTCUSDT,ETHUSDT,BNBUSDT').split(',')
};

export default config; 