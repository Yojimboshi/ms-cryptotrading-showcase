import { PriceCandle } from '../models';
import { Op, Model } from 'sequelize';

async function cleanupOldCandles(): Promise<void> {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const deletedCount = await (PriceCandle as typeof Model).destroy({
            where: {
                timestamp: {
                    [Op.lt]: oneDayAgo
                }
            }
        });

        console.log(`Cleaned up ${deletedCount} old candles`);
    } catch (error) {
        console.error('Error cleaning up old candles:', error);
    }
}

const startCleanupJob = (): void => {
    // Run cleanup immediately
    cleanupOldCandles();
    // Then run every hour
    setInterval(cleanupOldCandles, 60 * 60 * 1000);
    console.log('Cleanup job scheduled');
};

export {
    startCleanupJob
}; 