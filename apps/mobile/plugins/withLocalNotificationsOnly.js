// Kinpaw's notifications are local only: the phone schedules them, no push token is asked for and
// no server sends one (docs/application/features/v2-notifications-requirements.md, R1). Local
// notifications need no entitlement.
//
// expo-notifications' own config plugin always adds the push entitlement (`aps-environment`), and
// Expo applies that plugin whenever the package is installed, listed in app.json or not. A free
// Apple account can't sign it ("Personal development teams do not support the Push Notifications
// capability"), so the iPhone build would fail as it did for Sign in with Apple
// (docs/memory/xcode-free-account-signing.md). This plugin applies expo-notifications' plugin
// itself and removes the entitlement afterwards, so no Xcode fix is needed and none is undone by
// a rebuild. List this in app.json in place of "expo-notifications".
//
// Remote push (launch, a paid Apple account) is the day this file is deleted and
// "expo-notifications" goes back into app.json.
const { withEntitlementsPlist } = require('expo/config-plugins')
const withNotifications = require('expo-notifications/app.plugin.js').default

/** @type {import('expo/config-plugins').ConfigPlugin<Record<string, unknown> | void>} */
module.exports = function withLocalNotificationsOnly(config, props) {
	// A mod registered later runs earlier, so the removal is registered first and runs after
	// expo-notifications has written its entitlement.
	config = withEntitlementsPlist(config, (mod) => {
		delete mod.modResults['aps-environment']
		return mod
	})
	// Run-once: Expo's automatic copy of this plugin then sees it applied and skips.
	return withNotifications(config, props ?? {})
}
