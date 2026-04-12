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

### Session 14 - UI Fixes for Membership & Multipass Cards (February 2, 2026)
1. **Fixed Membership Card Visit Display**
   - Changed from using `customerSubscription.balance` (incorrect value: 15) to `balance.currentNumberOfUses` (correct value: 7)
   - Membership cards now display visits the same way as Multipass cards
   - Avatar with initials, tier badge (Bronce), status indicator, and "Canjear Visita" action all working

2. **Fixed Multipass Card Redundant Text**
   - Removed redundant "X sellos activos" text from StampGrid component
   - Added `hideLabel` prop to StampGrid component
   - Added clear "X Visitas disponibles" display below the star grid for better UX

3. **Fixed Operations History Display for Legacy Data**
   - Added `formatAmount()` helper function in OperationsPage.js
   - Detects `receive-reward` operations with large tier IDs (>9999) and displays "N/A"
   - Prevents confusing tier ID numbers from showing in the "Monto" column

4. **Updated Files**
   - `/app/frontend/src/pages/ResultPage.js`: Fixed membership visit calculation
   - `/app/frontend/src/components/cards/StampGrid.jsx`: Added hideLabel prop
   - `/app/frontend/src/pages/OperationsPage.js`: Added formatAmount() helper

### Session 13 - Reward Card Accrual Mode Selection (February 1, 2026)
1. **Template-Based Accrual Mode Preferences**
   - Implemented database-backed preference storage per template ID
   - First-time setup: Shows selector with 3 options (Por Compra, Por Visita, Manual)
   - Subsequent scans: Automatically loads saved preference for that template
   - All cards using the same template share the same accrual mode

2. **New Backend Endpoints**
   - `GET /api/templates/{template_id}/accrual-mode`: Get saved preference
   - `POST /api/templates/{template_id}/accrual-mode`: Save preference to MongoDB

3. **Frontend Improvements**
   - Clean mode selector UI with icons and descriptions
   - Mode badge showing current mode with "Cambiar" option
   - Context-aware confirmation modal (shows "Visitas a Agregar" for visit mode)
   - Button text adapts: "Agregar Visita" for visit mode vs generic "Agregar Puntos"

4. **Why This Solution?**
   - Boomerangme API does NOT expose accrual program type in card/template data
   - All reward cards accept all 3 accrual types (spend, visit, scores)
   - The actual program type is a Boomerangme panel configuration not available via API
   - Our solution: User selects once per CARD, saved for all future scans

5. **Technical Details**
   - New MongoDB collection: `card_accrual_modes` (changed from template_accrual_modes)
   - Frontend: Modified useEffect in ResultPage.js to check DB preference by Card ID
   - Removed old unreliable auto-detection logic that tried zero-value transactions

6. **Purchase Amount Required for All Modes**
   - Visit mode: Now requires purchase amount + visit count
   - Manual mode: Now requires purchase amount + points to add
   - Spend mode: Already required purchase amount (unchanged)
   - Reward redemption (Canjear): Now requires purchase amount before selecting tier
   - All amounts logged to operations for reporting

### Session 12 - Reward Cards Accrual Modes (January 29, 2026)
1. **Multi-Mode Accrual System for Reward Cards**
   - Implemented UI selector with 3 accrual modes: "Por Compra", "Por Visita", "Manual"
   - **Spend Mode**: Only purchase amount field, points calculated by Boomerangme rules
   - **Visit Mode**: Visit counter only, points calculated per visit
   - **Manual Mode**: Both purchase amount and manual points fields

2. **New Backend Endpoints**
   - `POST /api/cards/{id}/add-purchase`: For spend-based accrual (reward/stamp cards)
   - `POST /api/cards/{id}/add-visit-reward`: For visit-based accrual
   - `POST /api/cards/{id}/add-points-auto`: Auto-detection endpoint (tries spend→visit→manual)

