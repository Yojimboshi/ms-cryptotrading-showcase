import fs from "fs";
import path from "path";
import axios from "axios";
import { BINANCE_API_URL } from "../config/cexConfig";

// Configure logging
const logDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
const logFilePath = path.join(logDir, "trading.log");

interface SymbolInfo {
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    filters: {
        filterType: string;
        tickSize?: string;
        stepSize?: string;
        minQty?: string;
        maxQty?: string;
        minPrice?: string;
        maxPrice?: string;
    }[];
}

interface OrderCostEstimate {
    subtotal: number;
    fee: number;
    total: number;
    effectivePrice: number;
}

interface ParsedSymbol {
    baseAsset: string;
    quoteAsset: string;
}

/**
 * Log messages to file with timestamp
 */
function logToFile(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    fs.appendFileSync(logFilePath, logMessage, 'utf8');
}

/**
 * Round number to specified decimal places
 */
function roundToDecimal(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

/**
 * Round to whole number
 */
function roundToInteger(value: number): number {
    return Math.round(value);
}

/**
 * Round up to nearest multiple
 */
function roundUpToNearestMultiple(num: number, multiple: number): number {
    return Math.ceil(num / multiple) * multiple;
}

/**
 * Get current price from Binance
 */
async function getCurrentPrice(symbol: string): Promise<number | null> {
    try {
        const response = await axios.get(`${BINANCE_API_URL}/api/v3/ticker/price?symbol=${symbol}`);
        return parseFloat(response.data.price);
    } catch (error) {
        console.error(`[PRICE FETCH ERROR] Symbol: ${symbol}`, error instanceof Error ? error.message : 'Unknown error');
        logToFile(`Failed to fetch current price for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
}

/**
 * Get symbol exchange info from Binance
 */
async function getSymbolInfo(symbol: string): Promise<SymbolInfo | null> {
    try {
        const response = await axios.get(`${BINANCE_API_URL}/api/v3/exchangeInfo?symbol=${symbol}`);
        if (response.data.symbols && response.data.symbols.length > 0) {
            return response.data.symbols[0];
        }
        return null;
    } catch (error) {
        console.error(`[SYMBOL INFO ERROR] Symbol: ${symbol}`, error instanceof Error ? error.message : 'Unknown error');
        logToFile(`Failed to fetch symbol info for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
}

/**
 * Count number of decimal places in a number
 */
function countDecimals(value: number): number {
    if (Math.floor(value) === value) return 0;
    const valueStr = value.toString();
    if (valueStr.includes('.')) {
        return valueStr.split('.')[1].length;
    }
    return 0;
}

/**
 * Adjust price to comply with exchange tick size
 */
function adjustPriceToTickSize(price: number, tickSize: number): number {
    const tickSizeDecimals = countDecimals(tickSize);
    // Calculate the multiplier for adjusting the price accurately
    const priceMultiplier = Math.pow(10, tickSizeDecimals);
    // Adjust the price based on the tick size
    const adjustedPrice = Math.floor(price * priceMultiplier / (tickSize * priceMultiplier)) * tickSize;
    return parseFloat(adjustedPrice.toFixed(tickSizeDecimals));
}

/**
 * Adjust quantity to comply with exchange lot size
 */
function adjustQuantityToLotSize(quantity: number, stepSize: number): number {
    const stepSizeDecimals = countDecimals(stepSize);
    const multiplier = Math.pow(10, stepSizeDecimals);
    const adjustedQuantity = Math.floor((quantity * multiplier) / (stepSize * multiplier)) * stepSize;
    return parseFloat(adjustedQuantity.toFixed(stepSizeDecimals));
}

/**
 * Format exchange symbol from base and quote assets
 */
function formatExchangeSymbol(baseAsset: string, quoteAsset: string): string {
    return `${baseAsset}${quoteAsset}`;
}

/**
 * Parse exchange symbol into base and quote assets
 */
function parseExchangeSymbol(symbol: string): ParsedSymbol {
    // Common quote assets to check
    const quoteAssets = ['USDT', 'BTC', 'ETH', 'USD', 'EUR', 'BNB'];

    for (const quote of quoteAssets) {
        if (symbol.endsWith(quote)) {
            const base = symbol.slice(0, -quote.length);
            return { baseAsset: base, quoteAsset: quote };
        }
    }

    // Default fallback for unknown patterns
    return { baseAsset: symbol.slice(0, -4), quoteAsset: symbol.slice(-4) };
}

/**
 * Calculate trading fee based on order size and fee rate
 */
function calculateTradingFee(orderSize: number, feeRate: number = 0.001): number {
    return orderSize * feeRate;
}

/**
 * Estimate order cost including fees
 */
function estimateOrderCost(
    orderType: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    feeRate: number = 0.001
): OrderCostEstimate {
    const subtotal = quantity * price;
    const fee = subtotal * feeRate;

    if (orderType === 'BUY') {
        return {
            subtotal,
            fee,
            total: subtotal + fee,
            effectivePrice: (subtotal + fee) / quantity
        };
    } else { // SELL
        return {
            subtotal,
            fee,
            total: subtotal - fee,
            effectivePrice: (subtotal - fee) / quantity
        };
    }
}

export {
    logToFile,
    roundToDecimal,
    roundToInteger,
    roundUpToNearestMultiple,
    getCurrentPrice,
    getSymbolInfo,
    countDecimals,
    adjustPriceToTickSize,
    adjustQuantityToLotSize,
    formatExchangeSymbol,
    parseExchangeSymbol,
    calculateTradingFee,
    estimateOrderCost,
    SymbolInfo,
    OrderCostEstimate,
    ParsedSymbol
}; 