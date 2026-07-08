import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			retry: 1,
			staleTime: 5 * 60 * 1000,
		},
	},
});

queryClientInstance.setQueryDefaults(['player-stats'], { staleTime: 0 });
queryClientInstance.setQueryDefaults(['userprofile'], { staleTime: 0 });
queryClientInstance.setQueryDefaults(['profile'], { staleTime: 0 });