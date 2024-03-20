import { useLayoutEffect, useState } from "react";
import { EMPTY_OBJECT } from "./utils";
import { ObservablePromise, observablePromise } from "./observablePromise";

export type UseAsyncOptions<T> = {
  of?: Promise<T>;

  /**
   * This callback is triggered when the promise is successfully resolved, usually to process or handle the successfully retrieved data or result.
   * @param data
   * @returns
   */
  onSuccess?: (data: T) => void;

  /**
   * This callback is executed when the associated promise is rejected, typically to handle errors or unexpected conditions that prevented the promise from being fulfilled.
   * @param error
   * @returns
   */
  onError?: (error: unknown) => void;
};

/**
 * The API provides an asynchronous interface for handling specified promises, featuring three key properties: `loading`, `data`, and `error`. The `loading` status indicates whether the promise is pending, the `data` property holds the resolved value upon successful completion, and the `error` captures any rejection. The API's `of()` method allows for dynamic modification of the associated promise, enabling the switch to a new promise as needed.
 * @param options
 * @returns
 */
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
              current.options?.onSuccess?.(prevPromise.data as T);
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
