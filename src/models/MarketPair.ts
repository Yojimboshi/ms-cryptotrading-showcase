import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// Define the possible status values
type MarketPairStatus = 'ACTIVE' | 'INACTIVE';

// Interface for MarketPair attributes
interface MarketPairAttributes {
    id: number;
    baseAsset: string;
    quoteAsset: string;
    status: MarketPairStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for MarketPair creation attributes
interface MarketPairCreationAttributes extends Optional<MarketPairAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Interface for MarketPair instance methods
interface MarketPairInstance extends Model<MarketPairAttributes, MarketPairCreationAttributes>, MarketPairAttributes {}

export default (sequelize: Sequelize) => {
    class MarketPair extends Model<MarketPairAttributes, MarketPairCreationAttributes> implements MarketPairAttributes {
        public id!: number;
        public baseAsset!: string;
        public quoteAsset!: string;
        public status!: MarketPairStatus;
        public readonly createdAt!: Date;
        public readonly updatedAt!: Date;
    }

    MarketPair.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            baseAsset: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Base currency of the trading pair (e.g., BTC in BTC/USDT).',
            },
            quoteAsset: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'Quote currency of the trading pair (e.g., USDT in BTC/USDT).',
            },
            status: {
                type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
                allowNull: false,
                defaultValue: 'ACTIVE',
                comment: 'Status of the market pair.',
            },
        },
        {
            sequelize,
            modelName: 'marketPair',
            tableName: 'market_pairs',
            timestamps: true,
            indexes: [
                {
                    unique: true,
                    fields: ['baseAsset', 'quoteAsset'],
                },
            ],
        }
    );

    return { MarketPair };
}; 