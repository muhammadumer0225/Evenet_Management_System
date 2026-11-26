import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';

/** Subscribe to global updates or updates for one Expo; reconnects restore subscriptions. */
export function useExpoRealtimeVersion(expoId = null) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const subscription = expoId ? String(expoId) : null;
    const subscribe = () => socket.emit('subscribe-expo-updates', subscription);
    const handleUpdate = (event) => {
      if (subscription && String(event?.expoId || '') !== subscription) return;
      setVersion((current) => current + 1);
    };

    socket.on('connect', subscribe);
    socket.on('expo-data-updated', handleUpdate);
    if (socket.connected) subscribe();

    return () => {
      socket.off('connect', subscribe);
      socket.off('expo-data-updated', handleUpdate);
      if (socket.connected) socket.emit('unsubscribe-expo-updates', subscription);
    };
  }, [expoId]);

  return version;
}
