import axios from "axios";
import crypto from "crypto";
import { CEX_API_KEY, CEX_SECRET_KEY, CEX_API_URL } from "../config/cexConfig";
import CustomError from "../utils/customError";

interface CEXOrderParams {
    symbol: string;
    side: string;
    type: string;
    quantity: number;
    timestamp: number;
    timeInForce?: string;
    price?: number;
}

interface CEXOrderResponse {
    orderId: string;
    status: string;
    executedQty?: string;
    price?: string;
}

interface CEXBalance {
    asset: string;
    free: string;
    locked: string;
}

interface SyncResult {
    status: string;
    message: string;
    count: number;
}

// Helper function to create HMAC SHA256 signature (Required for Binance API)
function createSignature(queryString: string): string {
    return crypto.createHmac("sha256", CEX_SECRET_KEY).update(queryString).digest("hex");
}

/**
 * Place order on Binance
 */
async function placeOrderOnCEX(
    orderType: 'BUY' | 'SELL',
    symbol: string,
    executionType: 'MARKET' | 'LIMIT',
    price: number | null,
    quantity: number
): Promise<CEXOrderResponse> {
    try {
        const timestamp = Date.now();

        // Prepare query parameters
        const queryParams: CEXOrderParams = {
            symbol: symbol,
            side: orderType,
            type: executionType,
            quantity: quantity,
            timestamp: timestamp
        };

        // Add price and timeInForce for LIMIT orders
        if (executionType === 'LIMIT') {
            queryParams.timeInForce = 'GTC'; // Good Till Canceled
            queryParams.price = price;
        }

        // Convert params to query string
        const queryString = Object.entries(queryParams)
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        // Create signature
        const signature = createSignature(queryString);
        console.log("Signature:", signature);
        console.log("Query String:", queryString);

        // Make API call
        const response = await axios.post(
            `${CEX_API_URL}/api/v3/order?${queryString}&signature=${signature}`,
            null, // No body for POST
            {
                headers: {
                    "X-MBX-APIKEY": CEX_API_KEY,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error("[CEX ORDER ERROR]", error instanceof Error ? error.message : 'Unknown error');
        throw new CustomError(
            error.response?.data?.msg || "Failed to place order on Binance",
            error.response?.status || 500
        );
    }
}

/**
 * Get order status from Binance
 */
async function getOrderStatusFromCEX(orderId: string, symbol: string): Promise<CEXOrderResponse> {
    try {
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
        const signature = createSignature(queryString);

        const response = await axios.get(
            `${CEX_API_URL}/api/v3/order?${queryString}&signature=${signature}`,
            {
                headers: {
                    "X-MBX-APIKEY": CEX_API_KEY,
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error("[CEX ORDER STATUS ERROR]", error instanceof Error ? error.message : 'Unknown error');
        throw new CustomError(
            error.response?.data?.msg || "Failed to fetch order status from Binance",
            error.response?.status || 500
        );
    }
}

/**
 * Cancel order on Binance
 */
async function cancelOrderOnCEX(orderId: string, symbol: string): Promise<CEXOrderResponse> {
    try {
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&orderId=${orderId}&timestamp=${timestamp}`;
        const signature = createSignature(queryString);

        console.log(`Canceling order: Symbol=${symbol}, OrderID=${orderId}`);

        const response = await axios.delete(
            `${CEX_API_URL}/api/v3/order?${queryString}&signature=${signature}`,
            {
                headers: {
                    "X-MBX-APIKEY": CEX_API_KEY,
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error("[CEX CANCEL ERROR]", error instanceof Error ? error.message : 'Unknown error');

        // Handle specific error codes from Binance
        if (error.response?.data?.code === -2011) {  // Unknown order
            throw new CustomError("Order not found or already executed", 404);
        } else if (error.response?.data?.code === -2013) {  // Order does not exist
            throw new CustomError("Order already finished (filled or canceled)", 404);
        }

        throw new CustomError(
            error.response?.data?.msg || "Failed to cancel order on Binance",
            error.response?.status || 500
        );
    }
}

/**
 * Get account balance from Binance
 */
async function getAccountBalanceFromCEX(): Promise<CEXBalance[]> {
    try {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = createSignature(queryString);

        const response = await axios.get(
            `${CEX_API_URL}/api/v3/account?${queryString}&signature=${signature}`,
            {
                headers: {
                    "X-MBX-APIKEY": CEX_API_KEY,
                }
            }
        );

        return response.data.balances;
    } catch (error) {
        console.error("[CEX BALANCE ERROR]", error instanceof Error ? error.message : 'Unknown error');
        throw new CustomError(
            error.response?.data?.msg || "Failed to fetch account balance from Binance",
            error.response?.status || 500
        );
    }
}

/**
 * Sync balances from Binance to local database
 */
async function syncBalancesFromCEX(userId: number): Promise<SyncResult> {
    try {
        const balances = await getAccountBalanceFromCEX();

        // Filter out zero balances and transform data
        const nonZeroBalances = balances.filter(
            b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        );

        // TODO: Implement the logic to sync these balances to your CryptoBalance table
        // This would involve updating or creating CryptoBalance records for the user

        return {
            status: "success",
            message: "Balances synced successfully",
            count: nonZeroBalances.length
        };
    } catch (error) {
        console.error("[BALANCE SYNC ERROR]", error instanceof Error ? error.message : 'Unknown error');
        throw new CustomError("Failed to sync balances from Binance", 500);
    }
}

export {
    placeOrderOnCEX,
    getOrderStatusFromCEX,
    cancelOrderOnCEX,
    getAccountBalanceFromCEX,
    syncBalancesFromCEX
}; 