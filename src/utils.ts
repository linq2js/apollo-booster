import {
  ComputedDef,
  EO,
  FragmentDef,
  MutationDef,
  QueryDef,
  ReactiveVarDef,
  ResolverDef,
} from "./types";

export const QUERY_DEF_TYPE = Symbol("queryDef");
export const FRAGMENT_DEF_TYPE = Symbol("fragmentDef");
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

export const isFragmentDef = <D extends EO, V extends EO>(
  value: unknown
): value is FragmentDef<D, V> => {
  return isType(value, FRAGMENT_DEF_TYPE);
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

let uniqueId = 1;
let uniqueIdCache = new WeakMap();
export const getObjectId = (value: object) => {
  if (!value) {
    throw new Error("Value must be object type");
  }
  let id = uniqueIdCache.get(value);
  if (!id) {
    id = uniqueId++;
    uniqueIdCache.set(value, id);
  }

  return id;
};
