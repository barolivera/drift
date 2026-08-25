import { useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { api, type RequestOptions } from '@/lib/api';

/** Returns an `api` function that automatically attaches the Privy access token. */
export function useApi() {
  const { getAccessToken, authenticated } = usePrivy();

  return useCallback(
    async <T,>(path: string, opts: RequestOptions = {}) => {
      const token = authenticated ? await getAccessToken() : null;
      return api<T>(path, { ...opts, token });
    },
    [getAccessToken, authenticated],
  );
}
