import { sequelize } from '../config/database';
import { CryptoBalance } from '../models';

interface Balance {
    tokenSymbol: string;
    availableBalance: number;
    reservedBalance: number;
}

async function seedTestTradingBalances(userId: number): Promise<void> {
    const balances: Balance[] = [
        { tokenSymbol: 'BTC', availableBalance: 0.1, reservedBalance: 0 },
        { tokenSymbol: 'USDT', availableBalance: 100, reservedBalance: 0 }
    ];

    for (const b of balances) {
        await CryptoBalance.upsert({
            userId,
            tokenSymbol: b.tokenSymbol,
            availableBalance: b.availableBalance,
            reservedBalance: b.reservedBalance
        });
        console.log(`✅ Created ${b.tokenSymbol} balance for user ${userId}`);
    }
}

async function main(): Promise<void> {
    try {
        await sequelize.authenticate();
        console.log("✅ DB connection successful");

        const userId = parseInt(process.argv[2]); // Pass userId as CLI arg
        if (!userId) throw new Error("❌ Please provide a userId: node testCreateBalances.js <userId>");

        await seedTestTradingBalances(userId);
        console.log("✅ All balances seeded successfully");

    } catch (err) {
        console.error("❌ Failed to create balances:", err instanceof Error ? err.message : 'Unknown error');
    } finally {
        await sequelize.close();
    }
}

main(); 