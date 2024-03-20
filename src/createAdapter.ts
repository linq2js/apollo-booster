/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApolloError,
  DocumentNode,
  ReactiveVar,
  Resolvers,
} from "@apollo/client";
import { Client, Adapter, ReactiveVarDef, ResolverDef, AnyFunc } from "./types";
import {
  EMPTY_OBJECT,
  NOOP,
  RESOLVED,
  createOperationOptions,
  isComputedDef,
  isPromiseLike,
  isQueryDef,
  isReactiveVarDef,
} from "./utils";
import { QueryRef } from "./QueryRef";
import { Modifiers, makeVar } from "@apollo/client/cache";

export type InternalAdapter = Adapter & {
  require(...resolvers: ResolverDef[]): boolean;
  getReactiveVar<T>(reactiveVarDef: ReactiveVarDef<T>): ReactiveVar<T>;
};

type PersistedData = { data?: any; variables?: any };

const adapters = new WeakMap<Client, InternalAdapter>();
const DATA_CHANGED = {};

const stringifyReplacer = (_: string, value: any) => {
  // We sort object properties to ensure that multiple objects with identical properties yield the same stringify results.
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      const props = Object.keys(value);
      return props.map((prop) => [prop, value[prop]]);
    }
  }

  return value;
};

export const createInternalAdapter = (client: Client) => {
  let existingAdapter = adapters.get(client);
  if (existingAdapter) return existingAdapter;
  const registeredResolvers = new Set<ResolverDef>();
  const queryRefByDocumentCache = new WeakMap<
    DocumentNode,
    Map<string, QueryRef<any>>
  >();
  let restoring: Promise<void> | undefined;
  let persistApiInstalled = false;
  let persisted: PersistedData | undefined;
  let write: ((getData: () => unknown) => void) | undefined;
  const cache = client.cache;
  const readCacheData = (): PersistedData | undefined => {
    if (persisted?.data === DATA_CHANGED) {
      return { data: cache.extract(), variables: persisted.variables };
    }
    return persisted;
  };
  const reactiveVars = new Map<ReactiveVarDef<any>, ReactiveVar<any>>();
  const getReactiveVar = <T>(def: ReactiveVarDef<T>) => {
    let reactiveVar = reactiveVars.get(def);
    if (!reactiveVar) {
      const name = def.options.name;
      const initial =
        persisted?.variables && name && name in persisted.variables
          ? persisted.variables[name]
          : def.create(adapter);
      reactiveVar = makeVar(initial);
      reactiveVars.set(def, reactiveVar);
    }
    return reactiveVar;
  };
  const onDataChange = () => {
    persisted = { data: DATA_CHANGED, variables: persisted?.variables };
    write?.(readCacheData);
  };
  const onVariableChange = (name: string, value: any) => {
    persisted = {
      data: persisted?.data,
      variables: { ...persisted?.variables, [name]: value },
    };
    write?.(readCacheData);
  };
  const adapter: InternalAdapter = {
    client,
    ref({ document, variables = {}, fetchPolicy }) {
      let queryRefByKeyCache = queryRefByDocumentCache.get(document);
      if (!queryRefByKeyCache) {
        queryRefByKeyCache = new Map();
        queryRefByDocumentCache.set(document, queryRefByKeyCache);
      }
      const queryKey = `${fetchPolicy}:${JSON.stringify(
        variables,
        stringifyReplacer
      )}`;
      let queryRef = queryRefByKeyCache.get(queryKey);
      if (!queryRef) {
        queryRef = new QueryRef(
          client.watchQuery({ query: document, variables, fetchPolicy })
        );
        queryRefByKeyCache.set(queryKey, queryRef);
      }

      return queryRef;
    },
    async mutate(mutation) {
      const options = createOperationOptions(mutation);
      if (options.require && adapter.require(...options.require)) {
        // wait a little to make sure resolvers added and can start querying
        // await RESOLVED;
      }
      const result = await client.mutate({
        mutation: options.document,
        variables: options.variables,
        fetchPolicy: options.fetchPolicy as any,
      });
      if (result.errors) {
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      return result.data as any;
    },
    async query(query) {
      const options = createOperationOptions(query);
      if (options.require && adapter.require(...options.require)) {
        // wait a little to make sure resolvers added and can start querying
        // await RESOLVED;
      }
      const result = await client.query({
        query: options.document,
        variables: options.variables,
        fetchPolicy: options.fetchPolicy,
      });
      if (result.errors) {
        throw new ApolloError({ graphQLErrors: result.errors });
      }
      return result.data as any;
    },
    call(action, ...args) {
      return action(adapter, ...args);
    },
    require(...resolvers) {
      const resolverMap: Resolvers = {};
      let hasChange = false;
      resolvers.forEach((def) => {
        if (registeredResolvers.has(def)) return;
        hasChange = true;
        registeredResolvers.add(def);
        const resolver = def.create(adapter);
        def.name.forEach((name) => {
          const [type, prop] = name.split(".");
          resolverMap[type] = {
            ...resolverMap[type],
            [prop]: resolver,
          };
        });
      });
      if (hasChange) {
        client.addResolvers(resolverMap);
      }

      return hasChange;
    },
    get(input: unknown) {
      if (isQueryDef(input)) {
        const options = createOperationOptions(input);

        return client.readQuery({
          query: options.document,
          variables: options.variables,
        });
      }

      if (isReactiveVarDef(input)) {
        const reactiveVar = getReactiveVar(input);
        return reactiveVar();
      }
    },
    set(input: unknown, data: any): any {
      if (isQueryDef(input)) {
        const options = createOperationOptions(input);
        const queryOptions = {
          query: options.document,
          variables: options.variables,
        };
        const prev = client.readQuery(queryOptions);
        if (typeof data === "function") {
          if (!prev) return;
          data = data(prev);
        }
        client.writeQuery({ ...queryOptions, data });

        if (!prev) return NOOP;

        return () => {
          client.writeQuery({ ...queryOptions, data: prev });
        };
      }

      if (isReactiveVarDef(input)) {
        const reactiveVar = getReactiveVar(input);
        if (typeof data === "function") {
          const prev = reactiveVar();
          data = data(prev);
        }

        if (data !== reactiveVar()) {
          reactiveVar(data);
          if (input.options.name) {
            onVariableChange(input.options.name, data);
          }
        }
        return;
      }

      const id = cache.identify(input as any);
      if (!id) return NOOP;

      const [prevProps, staticFields, dynamicFields] = buildFields(id, data);

      cache.modify({ id, fields: staticFields });

      if (dynamicFields) {
        cache.modify({ id, fields: dynamicFields });
      }

      // restore function
      return () => {
        cache.modify({
          id,
          fields: buildFields(id, prevProps)[1],
        });
      };
    },
    evict(input) {
      return cache.evict({ id: cache.identify(input) });
    },
    ready(callback?: AnyFunc): any {
      if (!callback) {
        return restoring;
      }

      if (restoring) {
        restoring.then(() => callback(adapter));
      } else {
        callback(adapter);
      }
    },
    persist(options) {
      if (persistApiInstalled) {
        throw new Error("Cannot perform cache persistence multiple times");
      }
      persistApiInstalled = true;

      write = options.write;

      const hookCacheUpdateMethods = () => {
        (["write", "evict", "modify"] as const).forEach((method) => {
          const origin: AnyFunc = cache[method];
          cache[method] = (...args: any[]) => {
            const result = origin.apply(cache, args);
            onDataChange();
            return result;
          };
        });
      };

      if (options.read) {
        const result = options.read();
        const restoreData = (result: PersistedData) => {
          restoring = undefined;
          persisted = result;
          if (persisted?.data) {
            cache.restore(persisted.data);
          }

          if (write) {
            // hook cache methods
            hookCacheUpdateMethods();
          }
        };
        if (isPromiseLike<PersistedData>(result)) {
          restoring = result.then(restoreData);
        } else {
          restoreData(result as PersistedData);
        }
      } else if (write) {
        hookCacheUpdateMethods();
      }

      return restoring ?? RESOLVED;
    },
    getReactiveVar,
  };

  adapters.set(client, adapter);

  return adapter;
};

export const createAdapter = (client: Client) => {
  return createInternalAdapter(client) as Adapter;
};

const NOT_ALLOWED_PROXY_TRAP = () => false;

const buildFields = (id: string, props: Record<string, any>) => {
  const staticModifiers: Modifiers = {};
  const prevProps: Record<string, any> = {};
  let dynamicModifiers: Modifiers | undefined;

  Object.entries(props).forEach(([key, value]) => {
    if (isComputedDef(value)) {
      if (!dynamicModifiers) {
        dynamicModifiers = {};
      }
      dynamicModifiers[key] = (prev, { readField }) => {
        prevProps[key] = prev;
        return value.compute(
          new Proxy(EMPTY_OBJECT, {
            get(_, p) {
              if (typeof p !== "string") return undefined;
              const fieldValue = readField({
                fieldName: p,
                from: { __ref: id },
              });
              return fieldValue;
            },
            set: NOT_ALLOWED_PROXY_TRAP,
            deleteProperty: NOT_ALLOWED_PROXY_TRAP,
          })
        );
      };
      return;
    }
    if (typeof value === "function") {
      if (!dynamicModifiers) {
        dynamicModifiers = {};
      }
      const fn = value;
      dynamicModifiers[key] = (prev, details) => {
        prevProps[key] = prev;
        return fn(prev, details);
      };
      return;
    }

    staticModifiers[key] = (prev) => {
      prevProps[key] = prev;
      return value;
    };
  });

  return [prevProps, staticModifiers, dynamicModifiers] as const;
};