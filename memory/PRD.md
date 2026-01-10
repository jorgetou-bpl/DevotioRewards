# Boomerang Scanner App - Product Requirements Document

## Original Problem Statement
Build a custom scanner app that mimics the Boomerang scanner UI for a whitelabel SAAS. The app connects via API to Boomerang but hides PII (Personal Identifiable Information) when cards are scanned. Internal employees should not see customer personal info like names, emails, and phone numbers.

## User Personas
1. **Store Employee/Cashier**: Primary user who scans customer loyalty cards at POS
2. **Store Manager**: Configures settings and oversees usage
3. **End Client (Business Owner)**: Wants privacy-compliant loyalty program

## Core Requirements
- ✅ Email/password authentication
- ✅ QR Code scanner with camera access
- ✅ Manual card ID entry
- ✅ PII masking (name, email, phone hidden with ***)
- ✅ Show allowed data: Card ID, Customer ID, Balance, Points, Stamps
- ✅ Settings: Vibration, Beep, Show Result, Copy to Clipboard
- ✅ Customer search by phone/email
- ✅ Card actions: Add Stamp, Add Points, Redeem Reward
- ❌ Kiosk mode (not needed per client)

## What's Been Implemented (January 2026)

### Backend (FastAPI)
- JWT authentication (register/login)
- Boomerang API proxy endpoints
- PII masking middleware
- Mock responses for testing without real API key
- Settings CRUD operations
- Scan logging to MongoDB

### Frontend (React)
- Login/Register page
- Scanner page with camera preview
- Result page with masked customer data
- Settings page with toggle switches
- Customer search page
- Support/FAQ page
- Navigation sidebar

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/auth/register | POST | Create new user |
| /api/auth/login | POST | Login with email/password |
| /api/auth/me | GET | Get current user |
| /api/settings | GET/PUT | Get/update user settings |
| /api/scan | POST | Process scanned QR code |
| /api/cards/{id} | GET | Get card details |
| /api/cards/{id}/add-stamp | POST | Add stamps to card |
| /api/cards/{id}/add-point | POST | Add points to card |
| /api/cards/{id}/redeem-reward | POST | Redeem reward |
| /api/customers | GET | Search customers |

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Authentication flow
- [x] PII masking
- [x] Card scanning
- [x] Loyalty actions

### P1 (High Priority) - Pending
- [ ] Real Boomerang API integration (needs client API key)
- [ ] QR code detection from camera stream
- [ ] Transaction history/logs viewer

### P2 (Medium Priority)
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Push notifications for actions

### P3 (Low Priority)
- [ ] Offline mode with sync
- [ ] Analytics dashboard
- [ ] Export scan logs

## Next Action Items
1. **Client provides Boomerang API key** - Add to backend .env as `BOOMERANG_API_KEY`
2. Add QR code detection library (html5-qrcode or zxing)
3. Add transaction history page
4. Consider adding barcode scanning support

## Technical Notes
- Backend runs on port 8001
- Frontend runs on port 3000
- MongoDB for user data and scan logs
- Boomerang API base: https://api.digitalwallet.cards/api/v2
