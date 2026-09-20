import { useEffect, useRef } from 'react';

/** Reexecuta `callback` a cada `interval` ms — mesmo padrão do frontend web
 * original: outro dispositivo pode ter mudado o estado (mesa, comanda, fila). */
export function useAutoRefresh(callback: () => void, interval = 5000) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    const id = setInterval(() => savedCallback.current(), interval);
    return () => clearInterval(id);
  }, [interval]);
}
