
import { io } from "socket.io-client";

// Use the current frontend origin by default. This keeps Socket.IO on the same
// host in production (reverse-proxied by Nginx) and through Vite's WS proxy in dev.
// Set VITE_SOCKET_URL only when the socket server is intentionally hosted elsewhere.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: (cb) => {
    cb({
      token: localStorage.getItem("eventsphere.token"),
    });
  },
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

// Access tokens are refreshed by the REST client. Reconnect an active socket
// so its handshake uses the newly stored token instead of an expired JWT.
export const reconnectSocket = () => {
  if (!localStorage.getItem("eventsphere.token")) return;
  socket.disconnect();
  socket.connect();
};
