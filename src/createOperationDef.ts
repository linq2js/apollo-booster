import { FetchPolicy, TypedDocumentNode } from "@apollo/client";
import { DocumentNode } from "graphql";
import {
  OperationOptions,
  OptionsBuilder,
  OptionsWithVariablesArgs,
  MutationDef,
  QueryDef,
  EO,
} from "./types";
import { MUTATION_DEF_TYPE, QUERY_DEF_TYPE } from "./utils";

type OperationUtils<TVariables extends EO, TDefinition> = {
  with(
    ...args: OptionsWithVariablesArgs<TVariables, { fetchPolicy?: FetchPolicy }>
  ): TDefinition & { options: OperationOptions };
};

export type CreateQueryDefFn = {
  <TData extends EO = EO, TVariables extends EO = EO>(
    document: TypedDocumentNode<TData, TVariables>
  ): QueryDef<TData, TVariables> &
    OperationUtils<TVariables, QueryDef<TData, EO>>;

  <TData extends EO = EO, TVariables extends EO = EO>(
    document: DocumentNode
  ): QueryDef<TData, TVariables> &
    OperationUtils<TVariables, QueryDef<TVariables, EO>>;

  <TData extends EO = EO, TVariables extends EO = EO>(
    create: OptionsBuilder<TData, TVariables>
  ): QueryDef<TData, TVariables> &
    OperationUtils<TVariables, QueryDef<TData, EO>>;
};

export type CreateMutationDefFn = {
  <TData extends EO = EO, TVariables extends EO = EO>(
    document: TypedDocumentNode<TData, TVariables>
  ): MutationDef<TData, TVariables> &
    OperationUtils<TVariables, MutationDef<TData, EO>>;

  <TData extends EO = EO, TVariables extends EO = EO>(
    document: DocumentNode
  ): MutationDef<TData, TVariables> &
    OperationUtils<TVariables, MutationDef<TData, EO>>;

  <TData extends EO = EO, TVariables extends EO = EO>(
    create: OptionsBuilder<TData, TVariables>
  ): MutationDef<TData, TVariables> &
    OperationUtils<TVariables, MutationDef<TData, EO>>;
};

const createOperationDefInternal = <const TType extends symbol>(
  type: TType,
  create: OptionsBuilder<any, any>
) => {
  const createWrapper = (variables: any = {}) => {
    return create(variables);
  };

  return {
    type,
    document,
    create: createWrapper,
    with(options?: any) {
      return {
        type,
        document,
        create: createWrapper,
        options,
      };
    },
  };
};

export const createMutationDef: CreateMutationDefFn = (input) => {
  if (typeof input === "function") {
    return createOperationDefInternal(MUTATION_DEF_TYPE, input);
  }

  const document = input;
  return createOperationDefInternal(
    MUTATION_DEF_TYPE,
    () => ({ document } as any)
  );
};

export const createQueryDef: CreateQueryDefFn = (input) => {
  if (typeof input === "function") {
    return createOperationDefInternal(QUERY_DEF_TYPE, input);
  }

  const document = input;
  return createOperationDefInternal(
    QUERY_DEF_TYPE,
    () => ({ document } as any)
  );
};
