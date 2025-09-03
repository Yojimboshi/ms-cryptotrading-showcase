type TimeInterval = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1W';

interface PriceCandleConfig {
    priceCandleHistoricalDataLimit: Record<TimeInterval, number>;
}

const config: PriceCandleConfig = {
    priceCandleHistoricalDataLimit: {
        '1m': 500,   // Last 500 minutes (~8.3 hours)
        '5m': 500,   // Last 500 * 5 minutes (~41.6 hours)
        '15m': 500,  // Last 500 * 15 minutes (~12.5 days)
        '30m': 500,  // Last 500 * 30 minutes (~21 days)
        '1H': 500,   // Last 500 hours (~20.8 days)
        '4H': 500,   // Last 500 * 4 hours (~83 days)
        '1D': 500,   // Last 500 days (~1.37 years)
        '1W': 250    // Last 500 weeks (~9.6 years)
    }
};

export default config; 