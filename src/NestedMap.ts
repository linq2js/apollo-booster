export type Item<V> = {
  value: V;
  onDispose?: (value: V) => void;
  onChange?: (value: V) => void;
};

type ItemCreator<K, V> = (key: K) => Item<V>;

export class NestedMap<K, V, SK = K> {
  private createItem: ItemCreator<K, V>;
  private createKey: ((key: K) => SK) | undefined;
  private items = new Map<SK, Item<V> & { key: K }>();

  constructor(createItem: ItemCreator<K, V>, createKey?: (key: K) => SK) {
    this.createItem = createItem;
    this.createKey = createKey;
  }

  private find(key: K) {
    const sk = this.createKey ? this.createKey(key) : (key as unknown as SK);

    return {
      item: this.items.get(sk as SK),
      sk,
    };
  }

  *keys() {
    for (const value of this.items.values()) {
      yield value.key;
    }
  }

  *values() {
    for (const value of this.items.values()) {
      yield value.value;
    }
  }

  get = (key: K) => {
    const { item, sk } = this.find(key);
    if (!item) {
      const newItem = this.createItem(key);
      this.items.set(sk, { ...newItem, key });
      return newItem.value;
    }

    return item.value;
  };

  set = (key: K, value: V) => {
    const { item } = this.find(key);
    if (item && item.value !== value) {
      item.value = value;
      item.onChange?.(value);
    }
  };

  delete = (key: K) => {
    const { item, sk } = this.find(key);
    if (item) {
      this.items.delete(sk);
      item.onDispose?.(item.value);
    }
  };

  forEach = (callback: (value: V, key: K) => void) => {
    this.items.forEach((item) => callback(item.value, item.key));
  };

  clear = () => {
    this.items.forEach((x) => x.onDispose?.(x.value));
    this.items.clear();
  };
}
