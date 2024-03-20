import { AnyFunc, Adapter, ReactiveVarDef, ReactiveOptions } from "./types";
import { REACTIVE_VAR_DEF_TYPE } from "./utils";

export type CreateReactiveVariableDefFn = {
  <T>(
    initial: T | ((adapter: Adapter) => T),
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
      create: createFn,
    };
  }

  return {
    type: REACTIVE_VAR_DEF_TYPE,
    options,
    create() {
      return initial;
    },
  };
};
