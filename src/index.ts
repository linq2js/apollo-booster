export { createAdapter as from } from "./createAdapter";
export {
  createQueryDef as query,
  createMutationDef as mutation,
} from "./createOperationDef";

export { createReactiveVarDef as reactive } from "./createReactiveVarDef";

export {
  createResolverDef as resolver,
  createComputed as computed,
} from "./createResolverDef";

export { useAdapter as useGQL } from "./useAdapter";

export * from "./typed";
