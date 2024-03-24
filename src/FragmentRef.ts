import { DocumentNode } from "graphql";
import { Client, EO } from "./types";
import { Cache, DataProxy, TypedDocumentNode } from "@apollo/client";
import { EventEmitter } from "./EventEmitter";
import { equal } from "@wry/equality";

export class FragmentRef<TData> {
  private unsubscribe: VoidFunction | undefined;
  private _disposeTimeout: any;
  private onChange = new EventEmitter({
    onListenerAdded: () => {
      clearTimeout(this._disposeTimeout);
    },
    onNoListener: () => {
      this.dispose();
    },
  });
  private diff: DataProxy.DiffResult<TData> | undefined;
  private resolve: ((data: TData) => void) | undefined;
  private promise: Promise<TData> | undefined;
  private client: Client;
  private readOptions: Cache.ReadOptions<EO, TData>;

  ready() {
    if (!this.promise) {
      this.promise = new Promise((resolve) => {
        this.resolve = resolve;
      });
    }
    return this.promise!;
  }

  data() {
    this.watch();
    if (!this.diff?.complete) {
      return undefined;
    }
    return this.diff.result as TData;
  }

  constructor(client: Client, document: DocumentNode, from: string) {
    this.client = client;
    this.readOptions = {
      id: from,
      returnPartialData: true,
      query: document as TypedDocumentNode<TData, any>,
      optimistic: true,
    };
  }

  private watch() {
    if (this.unsubscribe) return;
    this.unsubscribe = this.client.cache.watch({
      ...this.readOptions,
      immediate: true,
      callback: (diff) => {
        if (!diff.complete) return;
        if (!this.diff || equal(this.diff.result, diff.result)) {
          this.diff = diff;
          this.resolve?.(diff.result!);
          this.resolve = undefined;
          this.promise = Promise.resolve(diff.result!);
          this.onChange.emit();
        }
      },
    });
  }

  subscribe(listener: VoidFunction) {
    this.watch();
    return this.onChange.on(listener);
  }

  dispose(immediate?: boolean) {
    const disposeAction = () => {
      this.resolve = undefined;
      this.unsubscribe?.();
      this.unsubscribe = undefined;
      this.onChange.clear();
    };
    if (immediate) {
      disposeAction();
    } else {
      this._disposeTimeout = setTimeout(disposeAction, 5 * 1000);
    }
  }
}
