import { Transaction } from 'sequelize';
import { TradingOrder, TradeHistory, MarketPair, CryptoBalance } from '../models';
import { getOrderStatusFromCEX, cancelOrderOnCEX, placeOrderOnCEX } from '../services/cexService';
import CustomError from '../utils/customError';
import { adjustPriceToTickSize, adjustQuantityToLotSize, getSymbolInfo } from '../utils/tradingUtils';
import config from '../config/config';

const TRADING_FEE = config.trading.fee; // 0.1% trading fee

interface SyncDetails {
    userId: number;
    baseAsset: string;
    quoteAsset: string;
    baseAmount: number;
    quoteAmount: number;
    price: number;
    quantity: number;
    fee: number;
    orderId: number;
    tradeHistoryId: number;
}

interface MarketPairInfo {
    baseAsset: string;
    quoteAsset: string;
}

/**
 * Validate user has sufficient balance before placing order with correct fee handling
 */
async function validateUserBalance(
    userId: number,
    marketPair: MarketPairInfo,
    orderType: 'BUY' | 'SELL',
    price: number,
    quantity: number,
    transaction: Transaction
): Promise<void> {
    // Defensive programming to avoid TypeErrors
    if (!userId || !marketPair || !orderType) {
        throw new CustomError("Invalid parameters for balance validation", 400);
    }

    // Make sure price and quantity are valid for calculations
    const validPrice = Number(price);
    if (isNaN(validPrice) || validPrice <= 0) {
        throw new CustomError("Invalid price for order", 400);
    }

    const validQuantity = Number(quantity);
    if (isNaN(validQuantity) || validQuantity <= 0) {
        throw new CustomError("Invalid quantity", 400);
    }

    try {
        if (orderType === "BUY") {
            // For BUY orders: need quote asset (e.g., USDT) for both purchase and fee
            const tradeAmount = validPrice * validQuantity;
            const feeAmount = tradeAmount * TRADING_FEE;
            const totalAmount = tradeAmount + feeAmount; // Include fee in the required balance

            console.log(`[VALIDATE_BALANCE] BUY order: ${validQuantity} ${marketPair.baseAsset} at ${validPrice} ${marketPair.quoteAsset} each`);
            console.log(`[VALIDATE_BALANCE] Trade amount: ${tradeAmount} ${marketPair.quoteAsset}`);
            console.log(`[VALIDATE_BALANCE] Fee amount: ${feeAmount} ${marketPair.quoteAsset} (0.1%)`);
            console.log(`[VALIDATE_BALANCE] Total required: ${totalAmount} ${marketPair.quoteAsset}`);

            // Check if user has enough quote asset (e.g., USDT)
            const balance = await CryptoBalance.findOne({
                where: {
                    userId: userId,
                    tokenSymbol: marketPair.quoteAsset
                },
                transaction
            });

            if (!balance) {
                throw new CustomError(`Insufficient ${marketPair.quoteAsset} balance`, 400);
            }

            // Ensure we're working with numbers
            const availableBalance = parseFloat(balance.availableBalance || '0');

            if (availableBalance < totalAmount) {
                throw new CustomError(`Insufficient ${marketPair.quoteAsset} balance. Required: ${totalAmount}, Available: ${availableBalance}`, 400);
            }

            // Safely update balance
            balance.availableBalance = availableBalance - totalAmount;
            balance.reservedBalance = parseFloat(balance.reservedBalance || '0') + totalAmount;

            await balance.save({ transaction });

            console.log(`[VALIDATE_BALANCE] Reserved ${totalAmount} ${marketPair.quoteAsset} for the purchase`);
        } else if (orderType === "SELL") {
            // For SELL orders: only need the base asset (crypto) being sold
            console.log(`[VALIDATE_BALANCE] SELL order: ${validQuantity} ${marketPair.baseAsset}`);

            const balance = await CryptoBalance.findOne({
                where: {
                    userId: userId,
                    tokenSymbol: marketPair.baseAsset
                },
                transaction
            });

            if (!balance) {
                throw new CustomError(`Insufficient ${marketPair.baseAsset} balance`, 400);
            }

            const availableBalance = parseFloat(balance.availableBalance || '0');

            if (availableBalance < validQuantity) {
                throw new CustomError(`Insufficient ${marketPair.baseAsset} balance. Required: ${validQuantity}, Available: ${availableBalance}`, 400);
            }

            balance.availableBalance = availableBalance - validQuantity;
            balance.reservedBalance = parseFloat(balance.reservedBalance || '0') + validQuantity;

            await balance.save({ transaction });

            console.log(`[VALIDATE_BALANCE] Reserved ${validQuantity} ${marketPair.baseAsset} for the sale`);
        } else {
            throw new CustomError("Invalid order type. Must be BUY or SELL", 400);
        }
    } catch (error) {
        console.error("[BALANCE VALIDATION ERROR]", error);

        // Always ensure we return a CustomError
        if (error instanceof CustomError) {
            throw error;
        } else {
            throw new CustomError(`Failed to validate balance: ${(error as Error).message}`, 500);
        }
    }
}

