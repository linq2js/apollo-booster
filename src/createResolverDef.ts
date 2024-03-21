import { Resolver } from "@apollo/client";
import { Adapter, ComputedDef, ResolverDef } from "./types";
import { RESOLVER_DEF_TYPE } from "./utils";

export const createResolverDef = Object.assign(
  (
    name: string | string[],
    create: (adapter: Adapter) => Resolver
  ): ResolverDef => {
    return {
      type: RESOLVER_DEF_TYPE,
      name: Array.isArray(name) ? name : [name],
      create,
    };
  },
  {
    computed: <T, R>(
      name: string,
      compute: (obj: T) => R
    ): ComputedDef<T, R> => {
      return {
        type: RESOLVER_DEF_TYPE,
        name: Array.isArray(name) ? name : [name],
        create() {
          return compute;
        },
        compute,
      };
    },
  }
);
