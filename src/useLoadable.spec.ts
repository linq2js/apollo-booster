import { act, renderHook } from "@testing-library/react";
import { useAsync } from "./useAsync";
import { delay } from "./utils";
import { observablePromise } from "./observablePromise";

describe("useAsync", () => {
  test("pending promise", async () => {
    const promise = Promise.resolve(1);
    const onComplete = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useAsync({ of: promise, onComplete, onError })
    );
    expect(result.current.loading).toBeTruthy();
    await act(delay);
    expect(result.current.loading).toBeFalsy();
    expect(result.current.data).toBe(1);
    expect(onComplete).toHaveBeenCalled();
  });

  test("resolved promise", async () => {
    const promise = observablePromise(Promise.resolve(1));
    const onComplete = jest.fn();
    const onError = jest.fn();
    await act(delay);
    const { result } = renderHook(() =>
      useAsync({ of: promise, onComplete, onError })
    );
    expect(result.current.loading).toBeFalsy();
    expect(result.current.data).toBe(1);
    expect(onComplete).toHaveBeenCalled();
  });

  test("rejected promise", async () => {
    const promise = observablePromise(Promise.reject("error"));
    const onComplete = jest.fn();
    const onError = jest.fn();
    await act(delay);
    const { result } = renderHook(() =>
      useAsync({ of: promise, onComplete, onError })
    );
    expect(result.current.loading).toBeFalsy();
    expect(result.current.error).toBe("error");
    expect(onError).toHaveBeenCalled();
  });

  test("lazy #1", async () => {
    const onComplete = jest.fn();
    const onResolve = jest.fn();
    const { result } = renderHook(() => useAsync<number>({ onComplete }));
    expect(result.current.loading).toBeFalsy();
    expect(result.current.status).toBe("idle");
    expect(onComplete).not.toHaveBeenCalled();
    result.current.then(onResolve);
    expect(onResolve).not.toHaveBeenCalled();
    await act(delay);
    expect(onResolve).not.toHaveBeenCalled();
    act(() => {
      result.current.of(Promise.resolve(1));
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(onResolve).not.toHaveBeenCalled();
    await act(delay);
    expect(onComplete).toHaveBeenCalled();
    expect(onResolve).toHaveBeenCalled();
  });

  test("lazy #2", async () => {
    const onComplete = jest.fn();
    const onResolve = jest.fn();
    const { result } = renderHook(() => useAsync<number>({ onComplete }));
    expect(result.current.loading).toBeFalsy();
    expect(result.current.status).toBe("idle");
    expect(onComplete).not.toHaveBeenCalled();
    result.current.then(onResolve);
    expect(onResolve).not.toHaveBeenCalled();
    await act(delay);
    expect(onResolve).not.toHaveBeenCalled();
    await act(async () => {
      const data = await result.current.of(Promise.resolve(1));
      expect(data).toBe(1);
    });
    expect(onComplete).toHaveBeenCalled();
    expect(onResolve).toHaveBeenCalled();
  });
});