/**
 * Create trade history record and prepare sync data with consistent pricing and correct fee handling
 */
async function createTradeHistory(
    userId: number,
    marketPairId: number,
    orderId: number,
    baseAsset: string,
    quoteAsset: string,
    price: number,
    quantity: number,
    externalTradeId: string,
    transaction: Transaction
): Promise<SyncDetails> {
    console.log(`[CREATE_TRADE_HISTORY] Starting for orderId: ${orderId}, userId: ${userId}`);

    try {
        // Get the order to determine order type
        const order = await TradingOrder.findByPk(orderId, {
            include: [{ model: MarketPair }],
            transaction
        });

        if (!order) {
            throw new CustomError("Order not found when creating trade history", 404);
        }

        // Ensure we have a valid price
        let effectivePrice = price;
        if (!effectivePrice || effectivePrice <= 0) {
            if (order.price && order.price > 0) {
                effectivePrice = parseFloat(order.price);
            } else {
                throw new CustomError("Cannot process trade without a valid price", 500);
            }
        }

        // Calculate amounts based on order type with correct fee handling
        let baseAmount: number, quoteAmount: number, total: number, fee: number;

        if (order.orderType === "BUY") {
            // For BUY orders: 
            // - User gets the exact quantity of crypto they ordered
            // - Fee is EXTRA on top of the trade amount in USDT
            total = effectivePrice * quantity;
            fee = total * TRADING_FEE;

            baseAmount = quantity;
            quoteAmount = -(total + fee); // USDT decrease includes both trade amount and fee on top

            console.log(`[CREATE_TRADE_HISTORY] BUY order - ${quantity} ${baseAsset} costs ${total} USDT`);
            console.log(`[CREATE_TRADE_HISTORY] Fee is EXTRA: ${fee} USDT (0.1%)`);
            console.log(`[CREATE_TRADE_HISTORY] Total USDT charged: ${total + fee}`);
        } else {
            // For SELL orders:
            // - User sells the exact quantity of crypto they ordered
            // - Fee is deducted from the resulting USDT they receive
            total = effectivePrice * quantity;
            fee = total * TRADING_FEE;

            baseAmount = -quantity;
            quoteAmount = total - fee; // USDT increase after fee deduction

            console.log(`[CREATE_TRADE_HISTORY] SELL order - ${quantity} ${baseAsset} yields ${total} USDT`);
            console.log(`[CREATE_TRADE_HISTORY] Fee deducted: ${fee} USDT (0.1%)`);
            console.log(`[CREATE_TRADE_HISTORY] Net USDT received: ${total - fee}`);
        }

        // Create trade history record with all details
        const tradeHistory = await TradeHistory.create({
            userId,
            marketPairId,
            orderId,
            baseAsset,
            quoteAsset,
            price: effectivePrice,
            quantity,
            total,
            fee,
            feeCurrency: 'USDT',
            externalTradeId
        }, { transaction });

        // Return sync details
        return {
            userId,
            baseAsset,
            quoteAsset,
            baseAmount,
            quoteAmount,
            price: effectivePrice,
            quantity,
            fee,
            orderId,
            tradeHistoryId: tradeHistory.id
        };
    } catch (error) {
        console.error(`[CREATE_TRADE_HISTORY] Error: ${(error as Error).message}`);
        console.error((error as Error).stack);
        throw error instanceof CustomError
            ? error
            : new CustomError("Failed to create trade history", 500);
    }
}

/**
 * Sync order statuses from Binance
 */
async function syncOrderStatuses(userId: number | null = null, orderIds: number[] = []): Promise<void> {
    console.log(`[SYNC_ORDERS] Starting syncOrderStatuses with userId: ${userId}, orderIds: ${JSON.stringify(orderIds)}`);

    try {
        // Query conditions
        const where: any = {
            status: {
                [Op.notIn]: ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED']
            }
        };

        if (userId) {
            where.userId = userId;
        }

        if (orderIds.length > 0) {
            where.id = {
                [Op.in]: orderIds
            };
        }

        const orders = await TradingOrder.findAll({
            where,
            include: [{ model: MarketPair }]
        });

        console.log(`[SYNC_ORDERS] Found ${orders.length} orders to sync`);

        for (const order of orders) {
            try {
                const status = await getOrderStatusFromCEX(order.externalOrderId);
                if (status !== order.status) {
                    order.status = status;
                    await order.save();
                    console.log(`[SYNC_ORDERS] Updated order ${order.id} status to ${status}`);
                }
            } catch (error) {
                console.error(`[SYNC_ORDERS] Error syncing order ${order.id}:`, error);
            }
        }
    } catch (error) {
        console.error('[SYNC_ORDERS] Error:', error);
        throw error instanceof CustomError
            ? error
            : new CustomError("Failed to sync order statuses", 500);
    }
}

export {
    validateUserBalance,
    createTradeHistory,
    syncOrderStatuses
}; 