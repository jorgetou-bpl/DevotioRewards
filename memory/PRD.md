# Devotio Rewards Scanner App - PRD

## Original Problem Statement
Build a custom scanner app for "Devotio Rewards" SaaS whitelabel service connecting to the Boomerangme API. The app needs to:
- Prevent display of PII (email, phone) when scanning loyalty cards
- Display customer name (visible), customer ID, transaction status, loyalty points
- Process loyalty actions (add stamps/points, redeem rewards, apply discounts)
- Be mobile-first for field staff use

## Product Requirements

### Core Features
1. **PII Masking**:
   - ✅ Customer name and surname: **VISIBLE** (for identification)
   - ✅ Email: **MASKED** (***@***.***) 
   - ✅ Phone: **MASKED** (***-***-****)

2. **Data Display**:
   - ✅ Card ID, loyalty status (stamps, points, rewards)
   - ✅ Card type shown in header (e.g., "Tarjeta de Sellos")
   - ✅ Multi-currency support (14 Latin American currencies)

3. **Scanning**:
   - ✅ Barcode scanning support
   - ✅ QR code scanning support
   - ✅ Manual card ID entry
   - ✅ No client search on scanner home (scanner-focused)

4. **Transaction Flow**:
   - ✅ Add stamps/points, redeem rewards, apply discounts
   - ✅ Simplified confirmation modal (card type, action, comment only)
   - ✅ **Mandatory comment field** with asterisk indicator
   - ✅ Post-transaction: return to scanner home after "Listo"

5. **Stamp Cards**:
   - ✅ 10 stars displayed by default
   - ✅ Stars fill progressively based on active stamps
   - ✅ Show only "X sellos activos" (no confusing "2/12" format)
   - ✅ Multi-reward tier selection (when configured in Boomerangme template)
   - ✅ **Support for all 3 program types:**
     - **Sellos** (stamps): Manual stamp entry
     - **Visita** (visit): Per-visit stamps (auto-detected)
     - **Gastar** (spend): Spend-based stamps (auto-detected)

6. **Cashback Cards**:
   - ✅ Show balance in currency (not percentage) in Agregar view
   - ✅ Show balance in currency in Canjear view (fixed January 18, 2026)
   - ✅ Button renamed from "Agregar puntos" to "Agregar Cashback"
   - ✅ Transaction confirmation display

5. **Language**:
   - ✅ **Spanish** as primary language throughout entire app

