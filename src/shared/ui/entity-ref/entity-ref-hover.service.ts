import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable } from '@angular/core';
import { ENTITY_KIND_LABEL, EntityResolverService } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { EntityRefPopoverComponent } from './entity-ref-popover.component';

@Injectable({ providedIn: 'root' })
export class EntityRefHoverService {
  private readonly overlay = inject(Overlay);
  private readonly resolver = inject(EntityResolverService);

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
    componentRef.setInput('resolved', this.resolver.resolve(ref));
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
