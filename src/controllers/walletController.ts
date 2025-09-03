import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { CryptoBalance } from '../models';
import { sequelize } from '../config/database';
import CustomError from '../utils/customError';
import { getDefaultTokenSymbols } from '../utils/tokenUtils';

interface BalanceResponse {
    id: number;
    tokenSymbol: string;
    availableBalance: number;
    reservedBalance: number;
    totalBalance: number;
    updatedAt: Date;
}

interface TransferRequest {
    tokenSymbol: string;
    amount: number;
}

interface TransferResponse {
    message: string;
    balance: CryptoBalance;
}

const getUserBalances = asyncHandler(async (req: Request<{}, {}, {}, { token?: string }>, res: Response<BalanceResponse[]>) => {
    const userId = req.user.id;
    const { token } = req.query;

    console.log(`[getUserBalances] User=${userId}, Token=${token || 'ALL'}`);

    try {
        let balances;

        if (token) {
            const [record, created] = await CryptoBalance.findOrCreate({
                where: { userId, tokenSymbol: token },
                defaults: { availableBalance: 0, reservedBalance: 0 }
            });

            if (created) console.log(`[getUserBalances] Created missing balance for ${token}`);
            balances = [record];
        }
        else {
            balances = await CryptoBalance.findAll({ where: { userId } });

            if (balances.length === 0) {
                const symbols = getDefaultTokenSymbols();
                console.log(`[getUserBalances] No balances found, creating tokens: ${symbols.join(', ')}`);

                const created = await Promise.all(
                    symbols.map(symbol =>
                        CryptoBalance.create({
                            userId,
                            tokenSymbol: symbol,
                            availableBalance: 0,
                            reservedBalance: 0
                        })
                    )
                );
                balances = created;
            }
        }

        const formatted = balances.map(b => ({
            id: b.id,
            tokenSymbol: b.tokenSymbol,
            availableBalance: parseFloat(b.availableBalance),
            reservedBalance: parseFloat(b.reservedBalance),
            totalBalance: parseFloat(b.availableBalance) + parseFloat(b.reservedBalance),
            updatedAt: b.updatedAt
        }));

        res.status(200).json(formatted);
    } catch (error) {
        console.error("[getUserBalances] Error:", error);
        res.status(500).json({
            message: error instanceof Error ? error.message : "Error retrieving balances",
            error: error instanceof Error ? error.stack : undefined
        } as any);
    }
});

const transferToTrading = asyncHandler(async (req: Request<{}, {}, TransferRequest>, res: Response<TransferResponse>) => {
    const userId = req.user.id;
    const { tokenSymbol, amount } = req.body;

    console.log(`[transferToTrading] User: ${userId}, Token: ${tokenSymbol}, Amount: ${amount}`);

    if (!tokenSymbol || !amount || amount <= 0) {
        throw new CustomError("Invalid tokenSymbol or amount", 400);
    }

    const transaction = await sequelize.transaction();
    try {
        const [record, created] = await CryptoBalance.findOrCreate({
            where: { userId, tokenSymbol },
            defaults: { availableBalance: 0, reservedBalance: 0 },
            transaction
        });

        console.log(`[transferToTrading] Balance ${created ? 'created' : 'found'}:`, record.toJSON());

        record.availableBalance = parseFloat(record.availableBalance) + parseFloat(amount);
        await record.save({ transaction });

        await transaction.commit();
        console.log(`[transferToTrading] Updated balance:`, record.toJSON());

        res.status(200).json({ message: "Transferred to trading wallet", balance: record });
    } catch (err) {
        await transaction.rollback();
        console.error(`[transferToTrading] Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        throw new CustomError(`Transfer failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 500);
    }
});

const transferToWallet = asyncHandler(async (req: Request<{}, {}, TransferRequest>, res: Response<TransferResponse>) => {
    const userId = req.user.id;
    const { tokenSymbol, amount } = req.body;

    console.log(`[transferToWallet] User: ${userId}, Token: ${tokenSymbol}, Amount: ${amount}`);

    if (!tokenSymbol || !amount || amount <= 0) {
        throw new CustomError("Invalid tokenSymbol or amount", 400);
    }

    const transaction = await sequelize.transaction();
    try {
        const record = await CryptoBalance.findOne({ where: { userId, tokenSymbol }, transaction });

        if (!record) {
            console.warn(`[transferToWallet] Balance not found for ${tokenSymbol}`);
            throw new CustomError("Balance not found", 404);
        }

        if (parseFloat(record.availableBalance) < amount) {
            console.warn(`[transferToWallet] Insufficient: ${record.availableBalance} < ${amount}`);
            throw new CustomError("Insufficient trading balance", 400);
        }

        record.availableBalance -= parseFloat(amount);
        await record.save({ transaction });

        await transaction.commit();
        console.log(`[transferToWallet] Updated balance:`, record.toJSON());

        res.status(200).json({ message: "Transferred back to main wallet", balance: record });
    } catch (err) {
        await transaction.rollback();
        console.error(`[transferToWallet] Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        throw new CustomError(`Transfer failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 500);
    }
});

export {
    getUserBalances,
    transferToTrading,
    transferToWallet
}; 