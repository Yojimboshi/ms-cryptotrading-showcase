import marketPairs from '../../shared/marketPairs.json';

interface MarketPair {
    baseAsset: string;
    quoteAsset: string;
}

const getDefaultTokenSymbols = (): string[] => {
    const tokenSet = new Set<string>();
    for (const pair of marketPairs as MarketPair[]) {
        tokenSet.add(pair.baseAsset.toUpperCase());
        tokenSet.add(pair.quoteAsset.toUpperCase());
    }
    return Array.from(tokenSet);
};

export { getDefaultTokenSymbols }; 