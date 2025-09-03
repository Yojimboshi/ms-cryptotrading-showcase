import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

// Interface for LocalUserCache attributes
interface LocalUserCacheAttributes {
    userId: number;
    username: string;
    email: string;
    lastUpdated: Date;
}

// Interface for LocalUserCache creation attributes
interface LocalUserCacheCreationAttributes extends Optional<LocalUserCacheAttributes, 'lastUpdated'> {}

// Interface for LocalUserCache instance methods
interface LocalUserCacheInstance extends Model<LocalUserCacheAttributes, LocalUserCacheCreationAttributes>, LocalUserCacheAttributes {}

export default (sequelize: Sequelize) => {
    class LocalUserCache extends Model<LocalUserCacheAttributes, LocalUserCacheCreationAttributes> implements LocalUserCacheAttributes {
        public userId!: number;
        public username!: string;
        public email!: string;
        public lastUpdated!: Date;
    }

    LocalUserCache.init(
        {
            userId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                comment: "User ID from the main module",
            },
            username: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "Cached username from the main module",
            },
            email: {
                type: DataTypes.STRING,
                allowNull: false,
                comment: "Cached email from the main module",
            },
            lastUpdated: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
                comment: "Timestamp of last cache update",
            },
        },
        {
            sequelize,
            modelName: "localUserCache",
            tableName: "local_user_cache",
            timestamps: false,
            indexes: [
                {
                    unique: true,
                    fields: ['email'], // Keep email as unique through an index
                }
            ]
        }
    );

    return { LocalUserCache };
}; 