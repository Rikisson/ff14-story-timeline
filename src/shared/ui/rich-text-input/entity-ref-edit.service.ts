import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable } from '@angular/core';
import { EntityKind } from '@shared/models';
import { EntityRefEditPopoverComponent } from './entity-ref-edit-popover.component';

export interface EntityRefEditRequest {
  kind: EntityKind;
  id: string;
  displayText: string;
  anchor: HTMLElement;
  onSave: (next: string) => void;
}

@Injectable({ providedIn: 'root' })
export class EntityRefEditService {
  private readonly overlay = inject(Overlay);

  private current: OverlayRef | null = null;
  private outsideClickHandler: ((event: MouseEvent) => void) | null = null;

  open(request: EntityRefEditRequest): void {
    this.close();

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(request.anchor)
      .withPositions([
        {
          originX: 'center',
          originY: 'bottom',
          overlayX: 'center',
          overlayY: 'top',
          offsetY: 8,
        },
        {
          originX: 'center',
          originY: 'top',
          overlayX: 'center',
          overlayY: 'bottom',
          offsetY: -8,
        },
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
          offsetY: 8,
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

    const componentRef = overlayRef.attach(new ComponentPortal(EntityRefEditPopoverComponent));
    componentRef.setInput('kind', request.kind);
    componentRef.setInput('id', request.id);
    componentRef.setInput('initialDisplayText', request.displayText);

    componentRef.instance.save.subscribe((next: string) => {
      request.onSave(next);
      this.close();
    });
    componentRef.instance.cancel.subscribe(() => this.close());

    this.current = overlayRef;
    this.bindOutsideClick(request.anchor);
  }

  close(): void {
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler, true);
      this.outsideClickHandler = null;
    }
    if (this.current) {
      this.current.dispose();
      this.current = null;
    }
  }

  private bindOutsideClick(anchor: HTMLElement): void {
    const handler = (event: MouseEvent): void => {
      const overlayEl = this.current?.overlayElement;
      const target = event.target instanceof Node ? event.target : null;
      if (!target) return;
      if (overlayEl?.contains(target)) return;
      if (anchor.contains(target)) return;
      this.close();
    };
    this.outsideClickHandler = handler;
    document.addEventListener('mousedown', handler, true);
  }
}
