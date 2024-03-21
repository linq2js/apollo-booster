import { FetchPolicy, TypedDocumentNode } from "@apollo/client";
import { DocumentNode } from "graphql";
import {
  OperationOptions,
  OptionsBuilder,
  OptionsWithVariablesArgs,
  MutationDef,
  QueryDef,
} from "./types";
import { MUTATION_DEF_TYPE, QUERY_DEF_TYPE } from "./utils";

type OperationUtils<TVariables extends object, TDefinition> = {
  with(
    ...args: OptionsWithVariablesArgs<TVariables, { fetchPolicy?: FetchPolicy }>
  ): TDefinition & { options: OperationOptions };
};

export type CreateQueryDefFn = {
  <TData extends object = object, TVariables extends object = object>(
    document: TypedDocumentNode<TData, TVariables>
  ): QueryDef<TData, TVariables> &
    OperationUtils<TVariables, QueryDef<TData, object>>;

  <TData extends object = object, TVariables extends object = object>(
    document: DocumentNode
  ): QueryDef<TData, TVariables> &
    OperationUtils<TVariables, QueryDef<TVariables, object>>;

  <TData extends object = object, TVariables extends object = object>(
    create: OptionsBuilder<TData, TVariables>
  ): QueryDef<TData, TVariables> &
    OperationUtils<TVariables, QueryDef<TData, object>>;
};

export type CreateMutationDefFn = {
  <TData extends object = object, TVariables extends object = object>(
    document: TypedDocumentNode<TData, TVariables>
  ): MutationDef<TData, TVariables> &
    OperationUtils<TVariables, MutationDef<TData, object>>;

  <TData extends object = object, TVariables extends object = object>(
    document: DocumentNode
  ): MutationDef<TData, TVariables> &
    OperationUtils<TVariables, MutationDef<TData, object>>;

  <TData extends object = object, TVariables extends object = object>(
    create: OptionsBuilder<TData, TVariables>
  ): MutationDef<TData, TVariables> &
    OperationUtils<TVariables, MutationDef<TData, object>>;
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
