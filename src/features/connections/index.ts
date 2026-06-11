export { ConnectionsService } from './data-access/connections.service';
export type { WireConnectionInput } from './data-access/connections.service';
export type {
  Connection,
  ConnectionSource,
  ConnectionTarget,
  ConnectionVisibility,
  StoredConnection,
} from './data-access/connection.types';
export {
  connectionIdFor,
  connectionTargetsEntry,
  deriveConnectionKeys,
  endpointEntityId,
  entityKeyOf,
  sourceEntityRef,
  targetEntityRef,
} from './data-access/connection.types';
export { ConnectionSectionComponent } from './ui/connection-section.component';
export { InboundSectionComponent } from './ui/inbound-section.component';
export type { InboundTarget } from './ui/inbound-section.component';
