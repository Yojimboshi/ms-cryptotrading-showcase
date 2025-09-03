import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import crypto from 'crypto';

// Interface for TradeHistory attributes
interface TradeHistoryAttributes {
    id: number;
    publicId: string;
    userId: number;
    marketPairId: number;
    orderId: number;
    baseAsset: string;
    quoteAsset: string;
    price: number;
    quantity: number;
    total: number;
    fee: number;
    feeCurrency: string;
    externalTradeId?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for TradeHistory creation attributes
interface TradeHistoryCreationAttributes extends Optional<TradeHistoryAttributes, 'id' | 'publicId' | 'externalTradeId' | 'createdAt' | 'updatedAt'> {}

// Interface for TradeHistory instance methods
interface TradeHistoryInstance extends Model<TradeHistoryAttributes, TradeHistoryCreationAttributes>, TradeHistoryAttributes {}

export default (sequelize: Sequelize) => {
    class TradeHistory extends Model<TradeHistoryAttributes, TradeHistoryCreationAttributes> implements TradeHistoryAttributes {
        public id!: number;
        public publicId!: string;
        public userId!: number;
        public marketPairId!: number;
        public orderId!: number;
        public baseAsset!: string;
        public quoteAsset!: string;
        public price!: number;
        public quantity!: number;
        public total!: number;
        public fee!: number;
        public feeCurrency!: string;
        public externalTradeId?: string;
        public readonly createdAt!: Date;
        public readonly updatedAt!: Date;
    }

    TradeHistory.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            publicId: {
                type: DataTypes.STRING(12),
                allowNull: false,
                unique: true,
                defaultValue: () => crypto.randomBytes(6).toString('hex').toUpperCase(),
                comment: 'Publicly exposed trade identifier.',
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: "User ID from the main module. No FK, fetched dynamically.",
            },
            marketPairId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'market_pairs',
                    key: 'id',
                },
                comment: 'Trading pair for the executed trade.',
            },
            orderId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'trading_orders',
                    key: 'id',
                },
                comment: 'Reference to the original order.',
            },
            baseAsset: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Base asset of the trade.',
            },
            quoteAsset: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Quote asset of the trade.',
            },
            price: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Execution price.',
            },
            quantity: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Quantity executed.',
            },
            total: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Total value of the trade (price × quantity).',
            },
            fee: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Trading fee charged.',
            },
            feeCurrency: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Currency in which fee was charged.',
            },
            externalTradeId: {
                type: DataTypes.STRING,
                allowNull: true,
                comment: 'Trade ID assigned by external CEX.',
            },
        },
        {
            sequelize,
            modelName: 'tradeHistory',
            tableName: 'trade_history',
            timestamps: true,
        }
    );

    return { TradeHistory };
}; 