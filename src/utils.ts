import { DocumentNode } from "graphql";
import {
  ComputedDef,
  EO,
  MutationDef,
  OperationOptions,
  QueryDef,
  ReactiveVarDef,
  ResolverDef,
} from "./types";

export const QUERY_DEF_TYPE = Symbol("queryDef");
export const RESOLVER_DEF_TYPE = Symbol("resolverDef");
export const MUTATION_DEF_TYPE = Symbol("mutationDef");
export const REACTIVE_VAR_DEF_TYPE = Symbol("reactiveVarDef");

export const NOOP = () => {
  //
};

export const EMPTY_OBJECT: EO = Object.seal(Object.freeze({}));

export const RESOLVED = Promise.resolve();

export const NOT_EQUAL = () => false;

export const STRICT_EQUAL = Object.is;

export const isType = (value: unknown, type: symbol) => {
  return isObject(value) && "type" in value && value.type === type;
};

export const isQueryDef = <D extends EO, V extends EO>(
  value: unknown
): value is QueryDef<D, V> => {
  return isType(value, QUERY_DEF_TYPE);
};

export const isReactiveVarDef = <T>(
  value: unknown
): value is ReactiveVarDef<T> => {
  return isType(value, REACTIVE_VAR_DEF_TYPE);
};

export const isMutationDef = <D extends EO, V extends EO>(
  value: unknown
): value is MutationDef<D, V> => {
  return isType(value, MUTATION_DEF_TYPE);
};

export const isResolverDef = (value: unknown): value is ResolverDef => {
  return isType(value, RESOLVER_DEF_TYPE);
};

export const isComputedDef = <T extends EO, R>(
  value: unknown
): value is ComputedDef<T, R> => {
  return (
    isResolverDef(value) &&
    "compute" in value &&
    typeof value.compute === "function"
  );
};

export const isObject = (value: unknown): value is object => {
  return !!(typeof value === "object" && value);
};

export const enqueue = Promise.resolve().then.bind(Promise.resolve());

export const isPromiseLike = <T>(value: unknown): value is Promise<T> => {
  return isObject(value) && "then" in value && typeof value.then === "function";
};

export const isPlainObject = (
  value: unknown
): value is Record<string | symbol, unknown> => {
  if (typeof value !== "object" || value === null) {
    return false; // Not an object or is null
  }

  const proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return true; // `Object.create(null)` case
  }

  let baseProto = proto;
  while (Object.getPrototypeOf(baseProto) !== null) {
    baseProto = Object.getPrototypeOf(baseProto);
  }

  return proto === baseProto;
};

export const createOperationOptions = <TData extends EO>(
  operation: QueryDef<TData, EO> | MutationDef<TData, EO>
): OperationOptions & { document: DocumentNode; require?: ResolverDef[] } => {
  const options =
    "options" in operation
      ? (operation.options as OperationOptions | undefined)
      : undefined;
  return {
    fetchPolicy: options?.fetchPolicy,
    ...operation.create((options?.variables as any) ?? EMPTY_OBJECT),
    ...options,
  };
};

export const delay = (ms = 0) => {
  let timeoutId: any;
  return Object.assign(
    new Promise<void>((resolve) => {
      timeoutId = setTimeout(resolve, ms, true);
    }),
    {
      cancel() {
        clearTimeout(timeoutId);
      },
    }
  );
};
