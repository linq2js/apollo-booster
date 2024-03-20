import { useLayoutEffect, useState } from "react";
import { EMPTY_OBJECT } from "./utils";
import { ObservablePromise, observablePromise } from "./observablePromise";

export type UseAsyncOptions<T> = {
  of?: Promise<T>;
  onComplete?: (data: T) => void;
  onError?: (error: unknown) => void;
};

export const useAsync = <T>(options?: UseAsyncOptions<T>) => {
  const rerender = useState(EMPTY_OBJECT)[1];
  const [ref] = useState(() => {
    const current = { options, rendering: true };
    let status: "idle" | "loading" | "error" | "success" = "idle";
    let prevPromise: ObservablePromise<T> | undefined;
    let unsubscribe: VoidFunction | undefined;
    let resolve: ((data: T) => void) | undefined;
    let reject: ((error: unknown) => void) | undefined;

    const loadable = {
      get status() {
        return status;
      },
      get loading() {
        return prevPromise?.loading ?? false;
      },
      get error() {
        return prevPromise?.error;
      },
      get data() {
        return prevPromise?.data;
      },
      of(promise: Promise<T>) {
        if (promise !== prevPromise) {
          unsubscribe?.();
          prevPromise = observablePromise(promise);
          status = "loading";
          unsubscribe = prevPromise.subscribe(() => {
            if (prevPromise !== promise) {
              return;
            }

            if (prevPromise.error) {
              status = "error";
              reject?.(prevPromise.error);
              current.options?.onError?.(prevPromise.error);
            } else {
              status = "success";
              resolve?.(prevPromise.data as T);
              current.options?.onComplete?.(prevPromise.data as T);
            }

            if (!current.rendering) {
              rerender({});
            }
          });

          if (status === "loading") {
            if (!current.rendering) {
              rerender({});
            }
          } else {
            // promise is resolved or rejected
          }
        }
        return loadable;
      },
      then(...args: Parameters<Promise<T>["then"]>) {
        if (!prevPromise) {
          prevPromise = observablePromise(
            new Promise((...args) => {
              [resolve, reject] = args;
            })
          );
        }

        if (!args[0] && !args[1]) {
          return prevPromise;
        }

        return prevPromise.then(...args);
      },
    };

    return {
      current,
      loadable,
      cleanup() {
        unsubscribe?.();
        prevPromise = undefined;
      },
    };
  });
  ref.current.rendering = true;
  ref.current.options = options;

  useLayoutEffect(() => {
    ref.current.rendering = false;
  });

  useLayoutEffect(
    () => () => {
      ref.cleanup();
    },
    []
  );

  if (options && "of" in options) {
    if (options.of) {
      ref.loadable.of(options.of);
    } else {
      ref.cleanup();
    }
  }

  return ref.loadable;
};
