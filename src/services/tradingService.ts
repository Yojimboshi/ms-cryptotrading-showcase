import { TradingOrder, TradeHistory, MarketPair, CryptoBalance, sequelize } from "../models";
import { getOrderStatusFromCEX, cancelOrderOnCEX, placeOrderOnCEX } from "./cexService";
import CustomError from "../utils/customError";
import { validateUserBalance, createTradeHistory } from "../utils/tradingServiceUtils";
import { adjustPriceToTickSize, adjustQuantityToLotSize, getSymbolInfo } from "../utils/tradingUtils";
import axios from 'axios';
import config from '../config/config';

const TRADING_FEE = config.trading.fee; // 0.1% trading fee

interface OrderFilters {
    status?: string;
    marketPairId?: number;
}

interface Pagination {
    limit?: number;
    offset?: number;
}

interface TradeHistoryFilters {
    marketPairId?: number;
    startDate?: string;
    endDate?: string;
}

interface OrderResult {
    orders: TradingOrder[];
    total: number;
}

interface TradeHistoryResult {
    history: TradeHistory[];
    total: number;
}

interface CancelOrderResult {
    message: string;
    order: TradingOrder;
}

/**
 * Create and place a new trading order with atomic operation guarantees
 */
async function createOrder(
    userId: number,
    marketPairId: number,
    orderType: 'BUY' | 'SELL',
    executionType: 'MARKET' | 'LIMIT',
    price: number | null,
    quantity: number
): Promise<TradingOrder> {
    // Step 1: Validate input
    if (!userId || isNaN(parseInt(String(userId))) || String(userId).includes(';')) {
        throw new CustomError('Invalid or missing userId', 400);
    }
    if (!marketPairId || isNaN(parseInt(String(marketPairId)))) {
        throw new CustomError('Market pair not found', 404);
    }
    if (!['BUY', 'SELL'].includes(orderType) || !['MARKET', 'LIMIT'].includes(executionType)) {
        throw new CustomError('Invalid order or execution type', 400);
    }
    if (executionType === 'LIMIT' && (!price || price <= 0)) {
        throw new CustomError('Price required for LIMIT orders', 400);
    }
    if (!quantity || quantity <= 0) {
        throw new CustomError('Invalid quantity', 400);
    }

    // Step 2: Prepare inputs
    userId = parseInt(String(userId));
    let transaction = null;
    let executionPrice = price;
    let adjustedPrice = price;
    let adjustedQuantity = quantity;
    let marketPair = null;
    let newOrder = null;

    try {
        // Step 3: Get market pair
        marketPair = await MarketPair.findByPk(marketPairId);
        if (!marketPair) {
            throw new CustomError("Market pair not found", 404);
        }
        const symbol = `${marketPair.baseAsset}${marketPair.quoteAsset}`;
        console.log(`[CREATE_ORDER] Symbol: ${symbol}`);

        // Step 4: Get market price if needed
        if (executionType === 'MARKET') {
            const { data } = await axios.get('https://api.binance.com/api/v3/ticker/price', { params: { symbol } });
            if (!data || !data.price) {
                throw new CustomError(`Could not get price for ${symbol}`, 500);
            }
            executionPrice = parseFloat(data.price);
            console.log(`[CREATE_ORDER] Market price: ${executionPrice}`);
        }

        // Step 5: Adjust price/quantity to Binance rules
        const symbolInfo = await getSymbolInfo(symbol);
        if (!symbolInfo) {
            throw new CustomError("Binance symbol info missing", 500);
        }
        const tickSize = parseFloat(symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER').tickSize);
        const stepSize = parseFloat(symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE').stepSize);
        adjustedQuantity = adjustQuantityToLotSize(quantity, stepSize);
        adjustedPrice = executionType === 'LIMIT' ? adjustPriceToTickSize(executionPrice, tickSize) : executionPrice;

        // Step 6: Start transaction
        transaction = await sequelize.transaction();
        console.log(`[CREATE_ORDER] DB transaction started`);

        // Step 7: Validate user balance
        await validateUserBalance(userId, marketPair, orderType, adjustedPrice, adjustedQuantity, transaction);

        // Step 8: Create pending order
        newOrder = await TradingOrder.create({
            userId,
            marketPairId,
            orderType,
            price: adjustedPrice,
            quantity: adjustedQuantity,
            status: "PENDING",
            executionType
        }, { transaction });

        // Step 9: Place order on Binance
        const cexResponse = await placeOrderOnCEX(
            orderType,
            symbol,
            executionType,
            executionType === 'LIMIT' ? adjustedPrice : null,
            adjustedQuantity
        );
        newOrder.externalOrderId = cexResponse.orderId;
        newOrder.status = "PLACED";

        // Step 10: If order was filled
        if (cexResponse.status === "FILLED") {
            newOrder.status = "FILLED";
            const executedQty = parseFloat(cexResponse.executedQty || String(adjustedQuantity));
            const executedPrice = parseFloat(cexResponse.price || String(adjustedPrice));

            const baseAmount = orderType === 'BUY' ? executedQty : -executedQty;
            const quoteAmount = orderType === 'BUY'
                ? -executedQty * executedPrice
                : executedQty * executedPrice;

            // Step 11: Record trade
            await TradeHistory.create({
                userId,
                orderId: newOrder.id,
                marketPairId: marketPair.id,
                baseAsset: marketPair.baseAsset,
                quoteAsset: marketPair.quoteAsset,
                quantity: executedQty,
                price: executedPrice,
                externalTradeId: cexResponse.orderId
            }, { transaction });

            // Step 12: Update balances
            await updateBalance(userId, marketPair.baseAsset, baseAmount, transaction);
            await updateBalance(userId, marketPair.quoteAsset, quoteAmount, transaction);
        }

        // Step 13: Save and commit
        await newOrder.save({ transaction });
        await transaction.commit();
        console.log(`[CREATE_ORDER] Order committed: ${newOrder.id}`);
        return newOrder;

    } catch (error) {
        console.error(`[CREATE_ORDER] Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (transaction) {
            try {
                await transaction.rollback();
                console.log(`[CREATE_ORDER] Transaction rolled back`);
            } catch (rollbackError) {
                console.error(`[CREATE_ORDER] Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`);
            }
        }
        throw error instanceof CustomError
            ? error
            : new CustomError(`Failed to place order: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
}

/**
 * Get all orders for a user with optional filtering
 */
async function getOrders(userId: number, filters: OrderFilters = {}, pagination: Pagination = {}): Promise<OrderResult> {
    try {
        const where = { userId, ...filters };

        const { count: total, rows: orders } = await TradingOrder.findAndCountAll({
            where,
            include: [{
                model: MarketPair,
                attributes: ['baseAsset', 'quoteAsset']
            }],
            order: [['createdAt', 'DESC']],
            ...pagination
        });

        return { orders, total };
    } catch (error) {
        console.error("[GET ORDERS ERROR]", error);
        throw new CustomError("Failed to retrieve orders", 500);
    }
}

/**
 * Cancel an existing order
 */
async function cancelOrder(userId: number, orderId: number): Promise<CancelOrderResult> {
    let transaction = await sequelize.transaction();

    try {
        // #1: Fetch order and validate ownership/status
        const order = await TradingOrder.findOne({
            where: { id: orderId, userId },
            include: [{ model: MarketPair }]
        });
        if (!order) throw new CustomError("Order not found or access denied", 404);
        if (order.status !== "PLACED") throw new CustomError("Only active orders can be canceled", 400);

        const symbol = `${order.marketPair.baseAsset}${order.marketPair.quoteAsset}`;

        // #2: Check CEX status (filled or already canceled)
        try {
            const cexStatus = await getOrderStatusFromCEX(order.externalOrderId, symbol);

            if (cexStatus.status === "FILLED") {
                order.status = "FILLED";
                await order.save({ transaction });
                await transaction.commit();
                return { message: "Order already filled", order };
            }

            if (cexStatus.status === "CANCELED") {
                order.status = "CANCELLED";
                await order.save({ transaction });
                await transaction.commit();
                return { message: "Order already canceled", order };
            }
        } catch (err) {
            if (err.response?.data?.code === -2013 || err.message.includes("does not exist")) {
                order.status = "CANCELLED";
                await order.save({ transaction });
                await transaction.commit();
                return { message: "Order not found on Binance, marked canceled", order };
            }
            throw err;
        }

        // #3: Cancel on CEX
        const cancelResponse = await cancelOrderOnCEX(order.externalOrderId, symbol);
        if (cancelResponse.status !== "CANCELED") {
            throw new CustomError("CEX did not confirm cancellation", 502);
        }
        order.status = "CANCELLED";
        await order.save({ transaction });

        // #4: Release reserved balance if possible
        const token = order.orderType === "BUY" ? order.marketPair.quoteAsset : order.marketPair.baseAsset;
        const releaseAmount = order.orderType === "BUY" ? order.price * order.quantity : order.quantity;

        const balance = await CryptoBalance.findOne({ where: { userId, tokenSymbol: token }, transaction });
        if (balance) {
            balance.reservedBalance = parseFloat(balance.reservedBalance) - releaseAmount;
            await balance.save({ transaction });
        }

        await transaction.commit();
        return { message: "Order canceled successfully", order };

    } catch (error) {
        await transaction.rollback();
        throw error instanceof CustomError
            ? error
            : new CustomError(`Failed to cancel order: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
}

/**
 * Get trade history for a user
 */
async function getTradeHistory(userId: number, filters: TradeHistoryFilters = {}, pagination: Pagination = {}): Promise<TradeHistoryResult> {
    try {
        const where: any = { userId };
        if (filters.marketPairId) where.marketPairId = filters.marketPairId;
        if (filters.startDate && filters.endDate) {
            where.createdAt = {
                [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
            };
        }

        const { count: total, rows: history } = await TradeHistory.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            ...pagination
        });

        return { history, total };
    } catch (error) {
        console.error("[TRADE HISTORY ERROR]", error);
        throw new CustomError("Failed to retrieve trade history", 500);
    }
}

/**
 * Update user's reserved balance
 */
async function updateReservedBalance(userId: number, tokenSymbol: string, amount: number, transaction: any): Promise<void> {
    const [balance, created] = await CryptoBalance.findOrCreate({
        where: { userId, tokenSymbol },
        defaults: { availableBalance: 0, reservedBalance: 0 },
        transaction
    });

    balance.reservedBalance = parseFloat(balance.reservedBalance) + amount;
    await balance.save({ transaction });
}

/**
 * Update user's available balance
 */
async function updateBalance(userId: number, tokenSymbol: string, amount: number, transaction: any): Promise<void> {
    const [balance, created] = await CryptoBalance.findOrCreate({
        where: { userId, tokenSymbol },
        defaults: { availableBalance: 0, reservedBalance: 0 },
        transaction
    });

    balance.availableBalance = parseFloat(balance.availableBalance) + amount;
    await balance.save({ transaction });
}

export {
    createOrder,
    getOrders,
    cancelOrder,
    getTradeHistory,
    updateReservedBalance,
    updateBalance
}; 