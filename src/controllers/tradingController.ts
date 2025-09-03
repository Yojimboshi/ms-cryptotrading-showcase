import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { TradingOrder, TradeHistory, MarketPair, CryptoBalance } from '../models';
import tradingService from '../services/tradingService';
import CustomError from '../utils/customError';

// Types
interface OrderRequest {
    marketPairId: number;
    orderType: 'BUY' | 'SELL';
    executionType: 'MARKET' | 'LIMIT';
    price?: number;
    quantity: number;
}

interface OrderResponse {
    id: number;
    publicId: string;
    orderType: string;
    executionType: string;
    price: number;
    quantity: number;
    status: string;
    createdAt: Date;
}

interface OrderQuery {
    status?: string;
    marketPairId?: number;
    limit?: string;
    page?: string;
}

interface TradeHistoryQuery {
    marketPairId?: number;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
}

interface Pagination {
    limit: number;
    offset: number;
}

interface OrderFilters {
    status?: string;
    marketPairId?: number;
}

interface TradeHistoryFilters {
    marketPairId?: number;
    startDate?: string;
    endDate?: string;
}

const placeOrder = asyncHandler(async (req: Request<{}, {}, OrderRequest>, res: Response) => {
    const userId = req.user.id; // Retrieved from JWT token
    const {
        marketPairId,
        orderType,
        executionType,
        price,
        quantity
    } = req.body;

    try {
        // Validate required fields
        if (!marketPairId || !orderType || !executionType || !quantity) {
            return res.status(400).json({
                message: "Missing required fields",
                required: "marketPairId, orderType, executionType, quantity"
            });
        }

        // Validate orderType
        if (!['BUY', 'SELL'].includes(orderType)) {
            return res.status(400).json({ message: "orderType must be BUY or SELL" });
        }

        // Validate executionType
        if (!['MARKET', 'LIMIT'].includes(executionType)) {
            return res.status(400).json({ message: "executionType must be MARKET or LIMIT" });
        }

        // Validate price for LIMIT orders
        if (executionType === 'LIMIT' && (price === undefined || price <= 0)) {
            return res.status(400).json({ message: "price is required for LIMIT orders" });
        }

        // Create order using the service
        const newOrder = await tradingService.createOrder(
            userId,
            marketPairId,
            orderType,
            executionType,
            price,
            quantity
        );

        // Return success response with order details
        res.status(201).json({
            message: "Order placed successfully",
            order: {
                id: newOrder.id,
                publicId: newOrder.publicId,
                orderType: newOrder.orderType,
                executionType: newOrder.executionType,
                price: newOrder.price,
                quantity: newOrder.quantity,
                status: newOrder.status,
                createdAt: newOrder.createdAt
            }
        });
    } catch (error) {
        console.error("[PLACE ORDER ERROR]", error);

        const status = error instanceof CustomError ? error.status : 500;
        res.status(status).json({
            message: error instanceof Error ? error.message : "Error placing order",
            error: error instanceof Error ? error.stack : undefined
        });
    }
});

const getUserOrders = asyncHandler(async (req: Request<{}, {}, {}, OrderQuery>, res: Response) => {
    const userId = req.user.id;
    const { status, marketPairId, limit = '10', page = '1' } = req.query;

    try {
        const filters: OrderFilters = {};
        if (status) filters.status = status;
        if (marketPairId) filters.marketPairId = Number(marketPairId);

        const pagination: Pagination = {
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        };

        const { orders, total } = await tradingService.getOrders(userId, filters, pagination);

        const formattedOrders = orders.map(order => ({
            id: order.id,
            publicId: order.publicId,
            orderType: order.orderType,
            executionType: order.executionType || 'LIMIT',
            marketPair: `${order.marketPair.baseAsset}/${order.marketPair.quoteAsset}`,
            price: order.price,
            quantity: order.quantity,
            status: order.status,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        }));

        res.status(200).json({
            orders: formattedOrders,
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error("[GET ORDERS ERROR]", error);
        res.status(error instanceof CustomError ? error.status : 500).json({
            message: error instanceof Error ? error.message : "Error retrieving orders",
            error: error instanceof Error ? error.stack : undefined
        });
    }
});

const cancelOrder = asyncHandler(async (req: Request<{}, {}, { orderId: number }>, res: Response) => {
    const userId = req.user.id;
    const { orderId } = req.body;

    try {
        if (!orderId) {
            return res.status(400).json({ message: "orderId is required" });
        }

        // First sync the order status with Binance
        await tradingService.syncOrderStatuses(userId, [orderId]);

        // Then try to cancel
        const result = await tradingService.cancelOrder(userId, orderId);
        res.status(200).json({
            message: "Order canceled successfully",
            order: {
                id: result.order.id,
                publicId: result.order.publicId,
                status: result.order.status
            }
        });
    } catch (error) {
        console.error("[CANCEL ORDER ERROR]", error);

        const status = error instanceof CustomError ? error.status : 500;
        res.status(status).json({
            message: error instanceof Error ? error.message : "Error canceling order",
            error: error instanceof Error ? error.stack : undefined
        });
    }
});

const getTradeHistory = asyncHandler(async (req: Request<{}, {}, {}, TradeHistoryQuery>, res: Response) => {
    const userId = req.user.id;
    const {
        marketPairId,
        startDate,
        endDate,
        page = '1',
        limit = '10'
    } = req.query;

    try {
        const filters: TradeHistoryFilters = {};
        if (marketPairId) filters.marketPairId = Number(marketPairId);
        if (startDate && endDate) {
            filters.startDate = startDate;
            filters.endDate = endDate;
        }

        const pagination: Pagination = {
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        };

        const { history, total } = await tradingService.getTradeHistory(userId, filters, pagination);

        const formattedHistory = history.map(trade => ({
            id: trade.id,
            publicId: trade.publicId,
            marketPair: `${trade.baseAsset}/${trade.quoteAsset}`,
            price: trade.price,
            quantity: trade.quantity,
            total: trade.total,
            fee: trade.fee,
            feeCurrency: trade.feeCurrency,
            createdAt: trade.createdAt
        }));

        res.status(200).json({
            trades: formattedHistory,
            total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        console.error("[TRADE HISTORY ERROR]", error);
        res.status(error instanceof CustomError ? error.status : 500).json({
            message: error instanceof Error ? error.message : "Error retrieving trade history",
            error: error instanceof Error ? error.stack : undefined
        });
    }
});

const getMarketPairs = asyncHandler(async (_req: Request, res: Response) => {
    try {
        const pairs = await MarketPair.findAll({
            where: { status: 'ACTIVE' },
            attributes: ['id', 'baseAsset', 'quoteAsset']
        });

        const formattedPairs = pairs.map(pair => ({
            id: pair.id,
            symbol: `${pair.baseAsset}/${pair.quoteAsset}`,
            baseAsset: pair.baseAsset,
            quoteAsset: pair.quoteAsset
        }));

        res.status(200).json(formattedPairs);
    } catch (error) {
        console.error("[MARKET PAIRS ERROR]", error);
        res.status(500).json({
            message: "Error retrieving market pairs",
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export {
    placeOrder,
    getUserOrders,
    cancelOrder,
    getTradeHistory,
    getMarketPairs,
}; 