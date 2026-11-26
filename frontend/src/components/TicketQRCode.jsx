import { useMemo } from 'react';
import { encodeTicketQr } from '../lib/qrCode';

export default function TicketQRCode({ value, size = 176 }) {
  const matrix = useMemo(() => encodeTicketQr(value), [value]);
  const quietZone = 4;
  const viewSize = matrix.length + quietZone * 2;
  const cells = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) cells.push(<rect key={`${x}-${y}`} x={x + quietZone} y={y + quietZone} width="1" height="1" />);
  }));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      role="img"
      aria-label={`QR code for ticket ${value}`}
      shapeRendering="crispEdges"
      className="ticket-qr"
    >
      <rect width={viewSize} height={viewSize} fill="#fff" />
      <g fill="#111">{cells}</g>
    </svg>
  );
}
