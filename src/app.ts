import dotenv from 'dotenv';
import express, { Express, Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { Server as WebSocketServer } from 'ws';

import { connectDb } from './config/database';
import { sequelize } from './models';
import { initializeTradingSocket } from './websocket';
import { seedMarketPairs } from './seeders/marketPairSeeder';
import { startCleanupJob } from './jobs/cleanupJob';
import priceService from './services/priceService';
import historicalPriceService from './services/historicalPriceService';

import errorHandler from './middlewares/errorHandler';

// Routes
import tradingRoutes from './routes/tradingRoutes';
import priceRoutes from './routes/priceRoutes';
import historicalRoutes from './routes/historicalRoutes';
import userCacheRoutes from './routes/userCacheRoutes';
import walletRoutes from './routes/walletRoutes';

dotenv.config();

// === Express Setup ===
const app: Express = express();
const server: http.Server = http.createServer(app);

const allowedOrigins: string[] = [
    "https://api.by1.io",
    "http://localhost:3000",
    "https://by1.io",
];

app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept, Authorization, user",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
}));
app.use(express.json());

// === Health Check ===
app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
        status: "success",
        message: "Trading microservice is operational",
        timestamp: new Date().toISOString()
    });
});

app.get("/api/test", (_req: Request, res: Response) => {
    res.json({
        status: "success",
        message: "CryptoTrading API works",
        timestamp: new Date().toISOString()
    });
});

// === Routes ===
app.use("/api/prices", priceRoutes);
app.use("/api/historical", historicalRoutes);

// Protected routes (require API key)
app.use("/api/trading", tradingRoutes);
app.use("/api/user-cache", userCacheRoutes);
app.use("/api/trading/wallet", walletRoutes);

// === Error Handler ===
app.use(errorHandler);

// === Server Boot ===
async function startServer(): Promise<void> {
    try {
        await connectDb();
        await seedMarketPairs();

        const PORT: number = parseInt(process.env.PORT || '4001', 10);
        const wss: WebSocketServer = initializeTradingSocket(server);
        app.locals.wss = wss;

        await historicalPriceService.initialize();
        await priceService.initializePriceFeeds();
        startCleanupJob();

        server.listen(PORT, () => {
            console.log(`🚀 Trading microservice running on port ${PORT}`);
        });

    } catch (err) {
        console.error("❌ Failed to start trading microservice:", err);
        process.exit(1);
    }
}

// === Graceful Shutdown ===
async function shutdown(): Promise<void> {
    console.log('Performing graceful shutdown...');
    try {
        if (priceService.closeAllConnections) await priceService.closeAllConnections();
        if (historicalPriceService.shutdown) await historicalPriceService.shutdown();
        if (app.locals.wss) {
            app.locals.wss.close(() => {
                console.log('✅ WebSocket server closed');
                process.exit(0);
            });
        } else {
            process.exit(0);
        }
    } catch (err) {
        console.error('❌ Error during shutdown:', err);
        process.exit(1);
    }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
startServer(); 