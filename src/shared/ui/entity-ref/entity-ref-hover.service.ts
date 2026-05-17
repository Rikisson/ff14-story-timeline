import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable } from '@angular/core';
import { EntityCanonicalCache, EntityResolverCache } from '@shared/data-access';
import { EntityKind, EntityRef } from '@shared/models';
import { EntityRefPopoverComponent } from './entity-ref-popover.component';

export const ENTITY_KIND_LABEL: Record<EntityKind, string> = {
  character: 'Character',
  place: 'Place',
  event: 'Event',
  story: 'Story',
  plotline: 'Plotline',
  codexEntry: 'Codex',
};

@Injectable({ providedIn: 'root' })
export class EntityRefHoverService {
  private readonly overlay = inject(Overlay);
  private readonly directory = inject(EntityResolverCache);
  private readonly canonical = inject(EntityCanonicalCache);

  private current: OverlayRef | null = null;
  private closeTimeout: ReturnType<typeof setTimeout> | null = null;

  show(ref: EntityRef, anchor: HTMLElement): void {
    this.cancelClose();
    this.dispose();

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(anchor)
      .withPositions([
        {
          originX: 'center',
          originY: 'top',
          overlayX: 'center',
          overlayY: 'bottom',
          offsetY: -8,
        },
        {
          originX: 'center',
          originY: 'bottom',
          overlayX: 'center',
          overlayY: 'top',
          offsetY: 8,
        },
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -8,
        },
        {
          originX: 'end',
          originY: 'bottom',
          overlayX: 'end',
          overlayY: 'top',
          offsetY: 8,
        },
      ])
      .withFlexibleDimensions(false)
      .withPush(true);

    const overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
    });

    const portal = new ComponentPortal(EntityRefPopoverComponent);
    const componentRef = overlayRef.attach(portal);
    // The directory cache gives the label immediately (or after the next
    // batched fetch); the canonical cache fetches description lazily on
    // first show. Both are session-scoped so re-hover is free.
    componentRef.setInput('directory', this.directory.resolve(ref));
    componentRef.setInput('canonical', this.canonical.resolve(ref));
    componentRef.setInput('kindLabel', ENTITY_KIND_LABEL[ref.kind]);

    this.current = overlayRef;
  }

  scheduleClose(): void {
    if (this.closeTimeout) clearTimeout(this.closeTimeout);
    this.closeTimeout = setTimeout(() => this.dispose(), 120);
  }

  cancelClose(): void {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
  }

  dispose(): void {
    this.cancelClose();
    if (this.current) {
      this.current.dispose();
      this.current = null;
    }
  }
}
