import { useSetting } from '../data/hooks'
import { setSetting } from '../data/repo'
import { isIOS, isStandalone } from '../lib/platform'

export function InstallBanner() {
  const dismissed = useSetting('installBannerDismissed', false)
  if (dismissed !== false || !isIOS() || isStandalone()) return null
  return (
    <div className="banner" role="note">
      <p>
        <strong>Add to Home Screen first, then add your data.</strong> On iPhone, Safari and the Home Screen app keep separate
        storage. Tap Share → Add to Home Screen, then open Fitcheck from there.
      </p>
      <button type="button" className="btn small" onClick={() => setSetting('installBannerDismissed', true)}>Got it</button>
    </div>
  )
}
