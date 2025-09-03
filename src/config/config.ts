import dotenv from 'dotenv';
dotenv.config();

interface DatabaseConfig {
    username: string;
    password: string | null;
    database: string;
    host: string;
    port?: string | number;
    dialect: 'mysql' | 'postgres' | 'sqlite' | 'mariadb' | 'mssql';
}

interface TradingConfig {
    fee: number;
    feeCurrency: string;
}

interface Config {
    development: DatabaseConfig;
    test: DatabaseConfig;
    production: DatabaseConfig;
    trading: TradingConfig;
}

const config: Config = {
    development: {
        username: process.env.DB_USERNAME || '',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || '',
        host: process.env.DB_HOST || '',
        port: process.env.DB_PORT,
        dialect: (process.env.DB_DIALECT as DatabaseConfig['dialect']) || 'postgres'
    },
    test: {
        username: 'root',
        password: null,
        database: 'mainService',
        host: '127.0.0.1',
        dialect: 'mysql'
    },
    production: {
        username: process.env.DB_USERNAME || '',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || '',
        host: process.env.DB_HOST || '',
        port: process.env.DB_PORT,
        dialect: (process.env.DB_DIALECT as DatabaseConfig['dialect']) || 'postgres'
    },
    trading: {
        fee: 0.001, // 0.1% trading fee
        feeCurrency: 'USDT'  // Default fee currency
    }
};

export default config; 