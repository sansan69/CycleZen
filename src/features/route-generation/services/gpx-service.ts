import type { Coordinate } from './open-route-service';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateGpx(
  coordinates: Coordinate[],
  routeName: string = 'CycleZen Route',
  elevationGainM?: number
): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CycleZen"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(routeName)}</name>${
      elevationGainM !== undefined && isFinite(elevationGainM)
        ? `\n    <desc>Total ascent: ${elevationGainM.toFixed(0)} m</desc>`
        : ''
    }
  </metadata>
  <trk>
    <name>${escapeXml(routeName)}</name>
    <trkseg>`;

  const points = coordinates
    .map(
      (coord) =>
        `      <trkpt lat="${coord.lat.toFixed(6)}" lon="${coord.lng.toFixed(6)}">
        <ele>0</ele>
      </trkpt>`
    )
    .join('\n');

  const footer = `    </trkseg>
  </trk>
</gpx>`;

  return header + '\n' + points + '\n' + footer;
}

export function downloadGpx(
  coordinates: Coordinate[],
  routeName: string = 'CycleZen Route',
  elevationGainM?: number
): void {
  const gpx = generateGpx(coordinates, routeName, elevationGainM);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${routeName.replace(/[^a-zA-Z0-9]/g, '_')}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
