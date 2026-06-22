#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npx cap sync "$@"

PACKAGE_SWIFT="ios/App/CapApp-SPM/Package.swift"

# Se houver iOS e o cap sync removeu Firebase, re-injeta (no-op enquanto iOS nao existe)
if [ -f "$PACKAGE_SWIFT" ] && ! grep -q "firebase-ios-sdk" "$PACKAGE_SWIFT"; then
  echo "[cap-sync] re-injecting firebase-ios-sdk into $PACKAGE_SWIFT"
  /usr/bin/sed -i '' \
    -e 's|\(.package(name: "CapacitorStatusBar", path: "../../../node_modules/@capacitor/status-bar")\)|\1,\
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "11.0.0")|' \
    "$PACKAGE_SWIFT"
  /usr/bin/sed -i '' \
    -e 's|\(.product(name: "CapacitorStatusBar", package: "CapacitorStatusBar")\)|\1,\
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk")|' \
    "$PACKAGE_SWIFT"
fi
