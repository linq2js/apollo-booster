type Item<V> = {
  value: V;
  onDispose?: (value: V) => void;
  onChange?: (value: V) => void;
};

type Creator<K, V> = (key: K) => Item<V>;

export class NestedMap<K, V, SK = K> {
  private create: Creator<K, V>;
  private serialize: ((key: K) => SK) | undefined;
  private items = new Map<SK, Item<V> & { key: K }>();

  constructor(create: Creator<K, V>, serialize?: (key: K) => SK) {
    this.create = create;
    this.serialize = serialize;
  }

  private find(key: K) {
    const sk = this.serialize ? this.serialize(key) : (key as unknown as SK);

    return {
      item: this.items.get(sk as SK),
      sk,
    };
  }

  get = (key: K) => {
    const { item, sk } = this.find(key);
    if (!item) {
      const newItem = this.create(key);
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
