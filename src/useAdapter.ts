import { useApolloClient } from "@apollo/client";

import { Adapter, QueryDef, ReactiveVarDef } from "./types";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createReactAdapter } from "./createReactAdapter";

type AcceptObservableType = ReactiveVarDef<any> | QueryDef<any, object>;
type ObservableData<T extends AcceptObservableType> = T extends ReactiveVarDef<
  infer D
>
  ? D
  : T extends QueryDef<infer D, object>
  ? D
  : never;
type MaybeObservable<T> = Extract<T, AcceptObservableType> extends never
  ? T
  :
      | ObservableData<Extract<T, AcceptObservableType>>
      | Exclude<T, AcceptObservableType>;

export type ReactAdapter = Adapter & {
  /**
   * Retrieve values from queries or reactive variables and link the component to them. When the data in the reactive variable or query changes, the component will re-render.
   * Unlike all other React Hooks, `use` can be called within loops and conditional statements like `if`
   * @param defs Definitions of query or reactive variable
   */
  use<const TDefinitions extends readonly any[]>(
    ...defs: TDefinitions
  ): {
    [key in keyof TDefinitions]: MaybeObservable<TDefinitions[key]>;
  };
};

export type UseAdapterFn = {
  (): ReactAdapter;
};

let lastAdapter: Adapter | undefined;

/**
 * Returns the adapter of the current Apollo client, which is retrieved from the `useApolloClient` hook.
 * @returns
 */
export const useAdapter: UseAdapterFn = () => {
  const client = useApolloClient();
  const rerender = useState({})[1];
  const adapter = useMemo(() => {
    const state = { status: "rendering" as "rendering" | "mount" | "unmount" };

    return Object.assign(
      createReactAdapter(client, () => {
        if (state.status === "mount") {
          rerender({});
        }
      }),
      { state }
    );
  }, [client, rerender]);

  const restoring = adapter.ready();
  if (restoring) throw restoring;

  lastAdapter = adapter;

  adapter.cleanup();
  adapter.state.status = "rendering";

  useLayoutEffect(() => {
    adapter.state.status = "mount";
    adapter.subscribeAll();
    return adapter.cleanup;
  });

  useEffect(
    () => () => {
      adapter.state.status = "unmount";
    },
    [adapter]
  );

  return adapter;
};

export const getLastAdapter = () => lastAdapter;
