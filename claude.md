# GolfSync Development Standards

## Data Fetching and Mutations

### ✅ REQUIRED: TanStack Query (React Query)

**ALL data fetching and mutations MUST use TanStack Query.** This is a strict requirement for consistency, performance, and maintainability.

### Why TanStack Query?

1. **Automatic caching** - Reduces unnecessary network requests
2. **Built-in loading/error states** - Consistent UX across the app
3. **Request deduplication** - Multiple components requesting same data only make one request
4. **Automatic refetching** - Fresh data when users return to the app
5. **Optimistic updates** - Better UX for mutations
6. **Background refetching** - Keep data fresh without user intervention
7. **Cache invalidation** - Automatic updates across related queries

### Architecture Pattern

```
src/
├── server/
│   ├── query-options/          # Query configuration (REQUIRED)
│   │   ├── query-keys.ts       # Centralized query keys
│   │   ├── types.ts            # Shared types
│   │   ├── [feature]-query-options.ts
│   │   └── [feature]-mutation-options.ts
│   └── [feature]/
│       └── actions.ts          # Server actions (data layer)
├── hooks/                      # React hooks (OPTIONAL - for complex logic)
│   └── use[Feature]Query.ts
└── components/
    └── [feature]/
        └── [Component].tsx     # Use queries directly in components
```

## Data Fetching Guidelines

### 1. Query Options Pattern

**Location:** `src/server/query-options/[feature]-query-options.ts`

All queries must be defined as query options following this pattern:

```typescript
import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import { getFeatureData } from "~/server/feature/actions";

export const featureQueryOptions = {
  // Simple query
  all: () =>
    queryOptions({
      queryKey: queryKeys.feature.all(),
      queryFn: async () => {
        const result = await getFeatureData();
        if (!result.success) {
          throw new Error(result.error || "Failed to load data");
        }
        return result.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    }),

  // Parameterized query
  byId: (id: number) =>
    queryOptions({
      queryKey: queryKeys.feature.byId(id),
      queryFn: async () => {
        const result = await getFeatureById(id);
        if (!result.success) {
          throw new Error(result.error || "Failed to load data");
        }
        return result.data;
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),
};
```

### 2. Query Keys Pattern

**Location:** `src/server/query-options/query-keys.ts`

All query keys must be registered in the centralized query keys file:

```typescript
export const queryKeys = {
  feature: {
    all: () => ['feature'] as const,
    byId: (id: number) => ['feature', 'byId', id] as const,
    search: (query: string) => ['feature', 'search', query] as const,
  },
} as const;
```

**Benefits:**
- Type-safe query keys
- Easy to find all queries for a feature
- Consistent structure across the app
- Prevents query key conflicts

### 3. Using Queries in Components

**Simple usage (preferred):**

```typescript
import { useQuery } from "@tanstack/react-query";
import { featureQueryOptions } from "~/server/query-options/feature-query-options";

export function MyComponent() {
  const { data, isLoading, error } = useQuery(featureQueryOptions.all());

  if (isLoading) return <LoadingSpinner />;
  if (error || !data) return <ErrorMessage />;

  return <div>{data.title}</div>;
}
```

**With parameters:**

```typescript
export function MyComponent({ id }: { id: number }) {
  const { data, isLoading, error } = useQuery(featureQueryOptions.byId(id));
  // ... rest of component
}
```

**Complex usage (custom hook):**

If you need to combine multiple queries or add complex logic, create a custom hook:

```typescript
// src/hooks/useFeature.ts
import { useQuery } from "@tanstack/react-query";
import { featureQueryOptions } from "~/server/query-options/feature-query-options";

export function useFeature(id: number) {
  const query = useQuery(featureQueryOptions.byId(id));

  // Add complex derived state
  const processedData = query.data ? processData(query.data) : null;

  return {
    ...query,
    processedData,
  };
}
```

### 4. Stale Time Guidelines

Configure `staleTime` based on data freshness requirements:

- **Real-time data** (teesheet, bookings): `2-5 minutes`
- **Frequently updated** (weather, notifications): `10-20 minutes`
- **Rarely changes** (settings, configs): `30-60 minutes`
- **Static data** (templates, options): `Infinity`

```typescript
queryOptions({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000,   // 10 minutes (cleanup cache)
})
```

## Mutation Guidelines

### 1. Mutation Options Pattern

**Location:** `src/server/query-options/[feature]-mutation-options.ts`

```typescript
import { queryClient } from "~/lib/query-client";
import { queryKeys } from "./query-keys";
import { updateFeature } from "~/server/feature/actions";

export const featureMutations = {
  update: {
    mutationFn: async (data: UpdateData) => {
      const result = await updateFeature(data);
      if (!result.success) {
        throw new Error(result.error || "Failed to update");
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.feature.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to update:", error);
      // Show error toast
    },
  },
};
```

