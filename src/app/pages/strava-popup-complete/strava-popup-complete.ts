import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { STRAVA_POPUP_MESSAGE_TYPE } from '../../services/auth-state';

@Component({
  selector: 'app-strava-popup-complete',
  standalone: true,
  templateUrl: './strava-popup-complete.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StravaPopupComplete implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const status = this.route.snapshot.queryParamMap.get('status') === 'connected' ? 'connected' : 'error';

    if (window.opener) {
      window.opener.postMessage({ type: STRAVA_POPUP_MESSAGE_TYPE, status }, window.location.origin);
      window.close();
    } else {
      // Popup blocked and this ran as a normal navigation instead - just continue to the dashboard.
      this.router.navigateByUrl('/dashboard');
    }
  }
}
