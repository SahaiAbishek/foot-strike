import { HttpInterceptorFn } from '@angular/common/http';

/** Ensures the session cookie is sent/received on cross-port calls to the backend. */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ withCredentials: true }));
};
