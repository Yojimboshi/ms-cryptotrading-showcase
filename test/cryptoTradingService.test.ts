import chai from 'chai';
import sinon from 'sinon';
import { expect } from 'chai';
import proxyquire from 'proxyquire';
import { Transaction } from 'sequelize';

// Types
interface Balance {
    tokenSymbol: string;
    availableBalance: number;
    reservedBalance: number;
    update: sinon.SinonStub;
    save: sinon.SinonStub;
}

interface OrderRecord {
    id: number;
    userId: number;
    status: string;
    externalOrderId: string;
    orderType: string;
    price: number;
    quantity: number;
    executionType: string;
    marketPairId: number;
    marketPair: {
        baseAsset: string;
        quoteAsset: string;
    };
    save: sinon.SinonStub;
}

interface MarketPair {
    id: number;
    baseAsset: string;
    quoteAsset: string;
}

interface ModelStubs {
    TradingOrder: {
        create: sinon.SinonStub;
        findAll: sinon.SinonStub;
        findOne: sinon.SinonStub;
        findByPk: sinon.SinonStub;
    };
    TradeHistory: {
        create: sinon.SinonStub;
        findAll: sinon.SinonStub;
    };
    MarketPair: {
        findByPk: sinon.SinonStub;
        findAll: sinon.SinonStub;
    };
    CryptoBalance: {
        findOne: sinon.SinonStub;
        findAll: sinon.SinonStub;
        create: sinon.SinonStub;
    };
    sequelize: {
        transaction: sinon.SinonStub;
        query: sinon.SinonStub;
        QueryTypes: {
            SELECT: string;
            UPDATE: string;
            INSERT: string;
        };
    };
}

