import { ArchNode, DiagramCanvas, type DiagramEdge, type Layout } from '@/components/architecture';
import { LabShell } from '@/components/learning';

// Placeholder: this Lab is not built yet. It is on the Concept standard pending list.
const LAYOUT: Layout = {
  client: { x: 120, y: 60, w: 180, h: 62 },
  server: { x: 560, y: 60, w: 180, h: 62 },
};

const EDGES: DiagramEdge[] = [{ from: 'client', to: 'server', tone: 'brand' }];

export function ProxyLab() {
  return (
    <LabShell title="Proxy Lab" description="This Lab is being built." controls={null}>
      <DiagramCanvas layout={LAYOUT} edges={EDGES} height={200} className="bg-canvas">
        <ArchNode kind="client" title="Client" placed={LAYOUT.client} compact />
        <ArchNode kind="server" title="Server" placed={LAYOUT.server} compact />
      </DiagramCanvas>
    </LabShell>
  );
}

export default ProxyLab;
