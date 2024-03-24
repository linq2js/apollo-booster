import {
  ApolloClient,
  DocumentNode,
  FetchPolicy,
  Reference,
  Resolver,
  StoreObject,
  TypedDocumentNode,
  WatchQueryFetchPolicy,
} from "@apollo/client";
import { Modifier } from "@apollo/client/cache";
import {
  FRAGMENT_DEF_TYPE,
  MUTATION_DEF_TYPE,
  QUERY_DEF_TYPE,
  REACTIVE_VAR_DEF_TYPE,
  RESOLVER_DEF_TYPE,
} from "./utils";

/**
 * Empty object
 */
export type EO = {};

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyFunc = (...args: any[]) => any;

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Equal<T = any> = (a: T, b: T) => boolean;

export type Client = ApolloClient<any>;

export type QueryDefConfigs<TData extends EO> = {
  key?: string;
  variables?: object;
  tags?: string[];
  require?: ResolverDef[];
  document: TypedDocumentNode<TData, any>;
  /**
   * This method for QueryDef only.
   * This method is activated when the adapter initiates an operation to retrieve more data.
   * @param prev
   * @param incoming
   * @returns
   */
  merge?: (prev: TData, incoming: TData) => TData;
};

export type FragmentDefConfigs = {
  key?: string;
  /**
   * name of fragment
   */
  name?: string;
  fallback?: QueryDef<any, EO>;
} & ({ id: any; type?: string } | { from: string });

export type MutationDefConfigs<TData extends EO> = {
  key?: string;
  variables?: object;
  require?: ResolverDef[];
  document: TypedDocumentNode<TData, any>;
};

export type FragmentDef<TData extends EO, TVariables extends EO> = {
  type: typeof FRAGMENT_DEF_TYPE;
  fragment: TypedDocumentNode<TData, TVariables>;
  create: ConfigsBuilder<TVariables, FragmentDefConfigs>;
};

export type QueryDef<TData extends EO, TVariables extends EO> = {
  type: typeof QUERY_DEF_TYPE;
  create: ConfigsBuilder<TVariables, QueryDefConfigs<TData>>;
};

export type MutationDef<TData extends EO, TVariables extends EO> = {
  type: typeof MUTATION_DEF_TYPE;
  create: ConfigsBuilder<TVariables, MutationDefConfigs<TData>>;
};

export type ConfigsBuilder<TVariables extends EO, TConfigs> = (
  variables: TVariables
) => TConfigs;

export type OptionsWithVariablesArgs<
  TVariables,
  TOptions extends EO
> = EO extends TVariables
  ? [options?: TOptions & { variables?: TVariables }]
  : [options: { variables: TVariables } & TOptions];

export type ResolverDef = {
  type: typeof RESOLVER_DEF_TYPE;
  name: string[];
  create: (adapter: Adapter) => Resolver;
};

export type ComputedDef<T, R> = ResolverDef & {
  compute(value: T): R;
};

export type ReactiveOptions = {
  name?: string;
  computed?: boolean;
};

export type ReactiveVarDef<T> = {
  readonly type: typeof REACTIVE_VAR_DEF_TYPE;
  create: (
    get: <R>(reactiveVar: ReactiveVarDef<R>) => R,
    adapter: Adapter
  ) => T;
  readonly options: ReactiveOptions;
};

export type QueryRefOptions = {
  key?: string;
  document: DocumentNode;
  variables?: EO;
  tags?: string[];
  fetchPolicy?: WatchQueryFetchPolicy;
};

export type OperationOptions = {
  fetchPolicy?: FetchPolicy;
  variables?: EO;
};

export type PersistOptions = {
  /**
   * This method is triggered during the initiation of the cache restoration process, specifically for reading persisted data from the data source.
   */
  read?(): Promise<unknown> | unknown;

  /**
   * This method will be invoked to write data to storage.
   * @param getData Retrieve current data
   */
  write?(getData: () => unknown): void;
};

