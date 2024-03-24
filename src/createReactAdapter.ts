import { createInternalAdapter } from "./createAdapter";
import { createOperationOptions } from "./operationDef";
import { Client, EO, FragmentDef, QueryDef, ReactiveVarDef } from "./types";
import { RESOLVED, isFragmentDef, isQueryDef, isReactiveVarDef } from "./utils";

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
    use(
      ...defs: readonly (
        | QueryDef<any, EO>
        | ReactiveVarDef<any>
        | FragmentDef<any, EO>
      )[]
    ): any {
      const promises: Promise<any>[] = [];
      const results: any[] = [];

      const handleQueryDef = (def: QueryDef<EO, EO>, index: number) => {
        const options = createOperationOptions(def);
        if (options.require && adapter.require(...options.require)) {
          promises.push(RESOLVED);
          return;
        }

        const queryRef = adapter.getQueryRef(options);
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

        if (index !== -1) {
          results[index] = queryRef.state.data;
        }
      };

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
        if (isFragmentDef(def)) {
          const options = createOperationOptions(def);
          const fragmentRef = adapter.getFragmentRef({
            document: (options as any).document,
            from: options.from,
          });

          const data = fragmentRef.data();
          // data is not ready
          if (!data) {
            if (options.fallback) {
              handleQueryDef(options.fallback, -1);
            }

            promises.push(fragmentRef.ready());
            return;
          }

          results[index] = data;
          shouldSubscribe.push(() =>
            unsubscribeAll.add(fragmentRef.subscribe(onChange))
          );
          return;
        }

        if (isQueryDef(def)) {
          return handleQueryDef(def, index);
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