3. **Frontend Updates**
   - `/app/frontend/src/pages/ResultPage.js`: Added `accrualMode` state and mode selector UI
   - Updated `handleAction` to route to correct endpoint based on mode
   - Clean UI with mode-specific input fields and helpful descriptions

4. **Technical Details**
   - Spend mode calls Boomerangme `add-purchase` with `amount` (purchase value)
   - Visit mode calls `add-visit` with `visits` count
   - Manual mode calls `add-scores` with explicit `scores` value

### Session 11 - Card Type Tracking & Reporting Enhancements (January 29, 2026)
1. **Card Type Tracking in All Operations**
   - All transaction logs now include `card_type` (normalized key like "stamp", "cashback")
   - Also includes `card_type_label` (Spanish label like "Sellos", "Cashback")
   - Extracted from `card_data.type` during `log_operation()`
   - Historical operations without card_type remain as null

2. **Separate purchase_sum and redeemed_value Fields**
   - `subtract-reward` endpoint now correctly separates:
     - `purchase_sum`: Amount sent to Boomerangme API (mandatory)
     - `redeemed_value`: Optional internal tracking of reward monetary value
   - Both fields stored independently in operations collection

3. **Operations API Updates**
   - `GET /api/operations`:
     - Added `card_type` query parameter for filtering
     - Now returns `card_types` in filters list
   - `GET /api/operations/summary`:
     - Added `card_type` query parameter for filtering
     - Returns `by_card_type` aggregation data
     - Returns `card_types` in filters
   - `GET /api/operations/export`:
     - Added "Tipo de Tarjeta" column in CSV/XLSX
     - Added "Valor del Canje" column in CSV/XLSX
     - Supports `card_type` filter parameter

4. **Frontend Operations Page Updates**
   - **Historial Tab**:
     - Added "Tipo de tarjeta" dropdown filter in filter panel
     - Added "TIPO TARJETA" column in operations table
     - Added "VALOR CANJE" column in operations table
     - Mobile cards updated with card type badge and canje value
   - **Dashboard Tab**:
     - Added "Tipo de tarjeta" dropdown filter
     - Added new "Por Tipo de Tarjeta" section with aggregated counts
     - Dashboard filters now include card_type

5. **Technical Details**
   - Backend: `/app/backend/routes/operations.py` - Updated all 3 endpoints
   - Backend: `/app/backend/routes/cards.py` - Fixed subtract_reward to pass redeemed_value separately
   - Frontend: `/app/frontend/src/pages/OperationsPage.js` - Added filter, columns, and dashboard section
   - Test report: `/app/test_reports/iteration_7.json` - 100% pass rate
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

8. **Gerente Performance Dashboard**
   - Added sub-tabs to Operations page: [Historial] and [Dashboard]
   - Dashboard features:
     - **Summary Cards**: Total Operations, Total Sales (currency), Active Gerentes
     - **Gerente Leaderboard**: Ranked by transaction count with progress bars, shows sales volume
     - **Operations by Type**: Grid showing count per operation type (Sellos, Recompensas, etc.)
   - Date range filter for dashboard data
   - All UI in Spanish

9. **Multi-Tier Reward Timestamp Tracking**
   - New `rewards_earned` collection in MongoDB to track individual rewards
   - Auto-detects when new rewards are earned after stamp actions
   - Each reward tracked with:
     - Unique ID
     - Earned timestamp
     - Status (pending/redeemed)
     - Redemption info (when, by whom, value)
   - New API endpoints:
     - `GET /api/cards/{card_id}/pending-rewards` - List pending rewards (oldest first)
   - Updated stamp card "Canjear" tab UI:
     - Shows pending rewards list with timestamps
     - "Recompensa - Ganado: [fecha]" format
     - Selectable rewards (radio buttons)
     - Optional "Valor del canje" input for monetary value
   - Redemption flow marks specific reward as redeemed with timestamp

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
- **Membership**: `551608-563-657` *(NEW - for UI testing)*
- **Membership (legacy)**: `314919-560-256`
- **Discount**: `955355-486-631`
- **Coupon**: `312015-782-634`
- **Gift/Certificate**: `100541-970-624`
- **Reward (Visit mode)**: `896844-833-112`
- **Reward (Manual mode)**: `199706-114-876`
- **Stamp (new)**: `820551-447-797`
- **Stamp (used)**: `192362-969-247`
- **Cashback**: `591682-351-613`

