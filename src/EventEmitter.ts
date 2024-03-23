export type EventEmitterOptions = {
  onListenerAdded?: VoidFunction;
  onNoListener?: VoidFunction;
};

export class EventEmitter<T = void> {
  private listeners: ((payload: T) => void)[] = [];
  private options: EventEmitterOptions;

  constructor(options: EventEmitterOptions = {}) {
    this.options = options;
  }

  emit = (payload: T) => {
    this.listeners.slice().forEach((x) => x(payload));
  };

  on = (listener: VoidFunction): VoidFunction => {
    this.listeners.push(listener);
    let active = true;
    this.options.onListenerAdded?.();

    return () => {
      if (!active) return;
      active = false;
      const i = this.listeners.indexOf(listener);
      if (i !== -1) {
        this.listeners.splice(i, 1);
        if (!this.listeners.length) {
          this.options.onNoListener?.();
        }
      }
    };
  };

  clear = () => {
    this.listeners.length = 0;
  };
}
