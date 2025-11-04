import type {
  DefaultError,
  QueryKey,
  UseQueryOptions,
  UseMutationOptions,
} from "@tanstack/react-query";

// Base types for query and mutation options
export type QueryOptions<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'queryKey'> & {
  queryKey: TQueryKey;
};

export type MutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
> = UseMutationOptions<TData, TError, TVariables, TContext>;

// Query key factory types
export type QueryKeyFactory = {
  all: () => readonly string[];
  [key: string]: (...args: any[]) => readonly string[];
};

// Common mutation response type
export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
  violations?: any[];
};

// Optimistic update options
export type OptimisticUpdateOptions = {
  optimisticUpdate?: boolean;
  revalidate?: boolean;
};