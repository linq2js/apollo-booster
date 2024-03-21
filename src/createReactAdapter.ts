import { createInternalAdapter } from "./createAdapter";
import { Client, EO, QueryDef, ReactiveVarDef } from "./types";
import {
  RESOLVED,
  createOperationOptions,
  isQueryDef,
  isReactiveVarDef,
} from "./utils";

export const createReactAdapter = (client: Client, onChange: VoidFunction) => {
  const adapter = createInternalAdapter(client);
  const unsubscribeAll = new Set<VoidFunction>();
  const shouldSubscribe: VoidFunction[] = [];

  return {
    ...adapter,
    cleanup() {
      unsubscribeAll.forEach((x) => x());
      unsubscribeAll.clear();
    },
    subscribeAll() {
      shouldSubscribe.forEach((x) => x());
    },
    use(...defs: readonly (QueryDef<any, EO> | ReactiveVarDef<any>)[]): any {
      const promises: Promise<any>[] = [];
      const results: any[] = [];
      defs.forEach((def, index) => {
        // handle reactive var
        if (isReactiveVarDef(def)) {
          const reactiveVar = adapter.getReactiveVar(def);
          shouldSubscribe.push(() =>
            unsubscribeAll.add(reactiveVar.onNextChange(onChange))
          );
          results[index] = reactiveVar();
          return;
        }
        if (isQueryDef(def)) {
          const options = createOperationOptions(def as QueryDef<any, EO>);
          if (options.require && adapter.require(...options.require)) {
            promises.push(RESOLVED);
            return;
          }

          const queryRef = adapter.ref(options);
          if (queryRef.state.loading) {
            promises.push(queryRef.state.promise);
            return;
          }
          if (queryRef.state.error) {
            throw queryRef.state.error;
          }
          shouldSubscribe.push(() =>
            unsubscribeAll.add(queryRef.state.subscribe(onChange))
          );

          results[index] = queryRef.state.data;
          return;
        }

        results[index] = def;
      });

      if (promises.length) {
        throw Promise.all(promises);
      }

      return results;
    },
  };
};
