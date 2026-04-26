import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthComponent } from './auth/auth.component';
import { RetePocComponent } from './rete-poc/rete-poc.component';

@Component({
  selector: 'app-root',
  imports: [AuthComponent, RetePocComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
