import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import crypto from 'crypto';

// Define the possible order types and statuses
type OrderType = 'BUY' | 'SELL';
type ExecutionType = 'MARKET' | 'LIMIT';
type OrderStatus = 'PENDING' | 'PLACED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';

// Interface for TradingOrder attributes
interface TradingOrderAttributes {
    id: number;
    publicId: string;
    userId: number;
    marketPairId: number;
    orderType: OrderType;
    executionType: ExecutionType;
    price: number | null;
    quantity: number;
    status: OrderStatus;
    externalOrderId?: string;
    fillQuantity?: number;
    fillPrice?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for TradingOrder creation attributes
interface TradingOrderCreationAttributes extends Optional<TradingOrderAttributes, 
    'id' | 'publicId' | 'externalOrderId' | 'fillQuantity' | 'fillPrice' | 'createdAt' | 'updatedAt'> {}

// Interface for TradingOrder instance methods
interface TradingOrderInstance extends Model<TradingOrderAttributes, TradingOrderCreationAttributes>, TradingOrderAttributes {}

export default (sequelize: Sequelize) => {
    class TradingOrder extends Model<TradingOrderAttributes, TradingOrderCreationAttributes> implements TradingOrderAttributes {
        public id!: number;
        public publicId!: string;
        public userId!: number;
        public marketPairId!: number;
        public orderType!: OrderType;
        public executionType!: ExecutionType;
        public price!: number | null;
        public quantity!: number;
        public status!: OrderStatus;
        public externalOrderId?: string;
        public fillQuantity?: number;
        public fillPrice?: number;
        public readonly createdAt!: Date;
        public readonly updatedAt!: Date;
    }

    TradingOrder.init(
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            publicId: {
                type: DataTypes.STRING(10),
                allowNull: false,
                unique: true,
                defaultValue: () => crypto.randomBytes(5).toString('hex').toUpperCase(),
                comment: 'Publicly exposed order identifier.',
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: "User ID from the main module",
            },
            marketPairId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'market_pairs',
                    key: 'id',
                },
                comment: 'Trading pair for the order.',
            },
            orderType: {
                type: DataTypes.ENUM('BUY', 'SELL'),
                allowNull: false,
                comment: 'Type of order (BUY or SELL).',
            },
            executionType: {
                type: DataTypes.ENUM('MARKET', 'LIMIT'),
                allowNull: false,
                defaultValue: 'LIMIT',
                comment: 'Execution type (MARKET or LIMIT).',
            },
            price: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: true,
                comment: 'Price specified for the order (null for market orders).',
            },
            quantity: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Order size in base asset.',
            },
            status: {
                type: DataTypes.ENUM('PENDING', 'PLACED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED'),
                allowNull: false,
                defaultValue: 'PENDING',
                comment: 'Current status of the order.',
            },
            externalOrderId: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Order ID assigned by external CEX (e.g., Binance).',
            },
            fillQuantity: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: true,
                defaultValue: 0,
                comment: 'Amount already filled for partially filled orders.',
            },
            fillPrice: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: true,
                comment: 'Average fill price for filled or partially filled orders.',
            },
        },
        {
            sequelize,
            modelName: 'tradingOrder',
            tableName: 'trading_orders',
            timestamps: true,
        }
    );

    return { TradingOrder };
}; 