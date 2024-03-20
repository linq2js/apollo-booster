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
import { type QueryRef } from "./QueryRef";
import { Modifier } from "@apollo/client/cache";
import {
  MUTATION_DEF_TYPE,
  QUERY_DEF_TYPE,
  REACTIVE_VAR_DEF_TYPE,
  RESOLVER_DEF_TYPE,
} from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyFunc = (...args: any[]) => any;

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Equal<T = any> = (a: T, b: T) => boolean;

export type Client = ApolloClient<any>;

export type QueryDef<TData extends object, TVariables extends object> = {
  type: typeof QUERY_DEF_TYPE;
  create: OptionsBuilder<TData, TVariables>;
};

export type OptionsBuilder<TData extends object, TVariables extends object> = (
  variables: TVariables
) => {
  variables?: object;
  require?: ResolverDef[];
  document: TypedDocumentNode<TData, unknown>;
};

export type OptionsWithVariablesArgs<
  TVariables,
  TOptions extends object
> = object extends TVariables
  ? [options?: TOptions]
  : [options: { variables: TVariables } & TOptions];

export type MutationDef<TData extends object, TVariables extends object> = {
  type: typeof MUTATION_DEF_TYPE;
  create: OptionsBuilder<TData, TVariables>;
};

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
};

export type ReactiveVarDef<T> = {
  type: typeof REACTIVE_VAR_DEF_TYPE;
  create: (adapter: Adapter) => T;
  options: ReactiveOptions;
};

export type QueryRefOptions = {
  document: DocumentNode;
  variables?: object;
  fetchPolicy?: WatchQueryFetchPolicy;
};

export type OperationOptions = {
  fetchPolicy?: FetchPolicy;
  variables?: object;
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
  query<TData extends object>(query: QueryDef<TData, object>): Promise<TData>;

  /**
   * execute mutation
   * @param mutation
   */
  mutate<TData extends object>(
    mutation: MutationDef<TData, object>
  ): Promise<TData>;

  /**
   * Invoke the specified action, passing the current adapter as the first argument.
   * @param action
   * @param args
   */
  call<TResult, TArgs extends readonly any[]>(
    action: (adapter: Adapter, ...args: TArgs) => TResult,
    ...args: TArgs
  ): TResult;

  ref<T>(options: QueryRefOptions): QueryRef<T>;

  /**
   * Return value of specified reactive variable
   * @param reactiveVar
   */
  get<TData>(reactiveVar: ReactiveVarDef<TData>): TData;

  /**
   * Return cached data of specified query
   * @param query
   */
  get<TData extends object>(query: QueryDef<TData, object>): TData | undefined;

  /**
   *
   * @param query
   * @param valueOrReducer
   */
  set<TData extends object>(
    query: QueryDef<TData, object>,
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
  set<T extends object>(
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
  ready(): Promise<void> | undefined;

  /**
   * The callback will be invoked upon completion of the restoration process. If there is nothing to restore, the callback will be invoked immediately.
   * @param callback
   */
  ready(callback: (adapter: Adapter) => void): void;
};

export type Loadable<TData> = {
  readonly loading: boolean;
  readonly data?: TData;
  readonly error?: unknown;
};

export type AdapterFn = {
  (client: Client): Adapter;
};
