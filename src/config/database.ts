import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Load database credentials from environment variables
const database: string = process.env.CRYPTO_DB_DATABASE || '';  // Separate database for crypto service
const username: string = process.env.CRYPTO_DB_USERNAME || '';
const password: string = process.env.CRYPTO_DB_PASSWORD || '';
const host: string = process.env.CRYPTO_DB_HOST || '127.0.0.1';  // Use different DB host if needed
const port: number = parseInt(process.env.CRYPTO_DB_PORT || '3306', 10);  // Default MySQL port

// Setup Sequelize instance for Crypto Trading Microservice
const sequelize: Sequelize = new Sequelize(database, username, password, {
    host: host,
    port: port,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development',  // Only log in development
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

async function connectDb(): Promise<Sequelize> {
    try {
        await sequelize.authenticate();
        console.log('Crypto Trading Microservice Database Connected Successfully.');

        // Only sync in development environment
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            console.log('Crypto Trading Database synchronized with models');
        }

        return sequelize;
    } catch (error) {
        console.error('Crypto Trading Microservice Database Connection Failed:', error);
        throw error;
    }
}

// Export the sequelize instance directly to maintain compatibility with models
export { connectDb, sequelize }; 