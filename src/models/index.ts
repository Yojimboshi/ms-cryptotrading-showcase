import { Sequelize } from 'sequelize';
import config from '../config/config';

// Import model factories
import cryptoBalanceFactory from './CryptoBalance';
import localUserCacheFactory from './LocalUserCache';
import marketPairFactory from './MarketPair';
import priceCandleFactory from './PriceCandle';
import priceListFactory from './PriceList';
import tradeHistoryFactory from './TradeHistory';
import tradingOrderFactory from './TradingOrder';

// Get the current environment
type Environment = 'development' | 'test' | 'production';
const env = (process.env.NODE_ENV || 'development') as Environment;
const dbConfig = config[env];

// Initialize Sequelize with database configuration
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password || undefined,
    {
        host: dbConfig.host,
        port: dbConfig.port ? parseInt(dbConfig.port.toString()) : undefined,
        dialect: dbConfig.dialect,
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// Initialize models
const { CryptoBalance } = cryptoBalanceFactory(sequelize);
const { LocalUserCache } = localUserCacheFactory(sequelize);
const { MarketPair } = marketPairFactory(sequelize);
const { PriceCandle } = priceCandleFactory(sequelize);
const { PriceList } = priceListFactory(sequelize);
const { TradeHistory } = tradeHistoryFactory(sequelize);
const { TradingOrder } = tradingOrderFactory(sequelize);

// Define associations
MarketPair.hasMany(PriceCandle, { foreignKey: 'marketPairId' });
PriceCandle.belongsTo(MarketPair, { foreignKey: 'marketPairId' });

MarketPair.hasOne(PriceList, { foreignKey: 'marketPairId' });
PriceList.belongsTo(MarketPair, { foreignKey: 'marketPairId' });

MarketPair.hasMany(TradingOrder, { foreignKey: 'marketPairId' });
TradingOrder.belongsTo(MarketPair, { foreignKey: 'marketPairId' });

MarketPair.hasMany(TradeHistory, { foreignKey: 'marketPairId' });
TradeHistory.belongsTo(MarketPair, { foreignKey: 'marketPairId' });

TradingOrder.hasMany(TradeHistory, { foreignKey: 'orderId' });
TradeHistory.belongsTo(TradingOrder, { foreignKey: 'orderId' });

export {
    sequelize,
    CryptoBalance,
    LocalUserCache,
    MarketPair,
    PriceCandle,
    PriceList,
    TradeHistory,
    TradingOrder
}; 