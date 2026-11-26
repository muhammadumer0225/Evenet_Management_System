# Real-time Expo Updates

Authenticated Socket.IO clients subscribe to either the global `expo-updates` room or a selected Expo room (`expo:<Mongo ObjectId>`). The server verifies the JWT before accepting connections and validates Expo IDs before joining or leaving a scoped room. The client hook restores its subscription after reconnect and removes listeners/subscriptions when a page unmounts or changes the selected Expo.

Successful Expo, floor-plan, session, and booth mutations broadcast a lightweight `expo-data-updated` signal to the relevant Expo room and the global room. The payload contains only the change type, Expo ID, entity ID, and timestamp; it does not contain private record data. Clients refetch authoritative data through their existing API helpers.

Frontend pages subscribed through `useExpoRealtimeVersion` include:

- Home page, public Expo directory, public schedule, and Expo detail
- Admin Expo management, announcements, Expo insights, check-in Expo list, booth management, booth visitor check-in, and session schedule
- Exhibitor Expo discovery, booth booking/availability, and booth analytics

Covered server-side changes include Expo create/update/delete and floor-plan updates; session create/update/cancel; booth create/update/delete, availability changes, reservations, releases, admin assignments, and recorded booth visits.

Socket connections remain JWT-authenticated. Realtime delivery is best-effort: a Socket.IO delivery problem does not roll back or fail a successfully persisted API mutation. Events are refresh signals only; authoritative data continues to come from the existing API. Aggregate analytics pages refresh their API data when the global signal arrives; this does not mean analytics values are streamed directly over Socket.IO.

## Development and deployment connection

The frontend connects Socket.IO to the current frontend origin by default, so a deployed browser does not attempt to connect to its own `localhost`. Set `VITE_SOCKET_URL` only when the Socket.IO server is intentionally hosted on a different origin. During local Vite development, `/socket.io` is proxied to `http://localhost:5000` with WebSocket support. In the Docker/Nginx deployment, the existing `/socket.io/` reverse-proxy location forwards the connection to the backend on the same origin.

The backend applies the configured `FRONTEND_URL` origin list to both REST and Socket.IO CORS. A comma-separated list is supported; make sure it contains the exact browser origin(s), including scheme and port where applicable. The local Vite origin is the fallback when `FRONTEND_URL` is not set.


When the REST client rotates an expired access token, it reconnects an active Socket.IO connection so the next authenticated handshake uses the new token. For Docker deployments on a public hostname, set `FRONTEND_URL` in the shell or deployment environment to the exact browser origin (for example, `https://events.example.com`). The Compose default remains `http://localhost:8080` for local use.
