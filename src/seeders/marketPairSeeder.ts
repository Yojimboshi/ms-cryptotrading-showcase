import { Transaction } from 'sequelize';
import { MarketPair } from '../models';
import marketPairs from '../../shared/marketPairs.json';

type MarketPairStatus = 'ACTIVE' | 'INACTIVE';

interface MarketPairData {
    id: number;
    baseAsset: string;
    quoteAsset: string;
    status: MarketPairStatus;
}

async function seedMarketPairs(): Promise<void> {
    try {
        const existingPairs = await MarketPair.findAll();
        console.log(`Found ${existingPairs.length} existing market pairs.`);

        // Transaction start
        const transaction: Transaction = await MarketPair.sequelize!.transaction();
        let addedCount = 0;
        let updatedCount = 0;

        try {
            for (const newPair of marketPairs as MarketPairData[]) {
                const existing = existingPairs.find(p => p.id === newPair.id);

                if (!existing) {
                    await MarketPair.create({
                        id: newPair.id,
                        baseAsset: newPair.baseAsset,
                        quoteAsset: newPair.quoteAsset,
                        status: newPair.status as MarketPairStatus
                    }, { transaction });
                    console.log(`➕ Added new pair: ${newPair.baseAsset}/${newPair.quoteAsset} (ID: ${newPair.id})`);
                    addedCount++;
                } else if (
                    existing.baseAsset !== newPair.baseAsset ||
                    existing.quoteAsset !== newPair.quoteAsset ||
                    existing.status !== newPair.status
                ) {
                    await existing.update({
                        baseAsset: newPair.baseAsset,
                        quoteAsset: newPair.quoteAsset,
                        status: newPair.status as MarketPairStatus
                    }, { transaction });
                    console.log(`🔄 Updated pair: ${newPair.baseAsset}/${newPair.quoteAsset} (ID: ${newPair.id})`);
                    updatedCount++;
                } else {
                    console.log(`✓ No change for pair: ${newPair.baseAsset}/${newPair.quoteAsset} (ID: ${newPair.id})`);
                }
            }

            await transaction.commit();
            console.log(`✅ Seeding complete: ${addedCount} added, ${updatedCount} updated`);

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Transaction rolled back due to error:', error);
            throw error;
        }

        const finalPairs = await MarketPair.findAll();
        console.log('📊 Final market pairs in DB:', finalPairs.map(p => ({
            id: p.id,
            baseAsset: p.baseAsset,
            quoteAsset: p.quoteAsset,
            status: p.status
        })));

    } catch (error) {
        console.error('❌ Error seeding market pairs:', error);
        throw error;
    }
}

export { seedMarketPairs }; 