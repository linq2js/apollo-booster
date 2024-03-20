import { Resolver } from "@apollo/client";
import { ComputedDef, Adapter, ResolverDef } from "./types";
import { RESOLVER_DEF_TYPE } from "./utils";

export type CreateResolverDefFn = {
  (
    name: string | string[],
    create: (adapter: Adapter) => Resolver
  ): ResolverDef;
};

export type CreateComputedFn = {
  <T, R>(name: string | string[], compute: (obj: T) => R): ComputedDef<T, R>;
};

export const createResolverDef: CreateResolverDefFn = (name, create) => {
  return {
    type: RESOLVER_DEF_TYPE,
    name: Array.isArray(name) ? name : [name],
    create,
  };
};

export const createComputed: CreateComputedFn = (name, compute) => {
  return {
    type: RESOLVER_DEF_TYPE,
    name: Array.isArray(name) ? name : [name],
    create() {
      return compute;
    },
    compute,
  };
};
