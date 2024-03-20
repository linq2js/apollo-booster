import { Loadable } from "./types";
import { NOOP } from "./utils";

const IS_OBSERVABLE_PROMISE_PROP = Symbol("isObservablePromise");

export type ObservablePromise<T> = Promise<T> &
  Loadable<T> & {
    subscribe(listener: VoidFunction): VoidFunction;
  };

const assignObservablePromiseProps = <T>(
  promise: Promise<T>,
  extra = {}
): ObservablePromise<T> => {
  return Object.assign(
    promise,
    {
      [IS_OBSERVABLE_PROMISE_PROP]: true,
      loading: true,
      subscribe(listener: VoidFunction) {
        if (!this.loading) {
          listener();
          return NOOP;
        }

        let active = true;

        promise.finally(() => {
          if (!active) return;
          listener();
        });

        return () => {
          active = false;
        };
      },
    },
    extra
  );
};

const observablePromiseInternal = <T>(
  promise: Promise<T>
): ObservablePromise<T> => {
  if (IS_OBSERVABLE_PROMISE_PROP in promise) {
    return promise as unknown as ObservablePromise<T>;
  }

  promise.then(
    (data) => {
      Object.assign(promise, { data, loading: false });
    },
    (error) => {
      Object.assign(promise, { error, loading: false });
    }
  );

  return assignObservablePromiseProps(promise);
};

export const observablePromise = Object.assign(observablePromiseInternal, {
  resolve<T = void>(data?: T) {
    return assignObservablePromiseProps(Promise.resolve(data), {
      loading: false,
      data,
    });
  },
  reject(error: unknown) {
    return assignObservablePromiseProps(Promise.reject(error), {
      loading: false,
      error,
    });
  },
});
