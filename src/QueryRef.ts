/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApolloError,
  ApolloQueryResult,
  ObservableQuery,
} from "@apollo/client";
import equal from "@wry/equality";

export class QueryRef<T> {
  public observable: ObservableQuery<T>;
  private _state: ReturnType<typeof this.createState> | undefined;
  private _data: T | undefined;
  private _disposeTimeout: any;

  createState() {
    let data: T | undefined;
    let error: ApolloError | undefined;
    let loading: boolean;
    let promise: Promise<void>;
    let resolve: VoidFunction | undefined;
    let reject: VoidFunction | undefined;
    const listeners = new Array<VoidFunction>();

    const lastResult = this.observable.getLastResult();
    if (!lastResult?.loading) {
      data = lastResult?.data;
      error = lastResult?.error;
      this._data = data;
    }
    const fetchPolicy =
      this.observable.options.nextFetchPolicy ||
      this.observable.options.fetchPolicy;
    if (fetchPolicy === "network-only" || fetchPolicy === "no-cache") {
      data = undefined;
      error = undefined;
    }
    if (data) {
      loading = false;
    } else if (error) {
      loading = false;
    } else {
      loading = true;
      promise = new Promise((...args) => {
        [resolve, reject] = args;
      });
    }

    const notify = () => listeners.slice().forEach((x) => x());
    const handleResult = (result: ApolloQueryResult<T>) => {
      if (result.loading) return;
      data = result.data;
      this._data = data;
      error = undefined;
      loading = false;
      resolve?.();
      promise = Promise.resolve();
      notify();
    };
    const handleError = (e: ApolloError) => {
      error = e;
      loading = false;
      reject?.();
      promise = Promise.reject(e);
      notify();
    };
    const subscription = this.observable
      .filter((result) => {
        return !equal(result.data, {}) && !equal(result.data, this._data);
      })
      .subscribe(handleResult, handleError);

    return {
      get loading() {
        return loading;
      },
      get data() {
        return data;
      },
      get error() {
        return error;
      },
      get promise() {
        return promise;
      },
      refetch: (fresh = false) => {
        if (fresh) {
          this._data = undefined;
          loading = true;
          promise = new Promise((...args) => {
            [resolve, reject] = args;
          });
          notify();
        }
        return this.observable.refetch().then(handleResult, handleError);
      },
      dispose() {
        listeners.length = 0;
        subscription.unsubscribe();
      },
      notify,
      subscribe: (listener: VoidFunction): VoidFunction => {
        clearTimeout(this._disposeTimeout);
        listeners.push(listener);
        let active = true;
        return () => {
          if (!active) return;
          active = false;
          const i = listeners.indexOf(listener);
          if (i !== -1) {
            listeners.splice(i, 1);
            if (!listeners.length) {
              this.disposeState();
            }
          }
        };
      },
    };
  }

  get state() {
    if (!this._state) {
      this._state = this.createState();
    }
    return this._state;
  }

  constructor(observable: ObservableQuery<T>) {
    this.observable = observable;
  }

  private disposeState() {
    this._disposeTimeout = setTimeout(() => {
      this._state?.dispose();
      this._state = undefined;
    }, 5 * 1000);
  }
}
