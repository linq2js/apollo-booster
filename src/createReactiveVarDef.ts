import { AnyFunc, ReactiveVarDef, ReactiveOptions } from "./types";
import { REACTIVE_VAR_DEF_TYPE } from "./utils";

export type CreateReactiveVariableDefFn = {
  <T>(
    initial: T | ((get: <R>(reactiveVar: ReactiveVarDef<R>) => R) => T),
    options?: ReactiveOptions
  ): ReactiveVarDef<T>;
};

export const createReactiveVarDef: CreateReactiveVariableDefFn = (
  initial,
  options = {}
) => {
  if (typeof initial === "function") {
    const createFn = initial as AnyFunc;
    return {
      type: REACTIVE_VAR_DEF_TYPE,
      options,
      computed: true,
      create: createFn,
    };
  }

  return {
    type: REACTIVE_VAR_DEF_TYPE,
    options,
    computed: false,
    create() {
      return initial;
    },
  };
};
