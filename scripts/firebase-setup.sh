#!/usr/bin/env bash
# Firebase Setup Script for Claude Companion
# Walks through creating and configuring the Firebase project.

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   Claude Companion - Firebase Setup               ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# Check for Firebase CLI
if ! command -v firebase &> /dev/null; then
  echo -e "${YELLOW}Firebase CLI not found. Installing...${NC}"
  npm install -g firebase-tools
fi

echo -e "${GREEN}Step 1: Firebase Project${NC}"
echo "─────────────────────────────────────────────────"
echo ""
echo "If you already have a Firebase project, skip to Step 2."
echo "Otherwise, let's create one:"
echo ""
echo -e "  ${CYAN}1. Go to: https://console.firebase.google.com${NC}"
echo "  2. Click 'Add project'"
echo "  3. Name it: claude-companion (or your choice)"
echo "  4. Disable Google Analytics (not needed)"
echo "  5. Click 'Create project'"
echo ""
read -p "Press Enter when your Firebase project is ready..."

echo ""
echo -e "${GREEN}Step 2: Enable Firestore${NC}"
echo "─────────────────────────────────────────────────"
echo ""
echo -e "  ${CYAN}1. In Firebase Console → Build → Firestore Database${NC}"
echo "  2. Click 'Create database'"
echo "  3. Select 'Start in test mode' (we'll add rules later)"
echo "  4. Choose a location near you"
echo ""
read -p "Press Enter when Firestore is enabled..."

echo ""
echo -e "${GREEN}Step 3: Enable Cloud Messaging${NC}"
echo "─────────────────────────────────────────────────"
echo ""
echo -e "  ${CYAN}1. In Firebase Console → Build → Cloud Messaging${NC}"
echo "  2. It should be enabled by default"
echo "  3. Note the Sender ID shown on this page"
echo ""
read -p "Press Enter when Cloud Messaging is confirmed..."

echo ""
echo -e "${GREEN}Step 4: Download Service Account Key (Backend)${NC}"
echo "─────────────────────────────────────────────────"
echo ""
echo -e "  ${CYAN}1. Firebase Console → Project Settings (gear icon)${NC}"
echo "  2. Go to 'Service accounts' tab"
echo "  3. Click 'Generate new private key'"
echo "  4. Save the JSON file as:"
echo -e "     ${YELLOW}${PROJECT_ROOT}/config/firebase-service-account.json${NC}"
echo ""
read -p "Press Enter when the service account key is saved..."

if [ -f "$PROJECT_ROOT/config/firebase-service-account.json" ]; then
  echo -e "  ${GREEN}✓ Service account file found${NC}"
else
  echo -e "  ${RED}✗ File not found at expected path${NC}"
  echo "  You can move it there later."
fi

echo ""
echo -e "${GREEN}Step 5: Get Web App Config (Mobile App)${NC}"
echo "─────────────────────────────────────────────────"
echo ""
echo -e "  ${CYAN}1. Firebase Console → Project Settings${NC}"
echo "  2. Under 'Your apps', click the web icon '</>' to add a web app"
echo "  3. Register the app (name: 'Claude Companion')"
echo "  4. Copy the firebaseConfig values shown"
echo ""
echo "Enter your Firebase config values:"
echo ""

read -p "  API Key: " FB_API_KEY
read -p "  Auth Domain (e.g. myproject.firebaseapp.com): " FB_AUTH_DOMAIN
read -p "  Project ID: " FB_PROJECT_ID
read -p "  Storage Bucket (e.g. myproject.appspot.com): " FB_STORAGE_BUCKET
read -p "  Messaging Sender ID: " FB_SENDER_ID
read -p "  App ID: " FB_APP_ID

echo ""
echo -e "${GREEN}Step 6: Android App for FCM${NC}"
echo "─────────────────────────────────────────────────"
echo ""
echo -e "  ${CYAN}1. Firebase Console → Project Settings → Your apps${NC}"
echo "  2. Click the Android icon to add an Android app"
echo "  3. Package name: ${YELLOW}com.claudecompanion.app${NC}"
echo "  4. Download the google-services.json file"
echo "  5. Save it as:"
echo -e "     ${YELLOW}${PROJECT_ROOT}/src/mobile/google-services.json${NC}"
echo ""
read -p "Press Enter when google-services.json is saved..."

if [ -f "$PROJECT_ROOT/src/mobile/google-services.json" ]; then
  echo -e "  ${GREEN}✓ google-services.json found${NC}"
