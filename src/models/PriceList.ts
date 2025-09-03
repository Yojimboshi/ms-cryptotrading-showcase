import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// Interface for PriceList attributes
interface PriceListAttributes {
    id: number;
    marketPairId: number;
    lastPrice: number;
    prevPrice: number;
    volume24h: number;
    priceChangePercent: number;
    leverage: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for PriceList creation attributes
interface PriceListCreationAttributes extends Optional<PriceListAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Interface for PriceList instance methods
interface PriceListInstance extends Model<PriceListAttributes, PriceListCreationAttributes>, PriceListAttributes {}

export default (sequelize: Sequelize) => {
    class PriceList extends Model<PriceListAttributes, PriceListCreationAttributes> implements PriceListAttributes {
        public id!: number;
        public marketPairId!: number;
        public lastPrice!: number;
        public prevPrice!: number;
        public volume24h!: number;
        public priceChangePercent!: number;
        public leverage!: string;
        public readonly createdAt!: Date;
        public readonly updatedAt!: Date;
    }

    PriceList.init(
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
                comment: 'Reference to MarketPair',
            },
            lastPrice: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Latest traded price',
            },
            prevPrice: {
                type: DataTypes.DECIMAL(18, 8),
                allowNull: false,
                comment: 'Previous traded price',
            },
            volume24h: {
                type: DataTypes.DECIMAL(24, 8),
                allowNull: false,
                comment: '24-hour trading volume',
            },
            priceChangePercent: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
                comment: '24-hour price change in percent',
            },
            leverage: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: '5x',
                comment: 'Default leverage setting',
            },
        },
        {
            sequelize,
            modelName: 'priceList',
            tableName: 'price_lists',
            timestamps: true,
            indexes: [
                {
                    unique: true,
                    fields: ['marketPairId'],
                },
            ],
        }
    );

    return { PriceList };
}; 