## PWA Configuration
- App title: "Devotio Scanner" (for home screen shortcut)
- manifest.json configured for standalone PWA
- Apple touch icon configured (uses logo.png)
- To change the icon: replace `/app/frontend/public/logo.png` with your custom icon (recommended 512x512 PNG)

### Session 15 - Stamp Card Spend Mode: Partial Accumulation (March 30, 2026)
1. **Completed Partial Spend Accumulation for Stamp Cards (P0)**
   - Implemented local tracking of partial spends in MongoDB `stamp_progress` collection
   - When stamp mode is "spend" with threshold 10000: spending 5000 + 7000 = 12000 grants 1 stamp with 2000 remaining
   - Frontend `handleAction` in `ResultPage.js` now has dedicated flow for spend mode:
     - Calls `POST /api/stamp-progress/{card_id}/add?amount=X` first
     - If `stamps_to_add > 0`, sends stamps to Boomerangme API via `add-stamp`
     - Updates local progress bar and shows appropriate success messages
   - Spend mode: No manual stamp counter shown, only purchase amount input
   - Visit mode: Auto-sends 1 stamp per visit with purchase amount
   - Manual mode: Existing behavior (manual stamp count + purchase amount)
   - Confirmation modal now shows mode-specific details (e.g., "Por Compra (1 sello cada ₡10.000,00)")
   - All tests passed: 100% backend (12/12) and frontend (9/9 features verified)

2. **Updated Files**
   - `/app/frontend/src/pages/ResultPage.js`: handleAction spend/visit mode, openConfirmation mode details
   - `/app/backend/tests/test_stamp_spend_mode.py`: Automated test suite created by testing agent

### Session 15b - Bug Fix: Daily Limit Error Message (March 30, 2026)
1. **Fixed daily limit error showing wrong message**
   - Boomerangme returns "A visit has already been registered today." for daily limits
   - The word "already" was caught by the "already_redeemed" check before the "limit" check
   - Reordered `parse_api_error` in `boomerang.py` to check for "today"/"already been registered" BEFORE generic "already"
   - Now correctly shows "Límite de check-in diario alcanzado"
   - Also improved `add-stamp` endpoint to continue trying next endpoint on limit errors

2. **UAT Verification Pass - All Card Types (100% pass)**
   - Discount (185504-436-130): No hardcoded Bronce/Plata/Oro tier names ✅
   - Cashback (591682-351-613): Balance in currency (₡10.110), correct purchaseSum ✅
   - Membership (551608-563-657): Optional purchase amount, correct visit count ✅
   - Reward (896844-833-112): Mode selector persists, purchase required ✅
   - Stamp (353530-676-963): Dynamic grid, daily limit message, spend accumulation ✅

3. **Code Cleanup**
   - Removed dead `getTierStatus` function from ResultPage.js (hardcoded Bronce/Plata/Oro)

### Session 16 - Multi-Tenant Architecture (April 12, 2026)
1. **Phase 2 Multi-Tenant Backend**
   - Created `workspaces` collection: name, slug, boomerangme_api_key, locations, active
   - Updated `users` model: added workspace_id, location, new roles (super_admin, workspace_admin, operator)
   - Modified `call_boomerang_api` to accept dynamic API key per workspace
   - All card endpoints now use workspace-specific API key via `get_api_key` dependency
   - Legacy users without workspace_id fall back to global API key
   - Created `routes/workspaces.py` with full CRUD: create/list/update workspaces, manage users, locations

