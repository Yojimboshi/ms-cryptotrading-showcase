import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// Define the possible interval values
type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

// Interface for PriceCandle attributes
interface PriceCandleAttributes {
    id: number;
    marketPairId: number;
    timestamp: Date;
    interval: CandleInterval;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for PriceCandle creation attributes
interface PriceCandleCreationAttributes extends Optional<PriceCandleAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Interface for PriceCandle instance methods
interface PriceCandleInstance extends Model<PriceCandleAttributes, PriceCandleCreationAttributes>, PriceCandleAttributes {}

export default (sequelize: Sequelize) => {
    class PriceCandle extends Model<PriceCandleAttributes, PriceCandleCreationAttributes> implements PriceCandleAttributes {
        public id!: number;
        public marketPairId!: number;
        public timestamp!: Date;
        public interval!: CandleInterval;
        public open!: number;
        public high!: number;
        public low!: number;
        public close!: number;
        public volume!: number;
        public readonly createdAt!: Date;
        public readonly updatedAt!: Date;
    }

    PriceCandle.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            marketPairId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'market_pairs',
                    key: 'id',
                },
                comment: 'Reference to trading pair',
            },
            timestamp: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: 'Start time of the candle',
            },
            interval: {
                type: DataTypes.ENUM('1m', '5m', '15m', '1h', '4h', '1d'),
                allowNull: false,
                comment: 'Candle interval',
            },
            open: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Opening price',
            },
            high: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Highest price',
            },
            low: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Lowest price',
            },
            close: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Closing price',
            },
            volume: {
                type: DataTypes.DECIMAL(30, 8),
                allowNull: false,
                comment: 'Trading volume',
            }
        },
        {
            sequelize,
            modelName: 'priceCandle',
            tableName: 'price_candles',
            timestamps: true,
            indexes: [
                {
                    fields: ['marketPairId', 'interval', 'timestamp'],
                    unique: true,
                },
                {
                    fields: ['timestamp'],
                },
            ],
        }
    );

    return { PriceCandle };
}; 