// Mock dependencies
const createMocks = () => {
    // Transaction stub
    const transactionStub: Transaction = {
        commit: sinon.stub().resolves(),
        rollback: sinon.stub().resolves(),
        LOCK: { UPDATE: 'UPDATE' }
    } as unknown as Transaction;

    // Sequelize stub
    const sequelizeStub = {
        transaction: sinon.stub().resolves(transactionStub),
        query: sinon.stub().resolves([]),
        QueryTypes: { SELECT: 'SELECT', UPDATE: 'UPDATE', INSERT: 'INSERT' }
    };

    // Balance records
    const usdtBalance: Balance = {
        tokenSymbol: 'USDT',
        availableBalance: 10000,
        reservedBalance: 5000,
        update: sinon.stub().resolves(),
        save: sinon.stub().resolves()
    };

    const btcBalance: Balance = {
        tokenSymbol: 'BTC',
        availableBalance: 1,
        reservedBalance: 0,
        update: sinon.stub().resolves(),
        save: sinon.stub().resolves()
    };

    // Order record stub
    const orderRecord: OrderRecord = {
        id: 1,
        userId: 1,
        status: 'PLACED',
        externalOrderId: '12345',
        orderType: 'BUY',
        price: 50000,
        quantity: 0.1,
        executionType: 'LIMIT',
        marketPairId: 1,
        marketPair: { baseAsset: 'BTC', quoteAsset: 'USDT' },
        save: sinon.stub().resolves()
    };

    // Market pair stub
    const marketPairStub: MarketPair = {
        id: 1,
        baseAsset: 'BTC',
        quoteAsset: 'USDT'
    };

    // Model stubs with more specific behavior
    const modelStubs: ModelStubs = {
        TradingOrder: {
            create: sinon.stub().resolves({
                id: 1,
                save: sinon.stub().resolves(),
                ...orderRecord
            }),
            findAll: sinon.stub().resolves([orderRecord]),
            findOne: sinon.stub().resolves(orderRecord),
            findByPk: sinon.stub().resolves(orderRecord)
        },
        TradeHistory: {
            create: sinon.stub().resolves({
                id: 1,
                userId: 1,
                marketPairId: 1,
                orderId: 1,
                baseAsset: 'BTC',
                quoteAsset: 'USDT',
                price: 50000,
                quantity: 0.1,
                total: 5000,
                fee: 5,
                feeCurrency: 'USDT'
            }),
            findAll: sinon.stub().resolves([
                { id: 1, userId: 1, marketPairId: 1, orderId: 1 }
            ])
        },
        MarketPair: {
            findByPk: sinon.stub().resolves(marketPairStub),
            findAll: sinon.stub().resolves([
                marketPairStub,
                { baseAsset: 'ETH', quoteAsset: 'USDT' }
            ])
        },
        CryptoBalance: {
            findOne: sinon.stub(),
            findAll: sinon.stub().resolves([
                { userId: 1, tokenSymbol: 'USDT', availableBalance: 10000, reservedBalance: 5000, update: sinon.stub().resolves(), save: sinon.stub().resolves() },
                { userId: 1, tokenSymbol: 'BTC', availableBalance: 1, reservedBalance: 0, update: sinon.stub().resolves(), save: sinon.stub().resolves() }
            ]),
            create: sinon.stub().resolves(usdtBalance)
        },
        sequelize: sequelizeStub
    };

    // Set up specific behavior for CryptoBalance.findOne
    modelStubs.CryptoBalance.findOne.withArgs(sinon.match({
        where: sinon.match({ tokenSymbol: 'USDT' })
    })).resolves(usdtBalance);

    modelStubs.CryptoBalance.findOne.withArgs(sinon.match({
        where: sinon.match({ tokenSymbol: 'BTC' })
    })).resolves(btcBalance);

    // Low balance for testing insufficient funds
    modelStubs.CryptoBalance.findOne.withArgs(sinon.match({
        where: sinon.match({ tokenSymbol: 'USDT', userId: 'low-balance' })
    })).resolves({
        tokenSymbol: 'USDT',
        availableBalance: 100,
        reservedBalance: 0,
        save: sinon.stub().resolves()
    });

    // CEX service stubs
    const cexServiceStubs = {
        placeOrderOnCEX: sinon.stub().resolves({
            orderId: '12345',
            status: 'FILLED',
            executedQty: 0.1,
            price: 50000
        }),
        getOrderStatusFromCEX: sinon.stub().resolves({
            status: 'NEW',
            price: 50000,
            executedQty: 0.1,
            orderId: '12345'
        }),
        cancelOrderOnCEX: sinon.stub().resolves({ status: 'CANCELED' })
    };

    // Trading utils stubs
    const tradingUtilsStubs = {
        adjustPriceToTickSize: sinon.stub().callsFake(price => price),
        adjustQuantityToLotSize: sinon.stub().callsFake(qty => qty),
        getSymbolInfo: sinon.stub().resolves({
            filters: [
                { filterType: 'PRICE_FILTER', tickSize: '0.01' },
                { filterType: 'LOT_SIZE', stepSize: '0.00001' }
            ]
        })
    };

    // Crypto module stubs
    const cryptoStub = {
        createHmac: sinon.stub().returns({
            update: sinon.stub().returnsThis(),
            digest: sinon.stub().returns('mocksignature')
        })
    };

    // Custom axios stub that properly handles different methods and URIs
    const axiosStub = function (config: any) {
        // For ticker price endpoint
        if (config.url && config.url.includes('ticker/price')) {
            return Promise.resolve({ data: { price: '50000' } });
        }

        // For account endpoint
        if (config.url && config.url.includes('api/v3/account')) {
            return Promise.resolve({
                data: {
                    balances: [
                        { asset: 'BTC', free: '1.0', locked: '0.0' },
                        { asset: 'USDT', free: '1000.0', locked: '0.0' },
                        { asset: 'ETH', free: '10.0', locked: '0.0' }
                    ]
                }
            });
        }

        // For main service sync endpoint
        if (config.url && config.url.includes('balance/sync-from-micro')) {
            return Promise.resolve({
                status: 200,
                data: { success: true, message: 'Balance updates synced successfully' }
            });
        }

        // Default response
        return Promise.resolve({ data: {} });
    };

    // Config stub
    const configStub = {
        trading: {
            fee: 0.001 // 0.1% trading fee
        }
    };

    return {
        modelStubs,
        cexServiceStubs,
        tradingUtilsStubs,
        cryptoStub,
        axiosStub,
        configStub
    };
};

// Custom error class
class CustomError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        this.name = 'CustomError';
    }
}

// Export for testing
export {
    createMocks,
    CustomError
}; 