export type Adapter = {
  readonly client: Client;

  /**
   * execute query
   * @param query
   */
  query<TData extends EO>(query: QueryDef<TData, EO>): Promise<TData>;

  /**
   * execute mutation
   * @param mutation
   */
  mutate<TData extends EO>(mutation: MutationDef<TData, EO>): Promise<TData>;

  /**
   * Invoke the specified action, passing the current adapter as the first argument.
   * @param action
   * @param args
   */
  call<TResult, TArgs extends readonly any[]>(
    action: (adapter: Adapter, ...args: TArgs) => TResult,
    ...args: TArgs
  ): TResult;

  /**
   * Return value of specified reactive variable
   * @param reactiveVar
   */
  get<TData>(reactiveVar: ReactiveVarDef<TData>): TData;

  /**
   * Return cached data of specified query
   * @param query
   */
  get<TData extends EO>(query: QueryDef<TData, EO>): TData | undefined;

  /**
   *
   * @param query
   * @param valueOrReducer
   */
  set<TData extends EO>(
    query: QueryDef<TData, EO>,
    valueOrReducer: TData | ((prev: TData) => TData)
  ): TData;

  /**
   * @param reactiveVar
   * @param valueOrReducer
   */
  set<TData>(
    reactiveVar: ReactiveVarDef<TData>,
    valueOrReducer: TData | ((prev: TData) => TData)
  ): TData;

  /**
   * Update object properties; all related queries containing the object will be updated accordingly.
   * @param entity
   * @param data These might be new or partial properties of the object. Modifiers can be passed for each property, which retrieve the old value of the property and return a new value.
   */
  set<T extends EO>(
    entity: T,
    data: {
      [key in keyof T]?: ComputedDef<T, T[key]> | T[key] | Modifier<T[key]>;
    }
  ): VoidFunction;

  /**
   * Evict a single object from the client cache; all related queries containing the object will be updated accordingly.
   * @param storedObject
   */
  evict(storedObject: StoreObject | Reference): boolean;

  persist(options: PersistOptions): Promise<void>;

  /**
   * If the client cache is being restored, this will return a promise that resolves upon completion of the restoration process. If not, it returns undefined.
   */
  restoring(): Promise<void> | undefined;

  /**
   * The callback will be invoked upon completion of the restoration process. If there is nothing to restore, the callback will be invoked immediately.
   * @param callback
   */
  ready(callback: (adapter: Adapter) => void): void;

  refetch<TData extends EO>(
    query: QueryDef<TData, EO>,
    hardRefetch?: boolean
  ): Promise<void>;

  refetch(queryTag: string, hardRefetch?: boolean): Promise<void>;

  refetch(queryTags: string[], hardRefetch?: boolean): Promise<void>;

  refetch(
    queryTagFilter: (tag: string) => boolean,
    hardRefetch?: boolean
  ): Promise<void>;

  /**
   * Retrieve additional data and utilize the query's merge method to integrate the previously acquired data with the newly obtained data.
   * For implementing pagination, incorporate the `@connection` directive into the query. This approach addresses the issue of duplicate field entries in the cache.
   * For more details, refer to the Apollo GraphQL documentation on advanced caching topics, specifically the section on the `@connection` directive.
   * https://www.apollographql.com/docs/react/caching/advanced-topics/#the-connection-directive
   * @param query
   */
  fetchMore<TData extends EO>(query: QueryDef<TData, EO>): Promise<TData>;

  /**
   * Monitor changes from queries and reactive variables.
   * @param def
   * @param callback
   */
  watch<
    T extends
      | QueryDef<any, EO>
      | ReactiveVarDef<any>
      | readonly (QueryDef<any, EO> | ReactiveVarDef<any>)[]
  >(
    def: T,
    callback: (
      data: T extends ReactiveVarDef<infer D>
        ? D
        : T extends QueryDef<infer D, EO>
        ? D
        : any
    ) => void
  ): VoidFunction;
};

export type Loadable<TData> = {
  readonly loading: boolean;
  readonly data?: TData;
  readonly error?: unknown;
};

export type AdapterFn = {
  (client: Client): Adapter;
};
