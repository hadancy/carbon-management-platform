export const NAVIGATION_REQUEST = "carbon:navigation-request";

export type NavigationRequest = CustomEvent<{ proceed: () => void }>;

export function requestNavigation(proceed: () => void) {
  const event: NavigationRequest = new CustomEvent(NAVIGATION_REQUEST, {
    cancelable: true,
    detail: { proceed },
  });
  if (window.dispatchEvent(event)) proceed();
}
