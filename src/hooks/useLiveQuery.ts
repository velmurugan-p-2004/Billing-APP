import { useEffect, useState } from 'react';

/**
 * Custom hook to subscribe to Dexie live queries
 * This is a lightweight alternative to dexie-react-hooks
 */
export function useLiveQuery<T>(
    querier: () => Promise<T> | T,
    deps: any[] = []
): T | undefined {
    const [result, setResult] = useState<T | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;

        const runQuery = async () => {
            try {
                const data = await querier();
                if (!cancelled) {
                    setResult(data);
                }
            } catch (error) {
                console.error('useLiveQuery error:', error);
            }
        };

        runQuery();

        // Poll for changes every 500ms (simple approach)
        const interval = setInterval(runQuery, 500);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, deps);

    return result;
}