### 2. Using Mutations in Components

```typescript
import { useMutation } from "@tanstack/react-query";
import { featureMutations } from "~/server/query-options/feature-mutation-options";

export function MyComponent() {
  const updateMutation = useMutation(featureMutations.update);

  const handleUpdate = () => {
    updateMutation.mutate(
      { id: 1, name: "New Name" },
      {
        onSuccess: () => {
          toast.success("Updated successfully!");
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  return (
    <button onClick={handleUpdate} disabled={updateMutation.isPending}>
      {updateMutation.isPending ? "Updating..." : "Update"}
    </button>
  );
}
```

### 3. Optimistic Updates

For better UX, use optimistic updates for mutations:

```typescript
export const featureMutations = {
  update: {
    mutationFn: updateFeature,
    onMutate: async (newData) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: queryKeys.feature.all() });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(queryKeys.feature.all());

      // Optimistically update cache
      queryClient.setQueryData(queryKeys.feature.all(), (old) => {
        return old?.map(item =>
          item.id === newData.id ? { ...item, ...newData } : item
        );
      });

      return { previousData };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(
        queryKeys.feature.all(),
        context?.previousData
      );
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.feature.all() });
    },
  },
};
```

## Cache Invalidation

Always invalidate related queries after mutations:

```typescript
// Invalidate all feature queries
queryClient.invalidateQueries({ queryKey: queryKeys.feature.all() });

// Invalidate specific query
queryClient.invalidateQueries({ queryKey: queryKeys.feature.byId(id) });

// Invalidate multiple related queries
queryClient.invalidateQueries({ queryKey: queryKeys.feature.all() });
queryClient.invalidateQueries({ queryKey: queryKeys.relatedFeature.all() });
```

## Examples from Codebase

### ✅ Good Example: Teesheet Data

**Query Options:** `src/server/query-options/teesheet-query-options.ts`
```typescript
export const teesheetQueryOptions = {
  byDate: (date: string) =>
    queryOptions({
      queryKey: queryKeys.teesheets.byDate(date),
      queryFn: async () => {
        const result = await getTeesheetDataAction(date);
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to load teesheet data");
        }
        return result.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 5 * 60 * 1000, // 5 minutes
    }),
};
```

**Usage:** `src/hooks/useTeesheetQuery.ts`
```typescript
export function useTeesheetQuery(date: string) {
  return useQuery(teesheetQueryOptions.byDate(date));
}
```

### ✅ Good Example: Weather Data

**Query Options:** `src/server/query-options/weather-query-options.ts`
```typescript
export const weatherQueryOptions = {
  current: () =>
    queryOptions({
      queryKey: queryKeys.weather.current(),
      queryFn: async () => {
        const result = await getWeatherData();
        if (!result.success) {
          throw new Error(result.error || "Failed to load weather data");
        }
        return result.data;
      },
      staleTime: 20 * 60 * 1000, // 20 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: true,
    }),
};
```

**Usage:** `src/components/weather/WeatherDisplay.tsx`
```typescript
export function WeatherDisplay() {
  const { data, isLoading, error } = useQuery(weatherQueryOptions.current());
  // ... component logic
}
```

### ❌ Bad Example: Manual useEffect + fetch

**DON'T DO THIS:**
```typescript
// ❌ Manual data fetching with useEffect
export function BadComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const result = await getData();
      setData(result.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  // This misses caching, deduplication, error handling, etc.
}
```

**DO THIS INSTEAD:**
```typescript
// ✅ Use TanStack Query
export function GoodComponent() {
  const { data, isLoading } = useQuery(dataQueryOptions.all());
  // Automatic caching, deduplication, error handling!
}
```

## Global Query Configuration

**Location:** `src/lib/query-client.ts`

The QueryClient is configured with sensible defaults:

```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes default
      gcTime: 10 * 60 * 1000, // 10 minutes default
      refetchOnWindowFocus: false, // Override per query if needed
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1, // Retry mutations once
    },
  },
});
```

## Resources

- **TanStack Query Docs:** https://tanstack.com/query/latest/docs/react/overview
- **Query Options Pattern:** https://tkdodo.eu/blog/effective-react-query-keys#use-query-options
- **Optimistic Updates:** https://tanstack.com/query/latest/docs/react/guides/optimistic-updates

---

**Last Updated:** 2025-10-30
**Applies to:** All new features and refactoring work
**Questions?** Reference existing implementations in `src/server/query-options/` and `src/hooks/`