else
  echo -e "  ${RED}✗ File not found. You can add it later.${NC}"
fi

echo ""
echo -e "${GREEN}Writing configuration files...${NC}"
echo "─────────────────────────────────────────────────"

# Write Firebase client config
cat > "$PROJECT_ROOT/config/firebase-config.json" << FBEOF
{
  "apiKey": "${FB_API_KEY}",
  "authDomain": "${FB_AUTH_DOMAIN}",
  "projectId": "${FB_PROJECT_ID}",
  "storageBucket": "${FB_STORAGE_BUCKET}",
  "messagingSenderId": "${FB_SENDER_ID}",
  "appId": "${FB_APP_ID}"
}
FBEOF
echo -e "  ${GREEN}✓ config/firebase-config.json${NC}"

# Generate a random API secret
API_SECRET=$(openssl rand -hex 24)

# Write backend .env
cat > "$PROJECT_ROOT/src/backend/.env" << ENVEOF
PORT=3847
API_SECRET=${API_SECRET}
FIREBASE_SERVICE_ACCOUNT_PATH=${PROJECT_ROOT}/config/firebase-service-account.json
FIREBASE_DATABASE_URL=https://${FB_PROJECT_ID}.firebaseio.com
ENVEOF
echo -e "  ${GREEN}✓ src/backend/.env${NC}"

# Write mobile .env
cat > "$PROJECT_ROOT/src/mobile/.env" << MENVEOF
EXPO_PUBLIC_FIREBASE_API_KEY=${FB_API_KEY}
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=${FB_AUTH_DOMAIN}
EXPO_PUBLIC_FIREBASE_PROJECT_ID=${FB_PROJECT_ID}
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=${FB_STORAGE_BUCKET}
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${FB_SENDER_ID}
EXPO_PUBLIC_FIREBASE_APP_ID=${FB_APP_ID}
EXPO_PUBLIC_API_URL=http://localhost:3847
EXPO_PUBLIC_API_SECRET=${API_SECRET}
MENVEOF
echo -e "  ${GREEN}✓ src/mobile/.env${NC}"

# Write Firestore security rules
cat > "$PROJECT_ROOT/config/firestore.rules" << RULESEOF
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Sessions - read/write from backend only (via Admin SDK)
    match /sessions/{sessionId} {
      allow read: if true;
      allow write: if false;
    }
    // Questions - read from mobile, write from backend
    match /questions/{questionId} {
      allow read: if true;
      allow write: if false;
    }
    // Approvals - same pattern
    match /approvals/{approvalId} {
      allow read: if true;
      allow write: if false;
    }
    // Usage - read only from mobile
    match /usage/{entryId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
RULESEOF
echo -e "  ${GREEN}✓ config/firestore.rules${NC}"

echo ""
echo -e "${GREEN}Step 7: Set Hook Environment Variables${NC}"
echo "─────────────────────────────────────────────────"
echo ""
echo "Add these to your shell profile (~/.zshrc or ~/.bashrc):"
echo ""
echo -e "  ${CYAN}export CLAUDE_COMPANION_URL=http://localhost:3847${NC}"
echo -e "  ${CYAN}export CLAUDE_COMPANION_SECRET=${API_SECRET}${NC}"
echo ""

# Offer to append to zshrc
read -p "Append to ~/.zshrc now? (y/n): " APPEND_SHELL
if [ "$APPEND_SHELL" = "y" ]; then
  echo "" >> ~/.zshrc
  echo "# Claude Companion" >> ~/.zshrc
  echo "export CLAUDE_COMPANION_URL=http://localhost:3847" >> ~/.zshrc
  echo "export CLAUDE_COMPANION_SECRET=${API_SECRET}" >> ~/.zshrc
  echo -e "  ${GREEN}✓ Added to ~/.zshrc${NC}"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo ""
echo -e "  ${CYAN}1. Install & start backend:${NC}"
echo "     cd src/backend && npm install && npm run dev"
echo ""
echo -e "  ${CYAN}2. Install hooks:${NC}"
echo "     node src/hooks/setup.js"
echo ""
echo -e "  ${CYAN}3. Start mobile app:${NC}"
echo "     cd src/mobile && npx expo install && npx expo start"
echo ""
echo -e "  ${CYAN}4. Build APK:${NC}"
echo "     cd src/mobile && eas build --platform android --profile preview"
echo ""
echo -e "  ${YELLOW}API Secret: ${API_SECRET}${NC}"
echo "  (save this — it authenticates hooks and the mobile app)"
echo ""
