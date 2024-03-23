/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApolloError,
  ApolloQueryResult,
  ObservableQuery,
} from "@apollo/client";
import equal from "@wry/equality";
import { EventEmitter } from "./EventEmitter";

export class QueryRef<T> {
  public observable: ObservableQuery<T>;
  private _state: ReturnType<typeof this.createState> | undefined;
  private _data: T | undefined;
  private _disposeTimeout: any;

  readonly tags: string[];

  createState() {
    let data: T | undefined;
    let error: ApolloError | undefined;
    let loading: boolean;
    let promise: Promise<void>;
    let resolve: VoidFunction | undefined;
    let reject: VoidFunction | undefined;
    const onChange = new EventEmitter({
      onListenerAdded: () => {
        clearTimeout(this._disposeTimeout);
      },
      onNoListener: () => {
        this.dispose();
      },
    });

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

    const handleResult = (result: ApolloQueryResult<T>) => {
      if (result.loading) return;
      data = result.data;
      this._data = data;
      error = undefined;
      loading = false;
      resolve?.();
      promise = Promise.resolve();
      onChange.emit();
    };
    const handleError = (e: ApolloError) => {
      error = e;
      loading = false;
      reject?.();
      promise = Promise.reject(e);
      onChange.emit();
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
          onChange.emit();
        }
        return this.observable.refetch().then(handleResult, handleError);
      },
      dispose() {
        onChange.clear();
        subscription.unsubscribe();
      },
      subscribe: onChange.on,
    };
  }

  get state() {
    if (!this._state) {
      this._state = this.createState();
    }
    return this._state;
  }

  constructor(observable: ObservableQuery<T>, tags: string[]) {
    this.observable = observable;
    this.tags = tags;
  }

  dispose(immediate?: boolean) {
    const disposeAction = () => {
      this._state?.dispose();
      this._state = undefined;
    };
    if (immediate) {
      disposeAction();
    } else {
      this._disposeTimeout = setTimeout(disposeAction, 5 * 1000);
    }
  }
}