6. **Branding**:
   - ✅ Devotio Rewards logo
   - ✅ Dark purple theme (#120627)
   - ✅ Figtree typography

7. **Mobile Responsiveness**:
   - ✅ All pages optimized for mobile (tested on iPhone SE 375x667)
   - ✅ Touch-friendly buttons and controls
   - ✅ Proper viewport configuration

8. **Currency Selection**:
   - ✅ User-selectable currency in Settings
   - ✅ 14 supported currencies (CRC, USD, EUR, MXN, COP, PEN, ARS, CLP, GTQ, HNL, NIO, PAB, DOP, BRL)
   - ✅ Currency persists per user

### Card Types Supported (All P0 Bugs Fixed - January 15, 2026)
All 8 Boomerangme card types now correctly recognized and rendered:
- ✅ **Stamp** (type ID 0) - Shows stamp grid, Agregar/Canjear tabs, subtract-reward endpoint, multi-tier reward selection
- ✅ **Cashback** (type ID 1) - Shows cashback %, purchase amount input, subtract-point endpoint
- ✅ **Multipass/Subscription** (type ID 2) - Shows Agregar/Canjear tabs, add-visit/subtract-visit endpoints
- ✅ **Coupon** (type ID 3) - Shows single "Usar" tab, redeem-coupon endpoint
- ✅ **Discount** (type ID 4) - Shows discount %, purchase amount input, add-point endpoint
- ✅ **Gift/Certificate** (type ID 5) - Shows balance, Agregar/Canjear tabs, add-point/subtract-point endpoints
- ✅ **Membership** (type ID 6) - Shows visits, Agregar/Canjear tabs, add-visit/subtract-visit endpoints
- ✅ **Reward** (type ID 7) - Shows reward tiers, add-scores/receive-reward endpoints

## What's Been Implemented

### Session 10 - Gerente Attribution & Operations History (January 26, 2026)
1. **Gerente (Manager) Transaction Attribution**
   - All card transaction endpoints now include `gerente` field in request payload
   - Scanner app user's name automatically sent with every transaction
   - Comment sent to Boomerangme includes `[Gerente: Name]` prefix for tracking
   - Local operations log stored in MongoDB with full gerente attribution

2. **New Operations/History Page (`/operations`)**
   - New menu item "Operaciones" added between "Inicio" and "Configuración"
   - Displays transaction history table with columns:
     - Fecha, Cliente, Tarjeta, Operación, Monto, Saldo, Compra, **Gerente**, Nota
   - Mobile-responsive: table on desktop, card layout on mobile

3. **Operations Filtering System**
   - Date range filter (start/end dates)
   - Gerente dropdown (filter by specific user)
   - Operation type dropdown (stamps, rewards, etc.)
   - "Aplicar filtros" button to apply selected filters
   - "Limpiar filtros" to reset

4. **Export Functionality**
   - **CSV Export**: Downloads `operaciones_YYYY-MM-DD.csv` with Spanish headers
   - **XLSX Export**: Downloads `operaciones_YYYY-MM-DD.xlsx` with styled Excel file
   - Both exports respect current filter settings

5. **New Backend Endpoints**
   - `GET /api/operations` - List operations with pagination and filtering
   - `GET /api/operations/export?format=csv|xlsx` - Export operations
   - `GET /api/operations/summary` - Get summary statistics by gerente

6. **Technical Details**
   - Boomerangme API doesn't accept `managerId` parameter via API
   - Solution: Use comment field for Boomerangme attribution + local MongoDB logging
   - All 14 card action endpoints updated to log operations with gerente

7. **Backend Refactoring Complete**
   - Refactored monolithic `server.py` (1602 lines → 61 lines)
   - New modular structure:
     - `/routes/auth.py` - Authentication (register, login, me)
     - `/routes/cards.py` - All card actions (14 endpoints)
     - `/routes/operations.py` - Operations history & export
     - `/routes/settings.py` - User settings
     - `/routes/templates.py` - Template fetching
     - `/routes/customers.py` - Customer search
     - `/utils/config.py` - Database & API configuration
     - `/utils/auth.py` - JWT & password utilities
     - `/utils/boomerang.py` - Boomerang API client & helpers
     - `/models.py` - Pydantic request/response models

### Session 9 - Multi-Program Support & Reward Selection (January 25, 2026)
1. **New Backend Endpoint: `/api/templates/{template_id}`**
   - Fetches template data from Boomerangme API
   - Returns reward tiers configuration (`rewardTiers` array)
   - Each tier includes: id, name, threshold (stamps needed), value

2. **Multi-Reward Selection UI for Stamp Cards**
   - Frontend displays card-selection UI when `availableRewardTiers` exists
   - Shows reward name and stamp threshold (e.g., "Cafe Gratis - A los 10 sellos")
   - Falls back to simple button when no tiers configured
   - Purchase amount input always available for LTV tracking

3. **Multi-Program Type Support for Stamp Cards (Auto-Detection)**
   - Backend now auto-detects the correct endpoint based on card configuration:
     - **Sellos** → `add-stamp` endpoint (manual stamps)
     - **Visita** → `add-visit` endpoint (per-visit stamps)
     - **Gastar** → `add-purchase` endpoint (spend-based stamps)
   - Handles "Irrelevant accrual type" errors gracefully with fallback
   - All program types support `purchaseSum` for LTV tracking
   - Appropriate success messages for each type (Spanish localized)

### Session 8 - P2 Fix & Refactoring (January 18, 2026)
1. **Fixed API Auth Status Codes (P2)**
   - Unauthenticated requests now return 401 instead of 403
   - Invalid tokens now return 401 instead of 403
   - Implemented custom HTTPBearer with auto_error=False

2. **Mandatory Comments Toggle Feature**
   - Added setting "Comentarios obligatorios" in Settings page
   - Toggle ON (default): Comment field shows asterisk, required validation
   - Toggle OFF: Comment field is optional
   - Persisted in backend settings

3. **Gift Card Consistency**
   - Both Agregar/Canjear tabs show same format with "Balance Total" label
   - Clean currency input (no +/- buttons)

4. **Currency Input UX Improvement**
   - Replaced +/- counter with clean currency input for cashback/gift cards
   - Better for entering large amounts (10000+)
   - Kept +/- counter for stamps/rewards (small numbers)

5. **Code Refactoring - ResultPage.js**
   - Reduced from 1583 to 1199 lines (~25% reduction)
   - Extracted CARD_TYPE_CONFIG to `/app/frontend/src/config/cardTypes.js`
   - Extracted StampGrid to `/app/frontend/src/components/cards/StampGrid.jsx`
   - Extracted ConfirmationModal to `/app/frontend/src/components/modals/ConfirmationModal.jsx`
   - Extracted SuccessModal to `/app/frontend/src/components/modals/SuccessModal.jsx`
   - Created index files for easy imports

### Session 7 - Cashback Currency Fix (January 18, 2026)
1. **Fixed Cashback Card Balance Display (P0)**
   - The balance was incorrectly divided by 100 (showing ₡1 instead of ₡104)
   - Root cause: Boomerangme API returns `balance.balance` already in currency units, NOT in cents
   - Removed `/100` division for cashback cards in both Agregar and Canjear tabs
   - Now correctly shows the total cashback accumulated (e.g., ₡104)
   - Updated `/app/frontend/src/pages/ResultPage.js` lines 934 and 1105-1108
   - Verified working with test card `591682-351-613`

### Session 6 - Discount Card & UI Fixes (January 15, 2026)
1. **Fixed Discount Card "Total acumulado" Calculation (P1)**
   - Now correctly calculates: `points = purchaseAmount * (discountPercentage / 100)`
   - Example: 10000 purchase at 1% = 100 points added to total
   - API multiplies internally by 100 for cents storage

2. **Updated Button Colors**
   - Light/white buttons (btn-secondary): active state now uses pink #ee478a
   - Dark buttons (btn-primary): active state now uses yellow #ffca32 with dark text

3. **PWA Configuration for Mobile**
   - Created manifest.json with app name "Devotio Scanner"
   - Updated index.html title and meta tags
   - Added apple-touch-icon and manifest link
   - App will show as "Devotio Scanner" when saved to home screen
   - Icon can be changed by replacing `/app/frontend/public/logo.png`

### Session 5 - Multipass/Subscription Fix (January 15, 2026)
1. **Fixed Multipass Card Type Handling (P0)**
   - Added `subscription` type to CARD_TYPE_CONFIG (Boomerangme API returns "subscription" not "multipass")
   - Implemented two-tab UI matching Boomerangme documentation:
     - **Visitas tab**: Shows visits balance, has "Agregar Visitas" and "Canjear Visitas" buttons
     - **Puntos tab**: Shows bonus points balance, has "Agregar Puntos" and "Canjear Puntos" buttons
   - **Critical fix**: Corrected endpoint mapping (counterintuitive API naming):
     - `add-visit` = SELL/ADD available visits (increases `currentNumberOfUses`)
     - `subtract-visit` = USE a visit (decreases `currentNumberOfUses`)
     - `add-scores` = ADD bonus points
     - `subtract-scores` = REDEEM bonus points (new endpoint added)
   - `currentNumberOfUses` = available visits (not used visits as name suggests)
   - Multipass actions no longer ask for purchase amount in confirmation modal
   - All actions verified working with correct balance updates

### Session 4 - P0 Bug Fix (January 14, 2026)
1. **Fixed Card Type Handling Bug (CRITICAL)**
   - Added `normalizeCardType()` function in ResultPage.js
   - Frontend now correctly handles Boomerangme API card types without `_card` suffix
   - Both real API cards (type: "discount") and demo cards (type: "stamp_card") work
   - All 8 card types now render correct UI components
   
2. **Enhanced Discount Card UI**
   - Shows discount percentage from `balance.discountPercentage`
   - Shows accumulated amount from `balance.discountAmount`
   - Purchase amount input with selected currency

3. **Improved Stamp Card Display**
   - Handles multiple balance field formats (`currentNumberOfUses`, `stamps`)
   - Stamp grid renders correctly with stars

### Previous Session Work
- Spanish localization
- QR + barcode scanning
- Mandatory comments in confirmation modal
- Customer name visible (PII masking updated)
- Devotio branding applied
- Mobile responsiveness
- Currency selection feature
- Boomerang API UAT key integration

## Code Architecture
```
/app
├── backend/
│   ├── .env              # BOOMERANG_API_KEY configured
│   └── server.py         # API with mock fallback for DEMO cards
├── frontend/
│   ├── public/
│   │   └── fonts/        # Figtree fonts, logo.png
│   ├── src/
│   │   ├── context/
│   │   │   ├── AuthContext.js
│   │   │   └── SettingsContext.js  # CURRENCIES array, formatCurrency
│   │   ├── pages/
│   │   │   └── ResultPage.js  # normalizeCardType() function added
│   │   ├── index.css     # Mobile-first CSS
│   │   └── App.js
│   └── package.json
├── tests/
│   └── test_scanner_api.py  # 15 backend tests
└── memory/
    └── PRD.md
```

## API Configuration

### Environment Variables
```bash
# /app/backend/.env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
BOOMERANG_API_KEY="542bcbc61866b65b2e63851267128679"  # UAT key
```

### Demo vs Real Cards
- **DEMO-*** cards: Always use mock data (for proposal demo)
- **Real cards**: Use Boomerang API with configured key (e.g., 955355-486-631)

## Demo Credentials
- **Email**: demo@devotio.com
- **Password**: demo123
- **Demo Cards**: DEMO-001 through DEMO-007
- **Real Test Card**: 955355-486-631 (Discount card)

## Testing Status
- `/app/test_reports/iteration_4.json` - P0 bug fix verification (100% pass)
- `/app/tests/test_scanner_api.py` - 15 backend tests created

## Deployment Readiness
- ✅ Mobile-responsive design
- ✅ Spanish language
- ✅ Branding applied
- ✅ API key configured
- ✅ Currency selection
- ✅ All 8 card types supported
- ✅ Multi-reward tier selection (when configured)
- ⏳ Production API key (replace UAT key when ready)

## Next Steps
1. **Final UAT Testing**: Test all 8 card types with real Boomerangme cards
2. **Configure Reward Tiers**: If needed, configure reward tiers in Boomerangme template to use multi-tier selection

## Key API Endpoints
- `GET /api/cards/{card_id}` - Get card data with balance info
- `POST /api/cards/{card_id}/add-stamp` - Add stamps (includes purchaseSum)
- `POST /api/cards/{card_id}/subtract-reward` - Redeem stamp card reward
- `GET /api/templates/{template_id}` - Get template with reward tiers *(NEW)*
- All action endpoints support `purchaseSum` for LTV tracking

## Test Cards for Verification
- **Multipass/Subscription**: `638920-251-210`
- **Discount**: `955355-486-631`
- **Coupon**: `312015-782-634`
- **Gift/Certificate**: `100541-970-624`
- **Reward**: `320292-721-660`
- **Stamp (new)**: `820551-447-797`
- **Stamp (used)**: `192362-969-247`
- **Membership**: `314919-560-256`
- **Cashback**: `591682-351-613`

## PWA Configuration
- App title: "Devotio Scanner" (for home screen shortcut)
- manifest.json configured for standalone PWA
- Apple touch icon configured (uses logo.png)
- To change the icon: replace `/app/frontend/public/logo.png` with your custom icon (recommended 512x512 PNG)

## Backlog (P2)
- Refactor server.py into smaller modules
- Refactor ResultPage.js into card-type components
- Multi-tenant admin panel
- Analytics dashboard
- Webhook integration
- App store publishing
- Phase 2 POS Integration Gateway (awaiting user decision)
