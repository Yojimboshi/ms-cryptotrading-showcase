import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// Interface for CryptoBalance attributes
interface CryptoBalanceAttributes {
    id: number;
    userId: number;
    tokenSymbol: string;
    availableBalance: number;
    reservedBalance: number;
    createdAt?: Date;
    updatedAt?: Date;
}

// Interface for CryptoBalance creation attributes
interface CryptoBalanceCreationAttributes extends Optional<CryptoBalanceAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

// Interface for CryptoBalance instance methods
interface CryptoBalanceInstance extends Model<CryptoBalanceAttributes, CryptoBalanceCreationAttributes>, CryptoBalanceAttributes {}

export default (sequelize: Sequelize) => {
    class CryptoBalance extends Model<CryptoBalanceAttributes, CryptoBalanceCreationAttributes> implements CryptoBalanceAttributes {
        public id!: number;
        public userId!: number;
        public tokenSymbol!: string;
        public availableBalance!: number;
        public reservedBalance!: number;
        public readonly createdAt!: Date;
        public readonly updatedAt!: Date;
    }

    CryptoBalance.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            userId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                comment: "User ID from the main module. No FK, fetched dynamically.",
            },
            tokenSymbol: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: 'The cryptocurrency symbol (e.g., BTC, ETH).',
            },
            availableBalance: {
                type: DataTypes.DECIMAL(25, 10),
                allowNull: false,
                defaultValue: 0,
                comment: 'Balance available for trading.',
            },
            reservedBalance: {
                type: DataTypes.DECIMAL(25, 10),
                allowNull: false,
                defaultValue: 0,
                comment: 'Balance locked in open orders.',
            },
        },
        {
            sequelize,
            modelName: 'cryptoBalance',
            tableName: 'crypto_balances',
            timestamps: true,
            indexes: [
                {
                    unique: true,
                    fields: ['userId', 'tokenSymbol'],
                },
            ],
        }
    );

    return { CryptoBalance };
}; 