2. **Phase 2 Frontend Pages**
   - Redesigned `AdminSetupPage` (/admin/setup): Master code → Create workspace + sucursales + workspace admin
   - Created `WorkspaceAdminPage` (/admin/workspace): 4 tabs (General, Usuarios, Sucursales, API Key)
   - Updated login to return workspace_id, workspace_name, role
   - Added "Admin Workspace" menu item for workspace_admin/super_admin roles
   - Workspace admins can create operators, assign to locations, manage API key

3. **UAT Bug Fixes (this session)**
   - Fixed daily limit error: "A visit has already been registered today" → "Límite de check-in diario alcanzado"
   - Removed $ sign from reward tier values
   - Created discount/cashback tier configuration (Settings page)
   - Implemented local tier progress tracking for cashback cards (Boomerangme doesn't track discountAmount)
   - Fixed cashback % to use local tier percentage instead of Boomerangme's stale value

### Session 17 - Multi-Tenant Data Isolation Complete (April 12, 2026)
1. **Completed workspace_id isolation across ALL database collections (P0)**
   - `log_operation()` in `boomerang.py`: Now stores `workspace_id` from `current_user` in every operation record
   - `operations.py`: All 3 endpoints (`GET /operations`, `GET /operations/export`, `GET /operations/summary`) now filter by `workspace_id`
   - `settings.py`: `tier-progress` GET/POST now use workspace-scoped `discount_tiers` lookup instead of `{"type": "global"}`
   - `settings.py`: `stamp-progress` POST now stores `workspace_id` in progress records
   - `cards.py`: `detect_and_log_new_rewards()` now accepts and stores `workspace_id` in `rewards_earned` records
   
2. **Legacy Data Migration**
   - Migrated 116 operations, 8 rewards_earned records to "Devotio Default" workspace
   - All stamp_progress and tier_progress records already had workspace_id

3. **Testing Results**
   - `/app/test_reports/iteration_12.json`: 100% pass (12/12 backend, 4/4 frontend)
   - Verified: Demo user sees 116 ops, Cafe Demo user sees 0 ops (isolation confirmed)
   - Workspace admin page shows correct workspace info

### Session 17b - ResultPage.js Refactoring & Accrual Mode Fix (April 12, 2026)
1. **P1: Added `workspace_id` to `card_accrual_modes` endpoint**
   - GET/POST `/api/cards/{card_id}/accrual-mode` now filtered by workspace_id
   - Ensures accrual mode preferences are tenant-isolated

2. **P2: Major Refactoring of ResultPage.js (2425 → 524 lines, 78% reduction)**
   - Extracted 11 card-specific action components to `/components/cards/actions/`:
     - StampAddAction, StampRedeemAction, MembershipAction
     - MultipassVisitsAction, MultipassPointsAction
     - DiscountCashbackAction, RewardAddAction, RewardRedeemAction
     - CouponAction, GenericRedeemAction, DefaultAddAction
   - Extracted 5 shared UI primitives to `/components/cards/shared/`:
     - PurchaseAmountInput, AmountCounter, BalanceDisplay, ActionButton, CardInfoPanel
   - CustomerInfoPanel and CardInfoPanel extracted from inline JSX
   - ResultPage.js now acts as orchestrator: state + useEffects + tab routing + modals
   - Zero functionality changes — purely structural refactor

3. **Testing Results**
   - `/app/test_reports/iteration_13.json`: 100% pass (12/12 backend, 10/10 frontend)
   - Verified all card types: cashback, discount, membership, reward
   - Operations page, settings page, collapsible panels all working

## Backlog (P2)
- Refactor ResultPage.js into card-type components
- Analytics dashboard
- Webhook integration
- App store publishing
- Phase 2 POS Integration Gateway (awaiting user decision)
