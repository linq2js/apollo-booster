import { isPromiseLike } from "./utils";

export type TypeDef = {
  name: string;
  props?: Record<string, TypeDef | ((value: any) => TypeDef)>;
};

export type TypedOf<T> = T extends Promise<infer D>
  ? Promise<TypedOf<D>>
  : T extends Record<string, any>
  ? { [key in keyof T]: TypedOf<T[key]> } & { __typename: string }
  : T extends readonly (infer I)[]
  ? TypedOf<I>[]
  : T;
/**
 * Assign the `__typename` property according to the specified type definition. Do not alter the original data object.
 * ```js
 * const newData = typed()
 * ```
 * @param data
 * @param def
 * @returns
 */
export const typed = <T>(
  data: T,
  def: TypeDef | ((data: any) => TypeDef)
): TypedOf<T> => {
  return assignTypeFor(data, (data) => {
    const originData = data;

    const d = typeof def === "function" ? def(data) : def;

    if (!(data as any).__typename) {
      data = {
        ...data,
        __typename: d.name,
      };
    }

    if (d.props) {
      const shouldCopy = data === originData;
      Object.entries(d.props).forEach(([path, subDef]) => {
        const props = path.split(".");
        data = assignDeepProp(data, shouldCopy, props, subDef);
      });
    }

    return data;
  });
};

const assignTypeFor = (data: any, callback: (data: any) => any) => {
  if (!data || typeof data !== "object") return data;
  if (isPromiseLike(data)) {
    return data.then(callback);
  }
  if (Array.isArray(data)) {
    let changed = false;
    const results: any[] = [];
    data.forEach((item, index) => {
      if (Array.isArray(item)) {
        results[index] = item;
        return;
      }
      const next = callback(item);
      if (next !== item) {
        changed = true;
      }
      results[index] = next;
    });
    return changed ? results : data;
  }
  return callback(data);
};

const assignDeepProp = (
  target: any,
  shouldCopy: boolean,
  props: string[],
  def: TypeDef | ((value: unknown) => TypeDef)
): any => {
  return assignTypeFor(target, (target) => {
    const [prop, ...rest] = props;
    const prev = target[prop];
    const next = rest.length
      ? assignDeepProp(prev, true, rest, def)
      : typed(prev, def);
    if (next !== prev) {
      if (shouldCopy) {
        return { ...target, [prop]: next };
      }
      target[prop] = next;
    }

    return target;
  });
};
