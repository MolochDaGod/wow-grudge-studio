export function grudgePlayerReference(profile, playerRecord) {
  const grudgeUsername = playerRecord?.grudgeUsername || profile.displayName || profile.username;
  return {
    grudgeId: profile.grudgeId,
    grudgeUsername,
    displayName: grudgeUsername,
    wowLogin: playerRecord?.wowAccount?.login || null,
    wowAccountReady: Boolean(playerRecord?.wowAccount?.login),
    usernameSetupComplete: Boolean(playerRecord?.usernameSetupComplete),
    launchCount: playerRecord?.launchCount || 0,
    lastLaunchAt: playerRecord?.lastLaunchAt || null,
    service: 'grudge-wow',
    realm: process.env.WOW_REALM_NAME || 'Grudge WoW',
  };
}