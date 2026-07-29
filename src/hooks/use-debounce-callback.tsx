import debounce from 'lodash.debounce';
import * as React from 'react';

type DebounceOptions = {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
};

type AnyFunction = (...args: never[]) => unknown;

type ControlFunctions = {
  cancel: () => void;
  flush: () => void;
  isPending: () => boolean;
};

export type DebouncedState<T extends AnyFunction> = ControlFunctions & {
  invoke: (...args: Parameters<T>) => ReturnType<T> | undefined;
};

export function useDebounceCallback<T extends AnyFunction>(
  func: T,
  delay = 300,
  options?: DebounceOptions
): DebouncedState<T> {
  const instanceRef = React.useRef<ReturnType<typeof debounce> | null>(null);
  const pendingRef = React.useRef(false);

  React.useEffect(() => {
    const instance = debounce(
      (...args: Parameters<T>) => {
        pendingRef.current = false;
        return func(...args);
      },
      delay,
      options
    );
    instanceRef.current = instance;

    return () => {
      instance.cancel();
      pendingRef.current = false;
      if (instanceRef.current === instance) instanceRef.current = null;
    };
  }, [func, delay, options]);

  const invoke = React.useCallback((...args: Parameters<T>) => {
    const instance = instanceRef.current;
    if (!instance) return undefined;
    pendingRef.current = true;
    return instance(...args) as ReturnType<T> | undefined;
  }, []);

  const cancel = React.useCallback(() => {
    pendingRef.current = false;
    instanceRef.current?.cancel();
  }, []);

  const flush = React.useCallback(() => {
    pendingRef.current = false;
    instanceRef.current?.flush();
  }, []);

  const isPending = React.useCallback(() => pendingRef.current, []);

  return { invoke, cancel, flush, isPending };
}
