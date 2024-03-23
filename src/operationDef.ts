import { FetchPolicy, TypedDocumentNode } from "@apollo/client";
import {
  DocumentNode,
  FragmentDefinitionNode,
  Kind,
  OperationTypeNode,
  print,
} from "graphql";
import {
  OperationOptions,
  OptionsWithVariablesArgs,
  MutationDef,
  QueryDef,
  EO,
  FragmentDef,
  ConfigsBuilder,
  QueryDefConfigs,
  MutationDefConfigs,
  FragmentDefConfigs,
} from "./types";
import {
  EMPTY_OBJECT,
  FRAGMENT_DEF_TYPE,
  MUTATION_DEF_TYPE,
  QUERY_DEF_TYPE,
} from "./utils";
import { NestedMap } from "./NestedMap";

type With<TVariables extends EO, TDefinition> = {
  with(
    ...args: OptionsWithVariablesArgs<TVariables, { fetchPolicy?: FetchPolicy }>
  ): TDefinition & { options: OperationOptions };
};

export type CreateQueryDefFn = {
  <TData extends EO = EO, TVariables extends EO = EO>(
    document: TypedDocumentNode<TData, TVariables>
  ): QueryDef<TData, TVariables> & With<TVariables, QueryDef<TData, EO>>;

  <TData extends EO = EO, TVariables extends EO = EO>(
    create: ConfigsBuilder<TVariables, QueryDefConfigs<TData>>
  ): QueryDef<TData, TVariables> & With<TVariables, QueryDef<TData, EO>>;
};

export type CreateMutationDefFn = {
  <TData extends EO = EO, TVariables extends EO = EO>(
    document: DocumentNode
  ): MutationDef<TData, TVariables> & With<TVariables, MutationDef<TData, EO>>;

  <TData extends EO = EO, TVariables extends EO = EO>(
    create: ConfigsBuilder<TVariables, MutationDefConfigs<TData>>
  ): MutationDef<TData, TVariables> & With<TVariables, MutationDef<TData, EO>>;
};

export type CreateFragmentDefFn = {
  <TData extends EO = EO, TVariables extends EO = { id: any }>(
    document: TypedDocumentNode<TData, TVariables>
  ): FragmentDef<TData, TVariables> & With<TVariables, FragmentDef<TData, EO>>;

  <TData extends EO = EO, TVariables extends EO = EO>(
    document: TypedDocumentNode<TData, TVariables>,
    create: ConfigsBuilder<TVariables, FragmentDefConfigs<TData>>
  ): FragmentDef<TData, TVariables> & With<TVariables, FragmentDef<TData, EO>>;
};

const createOperationDefInternal = <
  const TType extends symbol,
  TExtra extends EO
>(
  type: TType,
  create: ConfigsBuilder<any, any>,
  extra: TExtra
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
        ...extra,
      };
    },
    ...extra,
  };
};

export const createMutationDef: CreateMutationDefFn = (input) => {
  if (typeof input === "function") {
    return createOperationDefInternal(MUTATION_DEF_TYPE, input, EMPTY_OBJECT);
  }

  const document = input;
  return createOperationDefInternal(
    MUTATION_DEF_TYPE,
    () => ({ document } as any),
    EMPTY_OBJECT
  );
};

export const createQueryDef: CreateQueryDefFn = (input) => {
  if (typeof input === "function") {
    return createOperationDefInternal(QUERY_DEF_TYPE, input, EMPTY_OBJECT);
  }

  const document = input;
  return createOperationDefInternal(
    QUERY_DEF_TYPE,
    () => ({ document } as any),
    EMPTY_OBJECT
  );
};

const fragmentCache = new NestedMap((document: DocumentNode) => {
  const fragments: FragmentDefinitionNode[] = [];
  document.definitions.forEach((definition) => {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      throw new Error(
        `Found a ${definition.operation} operation${
          definition.name ? ` named '${definition.name.value}'` : ""
        }. ` +
          "No operations are allowed when using a fragment as a query. Only fragments are allowed."
      );
    }

    if (definition.kind === "FragmentDefinition") {
      fragments?.push(definition);
    }
  });

  const queries = new NestedMap((fragmentName: string) => {
    return {
      value: {
        ...document,
        definitions: [
          {
            kind: Kind.OPERATION_DEFINITION,
            operation: OperationTypeNode.QUERY,
            selectionSet: {
              kind: Kind.SELECTION_SET,
              selections: [
                {
                  kind: Kind.FRAGMENT_SPREAD,
                  name: {
                    kind: Kind.NAME,
                    value: fragmentName,
                  },
                },
              ],
            },
          },
          ...document.definitions,
        ],
      } as DocumentNode,
    };
  });

  return {
    value: {
      fragments,
      queries,
    },
    onDispose: queries.clear,
  };
});

export const createFragmentDef: CreateFragmentDefFn = (
  doc,
  create?: ConfigsBuilder<any, FragmentDefConfigs<any>>
): any => {
  return createOperationDefInternal(
    FRAGMENT_DEF_TYPE,
    (variables) => {
      const configs = create
        ? create(variables)
        : ({ document: doc, id: variables.id } as FragmentDefConfigs<any>);
      let document: DocumentNode;
      let typeName = "id" in configs ? configs.type : undefined;
      let fragmentName = configs.name;
      // has fragment name
      if (fragmentName) {
        document = fragmentCache.get(doc).queries.get(fragmentName);
      } else {
        const { fragments, queries } = fragmentCache.get(doc);

        if (fragments.length !== 1) {
          throw new Error(
            `Found ${fragments.length} fragments. The document must contain only 1 fragment`
          );
        }

        if (!fragmentName) {
          fragmentName = fragments[0].name.value;
        }

        if (!typeName) {
          typeName = fragments[0].typeCondition.name.value;
        }

        document = queries.get(fragmentName);
      }

      let from = "from" in configs ? configs.from : undefined;
      if (!from) {
        if ("id" in configs) {
          if (!typeName) {
            throw new Error("Typename required");
          }
          from = `${typeName}:${configs.id}`;
        } else {
          throw new Error("No id specified");
        }
      }

      return {
        ...configs,
        document,
        name: fragmentName,
        from,
      };
    },
    {
      fragment: doc,
      toString() {
        return print(doc);
      },
    }
  );
};

export const createOperationOptions = <
  T extends QueryDef<any, EO> | MutationDef<any, EO> | FragmentDef<any, EO>
>(
  operation: T
): (T extends QueryDef<infer D, EO>
  ? QueryDefConfigs<D>
  : T extends MutationDef<infer D, EO>
  ? MutationDefConfigs<D>
  : T extends FragmentDef<infer D, EO>
  ? FragmentDefConfigs<D> & { from: string }
  : never) & { fetchPolicy?: FetchPolicy } => {
  const options =
    "options" in operation
      ? (operation.options as OperationOptions | undefined)
      : undefined;
  return {
    ...operation.create((options?.variables as any) ?? EMPTY_OBJECT),
    ...options,
  } as any;
};
