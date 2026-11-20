# KŌJI (糀) — UI/UX Design System & Mobile POS Architecture Specification
> **Document Type:** Google Stitch Input Specification & Master Prompt Context  
> **Target Platform:** React Native / Expo (Android Mobile Portrait — Optimized for 360dp–412dp viewports)  
> **Application Domain:** Fast-Casual QSR / High-Volume Street-Food Cart Point of Sale (POS)  
> **Brand Identity:** Kōji — Asian Crafted Fusion  
> **Design Philosophy:** Organic Japanese-Craft Minimalism meets High-Speed Ergonomic Utility  

---

## 1. Product Identity & Operational Context

### 1.1 Brand Identity & Concept
**Kōji (糀 / 麹)** is an artisanal Asian Crafted Fusion mobile food cart brand serving handcrafted Sushi, Wok & Crisp dishes, Asian Noodles & Rice bowls, and artisanal Mocktails. The visual identity embodies contemporary Japanese craft aesthetics: deep forest greens, soft sage surfaces, crisp off-white canvas textures, warm amber/gold accents, and minimal, uncluttered layouts.

### 1.2 Operational Environment & Field Ergonomics
The POS software is deployed on Android mobile smartphones mounted on or operated by hand at an open-air food cart counter. This operational environment introduces unique, non-negotiable physical constraints:
* **High-Glare Outdoor Sunlight:** The application must remain 100% legible under intense direct sunlight. Low-contrast grey-on-white text, subtle pastels, or borderless flat cards cause catastrophic operational delays. The UI relies on stark contrast, deliberate dark green typography (`#0D381E`), high-contrast badge fills, and defined border contours.
* **One-Handed Mobile Operation:** Cashiers and cart chefs frequently operate the device single-handedly with their thumb while handling food packaging or customer cash with the other hand. Primary interactive elements, stepper controls, sticky bottom action bars, and modal buttons must reside within the natural thumb sweep zone.
* **Extreme Kitchen Speed & Glare-Proof Scanning:** In a 100-ticket lunch rush, the staff cannot read long paragraphs. They must scan and identify:
  1. **Token Numbers** (`#01`, `#02`, `#03`): Instantly recognizable in high-contrast warm amber pills.
  2. **Dietary Classification** (Veg vs. Non-Veg): Mandatory Indian regulatory dietary symbols (Green square/dot for vegetarian, Red square/triangle for non-vegetarian).
  3. **Payment State:** Clear distinction between unpaid orders requiring action (`Payment` in amber) and confirmed transactions (`✓ UPI` or `✓ Cash` in forest green).
  4. **Dish Fulfillment:** Individual item serving counters (`0/1 Done` -> `1/1 Done`) to prevent duplicate food preparation.
* **Accidental Tap Prevention:** Kitchen counters are humid and fast-moving. All touch targets must adhere to a minimum interactive footprint of **44dp × 44dp** (using `hitSlop` where visual pills are compact). Destructive actions (cancelling a dish, clearing cart) require confirmation dialogs.
* **Zero-Dependency Offline Reliability:** Fully resilient offline architecture powered by local AsyncStorage caching, direct deep-link thermal printing to 58mm Bluetooth/USB printers via RawBT, and direct WhatsApp customer notifications without external cloud dependencies.

---

## 2. Extracted Visual Design System (Exact Codebase Tokens)

All color tokens, typography scales, surface hierarchies, and spatial parameters below are extracted directly from `src/constants/theme.ts` and active component implementations.

### 2.1 Color Palette & Semantic Surface Hierarchy

| Token Name | Hex Code | Semantic Role & UI Application |
| :--- | :--- | :--- |
| **Primary Forest Green** | `#0D381E` | Core brand identity (`COLORS.forestGreen`, `COLORS.organic`). Primary headers, top navigation bars, brand typography, primary CTA buttons (`Mark Done`, `Review & Save`, `Print Station KOTs`), active tab backgrounds. |
| **Crisp Off-White Canvas** | `#F8F9F5` | Base background (`COLORS.cream`, `COLORS.ivory`, `COLORS.canvas`). Clean, glare-reducing, eye-friendly off-white canvas replacing stark harsh white. |
| **Sage Surface** | `#EDF2EC` | Card surface (`COLORS.sage`, `COLORS.cardBg`). Default surface for order ticket containers, input groupings, and elevated cards. |
| **Surface Light (Pure White)** | `#FFFFFF` | Form inputs, popups, thermal preview cards, dish cards, modal sheets (`COLORS.white`, `COLORS.surfaceLight`). |
| **Subtle Sage Tint** | `#E4EDE3` | Inactive icon containers, secondary button backgrounds, subtle divider lines (`COLORS.surfaceMuted`). |
| **Deep Forest Dark Surface** | `#0D381E` | Admin feature cards, dark modal headers, primary action pills (`COLORS.surfaceDark`). |
| **Dark Surface Hover** | `#082614` | Pressed state for primary forest green buttons (`COLORS.surfaceDarkHover`). |
| **Warm Amber / Gold Accent** | `#D78B30` | Active highlights (`COLORS.amber`, `COLORS.apricot`, `COLORS.accent`). Sequential token pills (`#01`), unpaid/due payment callouts, in-kitchen metric highlights, add-on batch tags. |
| **Warm Amber Soft Tint** | `#FEF6EB` / `#FDF1E2` | Background for unpaid payment pills, token badge backgrounds, warning cards. |
| **Muted Sage / Laurel Border** | `#8C9E91` | Secondary typography, default icon fills, inactive states, border outlines (`COLORS.laurel`, `COLORS.natural`, `COLORS.border`, `COLORS.textMuted`). |
| **Light Border Accent** | `#D3DFD5` | Card outlines, row dividers, subtle card separators (`COLORS.borderLight`). |
| **High-Contrast Text** | `#4A5E50` | Secondary body copy, timestamps, customer phone sub-labels (`COLORS.textSecondary`). |
| **Vegetarian Indicator Green** | `#2E7D32` | Standard regulatory green square & dot, completed order status badges (`COLORS.veg`). |
| **Vegetarian Soft Tint** | `#E8F5E9` / `#EBF6EC` | Completed item badge background, served counter backgrounds (`COLORS.vegBg`). |
| **Non-Vegetarian Red** | `#C62828` | Standard regulatory red square & triangle for meat/seafood dishes (`COLORS.nonVeg`). |
| **Non-Vegetarian Soft Tint** | `#FFEBEE` | Non-veg highlight backgrounds (`COLORS.nonVegBg`). |
| **Danger / Cancellation Red** | `#D32F2F` | Cancel item buttons, destructive dialogs, clear cart buttons (`COLORS.danger`). |
| **WhatsApp Brand Green** | `#25D366` | WhatsApp pickup notification icons, notified state badges. |
| **WhatsApp Soft Green** | `#DCF8C6` | Sent WhatsApp badge background fill. |
| **WhatsApp Dark Teal** | `#128C7E` | Unnotified pickup alert text and icon color. |
| **Thermal Paper Off-White** | `#FFFDF7` | 58mm visual receipt modal paper texture with `#E8E3D5` border. |
| **Modal Backdrop Overlay** | `rgba(13, 56, 30, 0.65)` | Semi-transparent deep forest green backdrop for modals and bottom sheets. |

### 2.2 Typography Scale & Text Styles

Kōji uses system sans-serif fonts (Roboto on Android, San Francisco on iOS) paired with tabular monospace fonts for receipts, pricing, and timing.

| Level | Size (sp) | Weight (`FONTS`) | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Brand Display** | 22sp | Heavy (`800`) | 24sp | Top Brand Header (`KŌJI`), letter-spacing: 0.8 |
| **Screen Title** | 18sp | Heavy (`800`) | 22sp | Admin Hub Welcome, Modal Titles |
| **Metric Value** | 18sp | Heavy (`800`) | 22sp | Total bill amount (`₹1020`), Shift Revenue |
| **Card Header / Large Token**| 16sp | Bold (`700`) | 20sp | Large Token Badges (`#01`), Section titles |
| **Dish Title (Menu)** | 14sp | Bold (`700`) | 18sp | Menu item card titles |
| **Sub-Header / Dialog Title** | 13.5sp | Bold (`700`) | 18sp | Payment selector header, Thermal preview header |
| **Action Pill / Button** | 12sp | Bold (`700`) | 16sp | `Edit Order`, `Payment`, `Mark Done ✓`, `✓ UPI` |
| **Item Name (Ticket)** | 12sp | Medium (`500`) | 16sp | Dishes in active ticket rows, customer names |
| **Body / Description** | 11sp | Regular (`400`)| 15sp | Dish culinary descriptions, cooking notes |
| **Micro Badge / Counter** | 10sp–10.5sp | Heavy (`800`)| 14sp | `0/1 Done`, `Cancelled`, `+ Add-on Batch`, `99+` |
| **Category Tab / Sub-label** | 9sp–10sp | Bold (`700`) | 12sp | Tab bar labels, NEXT TOKEN subtext |
| **Monospace Thermal Roll** | 11sp | Monospace (`Courier`)| 16sp | 58mm 32-column plain text print engine & preview |

### 2.3 Spacing, Radii & Depth Tokens

* **Spacing Grid (`SPACING`):**
  * `xs`: 4dp (icon-to-text gaps, tight micro-padding)
  * `sm`: 8dp (row margins, standard button internal padding)
  * `md`: 12dp (card inner padding, list item gaps)
  * `lg`: 16dp (screen horizontal margins, modal padding)
  * `xl`: 20dp (section spacing)
  * `xxl`: 24dp (prominent header gaps)
  * `xxxl`: 32dp (bottom safe list spacers)
* **Corner Radii (`borderRadius`):**
  * `4dp`: Monospace thermal slip preview card.
  * `6dp–8dp`: Token badges (`sm`/`md`), compact action buttons (`Edit Order`, `Payment`, `Mark Done`).
  * `10dp–12dp`: Dish card thumbnails, search input bars, bottom sheet buttons, item counter badges.
  * `14dp–16dp`: Standard order ticket cards, historical order cards, elevated admin feature cards.
  * `18dp–22dp`: Modal dialog cards, top category filter pills, bottom navigation tab items.
  * `999dp (Fully Pill)`: Category filter pills, status pills (`Done`, `✓ Paid`).
* **Shadows & Elevation:**
  * **Level 1 (Subtle Card Elevation):** `elevation: 2`, `shadowColor: '#000'`, `shadowOffset: { width: 0, height: 1 }`, `shadowOpacity: 0.05`, `shadowRadius: 3`.
  * **Level 2 (Active CTA & Floating Bottom Bar):** `elevation: 4`, `shadowColor: '#0D381E'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.15`, `shadowRadius: 8`.
  * **Level 3 (Modal Sheet Backdrop):** `elevation: 8`, `shadowColor: '#0D381E'`, `shadowOffset: { width: 0, height: 8 }`, `shadowOpacity: 0.25`, `shadowRadius: 16`.

---

## 3. Screen-by-Screen UI Architecture & Component Inventory

```
+---------------------------------------------------------------------------------+
|                               KŌJI APP SHELL                                    |
|   [ Brand Header: Logo + "KŌJI" + Subtitle + Next Token Badge / Reset Action ]   |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  [TAB 1: TAKE ORDER]          [TAB 2: TIMELINE]           [TAB 3: ADMIN HUB]    |
|  * Live Menu Search           * Shift Metrics Banner      * Ops Overview Banner |
|  * Category Pills Bar         * Active vs All Sub-tabs    * Menu Management     |
|  * Dish Cards with Steppers   * Search by Token/Name      * Add New Dish Form   |
|  * Floating Cart Action Bar   * Order Ticket Cards        * CSV Export Reports  |
|  * Checkout Bottom Sheet        - Header (Token/Print/₹)  * Orders History      |
|                                 - Action Row (Edit/Pay)     - Date Filter Pills |
|                                 - Customer / WhatsApp       - Summary Stats Row |
|                                 - Dishes with Progress      - Historical Cards  |
|                                 - Add-on Batch Dividers     - 1-Tap Dual Prints |
+---------------------------------------------------------------------------------+
|               BOTTOM DOCK: [ Utensils: Take Order ] [ Clipboard: Timeline (3) ] [ Settings: Admin ]             |
+---------------------------------------------------------------------------------+
```

---

### 3.1 Tab 1: Take Order Screen (`src/screens/TakeOrderScreen.tsx`)
The high-speed order creation station. Cashiers enter customer orders in seconds.

1. **Brand Header Bar (`BrandHeader.tsx`):**
   * Left: Circular logo badge (36x36dp, `#FFFFFF` with `#0D381E` border), Brand Title `KŌJI` (22sp Heavy `#0D381E`), Subtitle `Asian Crafted Fusion` (11sp `#8C9E91`).
   * Right: Next Token container displaying `NEXT TOKEN` tracking label above an apricot `TokenBadge` (e.g., `#01`), plus an optional circular reset cart button (`RotateCcw` icon).
2. **Search & Filter Bar:**
   * Compact 42dp height input (`#FFFDF7` with `rgba(159, 136, 111, 0.4)` border).
   * Search icon on the left, clear button (`X`) on the right. Live filters dish title, category, and culinary description.
3. **Horizontal Category Bar (`CategoryBar.tsx`):**
   * Single-line horizontal scroll container.
   * Pill chips: `All`, `Sushi`, `Wok & Crisp`, `Rice & Noodles`, `Mocktail`.
   * Active state: Solid `#0D381E` background, cream text, soft shadow. Inactive state: `#FFFDF7` background, `#D3DFD5` border, organic dark green text.
4. **Menu Item Card (`MenuItemCard.tsx`):**
   * Container: View component with white surface, 12dp border radius, 1.2dp subtle border. Tapping card background does **not** inadvertently increment quantity.
   * Left: 76x76dp rounded dish photo thumbnail with fallback `Utensils` icon. If `isAvailable === false`, displays dark semi-transparent `SOLD OUT` overlay.
   * Right Content Stack:
     * Row 1: `VegBadge` (14x14dp regulatory indicator) + Dish Name (14sp bold `#0D381E`, 1 line truncated) + optional `Sold Out` chip.
     * Row 2: Dish description (11sp `#8C9E91`, max 2 lines).
     * Row 3: Price in bold Forest Green (`₹280`) + Right-aligned Stepper.
       * If quantity = 0: Compact `+ ADD` button (`#0D381E` border and text).
       * If quantity > 0: High-contrast stepper `[ - ]` (Forest Green circle), quantity number (`12sp bold`), and `[ + ]` (Forest Green circle).
5. **Persistent Bottom Cart Summary Bar:**
   * Anchored immediately above the bottom navigation tabs with elevation shadow.
   * Left: Shopping bag icon + item count pill (`2 items`) + Total amount in large bold `#0D381E` (`₹560`).
   * Right: High-contrast CTA button `Review & Save` (Forest Green background, Ivory text, Arrow right icon).
6. **Checkout Modal Bottom Sheet (`CheckoutModal.tsx`):**
   * Slide-up modal card over dark forest overlay.
   * Header: Order token badge + `Review Order` title.
   * Itemized bill summary list with unit price and line subtotals.
   * Customer Fields:
     * Customer Name input with returning-customer autocomplete suggestion dropdown.
     * 10-digit Customer Phone input (enables WhatsApp notification dispatching).
   * Quick Chef Cooking Notes: Freeform input accompanied by one-tap chip pills: `Extra Spicy 🌶️`, `Mild / Less Spicy`, `No Onion/Garlic`, `Pack Separately 🥡`, `Less Ice 🧊`, `Extra Sauce`.
   * Toggle row: "Auto-print Station KOTs via RawBT" (remembers cashier preference in AsyncStorage).
   * Confirm button: `Save Order to Kitchen (₹[total])`.

---

### 3.2 Tab 2: Shift Order Timeline (`src/screens/OrderListScreen.tsx`)
The live kitchen dispatch board and shift timeline. Displays strictly current calendar day orders (`isOrderFromToday`), preventing historical clutter.

1. **Shift Metrics Summary Card:**
   * Header: "Today's Shift" label + live formatted date (`Nov 20, 2026`).
   * 3-Column Metric Matrix:
     * Column 1: `Total Orders` (count of all tickets created today).
     * Column 2: `In Kitchen` (count of active preparing orders, highlighted in Warm Amber `#D78B30`).
     * Column 3: `Shift Revenue` (gross rupee sum of all today's orders in `#0D381E`).
2. **Segmented Sub-Tabs & Timeline Search:**
   * Pill-switch tabs: `Active Orders ([count])` vs. `All Orders ([count])`.
   * Quick filter search bar: filters active shift tickets by Token (`#01`), Customer Name, Phone, or Dish.
3. **Order Ticket Card Anatomy:**
   * **Visual Hierarchy:**
     * Active/Preparing cards feature a warm amber-tinted border (`#D78B30`) or sage elevation.
     * Completed cards feature subtle muted borders with clean green checkmarks.
   * **Card Header Row:**
     * Left: Prominent Token Badge (`#01`, size `lg`, Warm Amber `#D78B30`) + Clock icon with time (`1:59 PM`).
     * Right: `Print` utility button (Printer icon, opens print dispatcher) + Total Amount (`₹1020` in 18sp Heavy `#0D381E`) + red/amber `Due: ₹[amount]` badge if balance exists.
   * **Primary Action Bar Row (`[ Edit Order ] [ Payment Pill ] [ Order Status ]`):**
     * `[ ✎ Edit Order ]`: Left pill (`flex: 1`, height 36dp). Opens live order editor to add new dishes or cancel items.
     * `[ Payment Pill ]`: Center pill (`flexShrink: 0`, height 36dp).
       * **Unpaid State:** Label is simply **`"Payment"`** with a `Wallet` icon (`#B86815`) and crisp amber border (`#D78B30`).
       * **Paid State:** Directly displays **`"✓ UPI"`** or **`"✓ Cash"`** on a `#E2EFE6` badge with `#0D381E` text.
       * **Tap Behavior:** Opens the 2-button payment modal (`[ 📱 UPI ]` / `[ 💵 Cash ]`). Tapping a paid pill allows switching between payment modes if recorded incorrectly.
     * `[ Order Status ]`: Right action pill (`flex: 1`, height 36dp).
       * **In-Progress:** Solid Forest Green button **`Mark Done ✓`**.
       * **Completed:** Soft Green badge **`Done [hh:mm AM/PM]`** with `CheckCircle2` icon.
   * **Customer Row & WhatsApp Notification Pill:**
     * Left: `👤 [Name]  📞 [Phone]` (phone is tappable with one-click dialer intent).
     * Right: Order-level **`Notify Ready`** WhatsApp button (`#128C7E` text, `MessageCircle` icon). When tapped, dispatches WhatsApp pickup text to customer and transitions into a green **`✓ Notified`** badge (`#25D366`).
   * **Itemized Dish Rows:**
     * Left: Regulatory `VegBadge` (15x15dp) + Quantity (`1x` bold Forest Green) + Dish title (minimum font scale 0.88 to prevent ellipsis clipping).
     * Right: Ultra-compact button cluster:
       * **Progressive Done Counter:** Compact pill (`height: 24dp`). Shows `0/1 Done`. Tapping increments served dishes (`1/1 Done`), turning green with a checkmark.
       * **Cancel Action:** Minimal `[✕ Cancel]` button (`height: 24dp`) to void a dish without re-creating the entire ticket.
       * **Single Dish WhatsApp Alert:** Mini `💬` icon button. Dispatches dish-specific alert ("Your California Avocado Roll is ready!").
   * **Add-On Batch Section Divider:**
     * When extra dishes are added to an active ticket via "Edit Order", they are rendered strictly below an inline divider:
       `── Added Items (hh:mm AM/PM) ──`
     * Newly added dishes have their own fresh `0/1 Done` counters and `+ Add-on Batch` chips.
   * **Cooking Notes Callout:**
     * Amber-tinted callout container with note icon for chef special requests (`"Less ice in mocktail"`).

---

### 3.3 Tab 3: Admin & Cart Management Hub (`src/screens/AdminScreen.tsx`)
Operations, reporting, menu catalog management, and full historical order lookup.

1. **Admin Hub Landing (`hub`):**
   * Top Operations Overview banner showing total menu items and all-time recorded orders with `Sparkles` icon.
   * 4 Elevated Feature Tiles (Dark/Sage elevated geometry, chevron navigation):
     * **Tile 1: Menu Management:** View dishes, update prices, change descriptions, toggle availability (`Available` vs. `Sold Out`).
     * **Tile 2: Add New Dish:** Publication form with mandatory category selection, dish name, price in ₹, veg/non-veg toggle, and description.
     * **Tile 3: Export Reports:** Professional CSV generation with separated customer columns (`Customer Name`, `Contact Number`), escaped multi-line dish cells, and presets (`Today`, `7 Days`, `30 Days`, `Custom Range`).
     * **Tile 4: Orders History:** Comprehensive historical shift and date order lookup.
2. **Orders History Sub-Screen (`all_orders`):**
   * **Sub-Header Navigation:** `[ ← Back to Hub ]` on the left, `Orders History` title on the right.
   * **Search Bar:** Input with placeholder `Search by token, customer, phone, dish...` and clear button.
   * **Horizontal Date Filter Pills:** Scrollable filter row: `All Time`, `Today`, `Yesterday`, `Custom Date` (triggers `DatePickerModal`).
   * **Summary Stats Line:** Directly beneath filter pills, displaying live metrics for the filtered view:
     `Total Orders: [count]  •  Revenue: ₹[filteredTotalRevenue]`
     Numbers are rendered in bold `#0D381E` for instant financial visibility.
   * **Historical Order Cards:**
     * **Top Row:** Token pill (`#04`, Apricot) and stacked Time (`1:59 PM`) + Date (`Nov 19, 2026`) on the left; Total Amount (`₹1020` in 16sp Heavy) and `Done` status pill on the right.
     * **Customer Row:** `👤 [Customer Name]  📞 [Phone]` on the left; Payment badge (`✓ Cash` or `✓ UPI`) on the right.
     * **Itemized Dishes:** Clean rows showing `VegBadge`, `1x`, dish name, `(Add-on)` tag if applicable, and right-aligned line price (`₹220`).
     * **Dual Bottom Action Buttons:**
       * `[ 🧾 Print Customer Bill ]`: Outlined button (`#0D381E` border and text). Dispatches 58mm customer receipt via RawBT.
       * `[ 🖨️ Print Station KOTs ]`: Solid `#0D381E` Forest Green button with cream text. Dispatches split station KOT slips via RawBT.

---

### 3.4 Modals & Bottom Sheets

1. **Live Edit Order Modal (`EditOrderModal.tsx`):**
   * Slide-up sheet with fixed header (`Edit Order #[token]`).
   * Section 1: Current items with quantity steppers (`- / +`) and trash icon. Decrementing or removing is automatically locked for items already served (`servedQuantity > 0`).
   * Section 2: "Add More Dishes" catalog with live search. Tapping `+ Add` creates an independent add-on batch stamped with `addedAt: nowIso` and `isAddon: true`.
   * Sticky Footer: Safe-area anchored container with full-width CTA:
     `Save Ticket Changes • Total: ₹[total] (Due: ₹[due])`
2. **Payment Mode Selector (`PaymentModal.tsx`):**
   * Compact dialog card over forest green overlay.
   * Displays outstanding balance due (`AMOUNT TO COLLECT: ₹[amount]`).
   * 2 High-Contrast Action Buttons:
     * **[ 📱 UPI ]**: Smartphone icon, Forest Green badge, subtitle "GPay / PhonePe / Paytm / QR".
     * **[ 💵 Cash ]**: Banknote icon, Warm Amber badge, subtitle "Physical cash counter payment".
   * Selecting either button immediately sets `paymentStatus = 'Completed'`, `amountPaid = totalAmount`, `balanceDue = 0`, and records the payment method.
3. **58mm Thermal Receipt Visual Preview Modal (`ThermalReceiptPreviewModal.tsx`):**
   * High-craft off-white thermal paper card simulation (`#FFFDF7` background, 270dp fixed paper width, subtle drop shadow, dashed scissor tear line).
   * Exact 1:1 monospace text rendering matching RawBT thermal printer output with zero bracket tags.
   * `allowFontScaling={false}` and letter-spacing locks ensure thermal rolls never misalign on Android devices with large system fonts.
   * Bottom button: `Print Now (via RawBT)`.
4. **Print Station Dispatcher Modal (`PrintOrderModal.tsx`):**
   * Detected active station pills: `VEG SUSHI KOT`, `NON-VEG SUSHI KOT`, `WOK & KITCHEN KOT`.
   * One-tap actions: `Print Split Station KOTs` (formats individual slips with tear guidelines), `Print Customer Receipt`, and `Preview 58mm Slip`.

---

## 4. Current UI Pain Points & Redesign Goals for Google Stitch

Google Stitch should preserve **100% of the functional capabilities, data structures, and workflows**, while elevating the visual polish, spatial ergonomics, and component craft.

### 4.1 Pain Point 1: Horizontal Crowding on Narrow Viewports (360dp–380dp)
* **Problem:** On compact Android devices, the 3-button ticket action bar (`[ Edit Order ] [ Payment ] [ Mark Done ✓ ]`) and the dish rows (`VegBadge + Qty + Title + [0/1 Done] + [✕ Cancel] + 💬`) compete for horizontal space, leading to dish title truncation or squished buttons.
* **Stitch Redesign Goal:**
  * Architect a responsive flex layout with strict minimum touch dimensions.
  * Re-proportion the action row into an ultra-cohesive segmented toolbar or ergonomic button group.
  * Design a dish row layout where action buttons (`Done`, `Cancel`, `WhatsApp`) occupy a dedicated, compact utility cluster with clear iconography, giving 60%+ width priority to dish names.

### 4.2 Pain Point 2: Visual Urgency & Station Contrast (Active vs. Completed)
* **Problem:** In a fast kitchen, the distinction between an urgent order waiting to be cooked, an order partially served, and a finished order waiting for customer pickup should be apparent from 3 feet away without reading fine print.
* **Stitch Redesign Goal:**
  * Introduce elevated card states for active kitchen tickets: distinctive warm amber corner accents, left status ribbons, or high-contrast card borders (`#D78B30`).
  * Ensure completed tickets recede gracefully with soft sage backgrounds, clean green checkmarks, and muted borders.
  * Clearly visually isolate live add-on batches with elegant bamboo/craft-style dividers.

### 4.3 Pain Point 3: Modernizing Micro-Interactions & Brand Craft
* **Problem:** While functional, standard React Native buttons can feel rigid. The Kōji brand has an organic, artisanal Japanese culinary identity that can be expressed through subtle craft details.
* **Stitch Redesign Goal:**
  * Elevate the bottom navigation dock into a modern floating or softly docked pill bar with refined active indicator states.
  * Introduce cohesive badge geometries: clean token lozenges, crisp veg/non-veg status marks, and modern receipt cards.
  * Enhance tactile affordances: button press states, subtle organic pill contours, and structured typography hierarchies.

---

## 5. Ready-to-Paste Google Stitch Master Prompt

Copy and paste the exact block below directly into **Google Stitch** to generate the redesigned screens, design tokens, and components:

```markdown
You are a Principal Mobile UI/UX Systems Architect and Design Technologist working on the official UI redesign for **Kōji (糀)**, a high-volume Asian Crafted Fusion food cart POS application built with React Native and Expo for Android.

### 1. OPERATIONAL CONTEXT & ERGONOMIC CONSTRAINTS
* **Device & Form Factor:** Android Mobile Portrait (Target viewports: 360dp to 412dp width, e.g., Samsung Galaxy A-series, Redmi Note).
* **Operating Environment:** Outdoor street-food cart counter. Severe sunlight glare, high humidity, fast-paced lunch rush. Operated single-handedly with one thumb.
* **Critical Design Mandates:**
  - High Contrast & Zero Glare Ambiguity: Stark dark-forest-on-ivory typography. No faint grey text on white.
  - Zero Accidental Taps: All interactive hit targets must be >= 44dp.
  - Ultra-Fast Glanceability: Token numbers (#01, #02), Veg/Non-Veg indicators, and Payment status must be readable in under 200ms from 2-3 feet away.

### 2. EXACT COLOR TOKENS & DESIGN SYSTEM
Use ONLY these exact color tokens and semantic surface mappings:
* **Primary Forest Green:** `#0D381E` (Headers, brand title, primary CTA buttons, active tabs, confirmed text)
* **Soft Sage Canvas:** `#F8F9F5` (Base glare-reducing off-white background canvas)
* **Card Surface (Sage):** `#EDF2EC` (Order ticket containers, elevated cards)
* **Surface Pure White:** `#FFFFFF` (Input fields, dish cards, modal sheets, popup dialogs)
* **Subtle Sage Tint:** `#E4EDE3` (Container fills, secondary button backgrounds)
* **Warm Amber / Apricot:** `#D78B30` (Token badges #01, unpaid dues, in-kitchen metric highlights, add-on tags)
* **Amber Soft Tint:** `#FEF6EB` (Unpaid payment pill background, token badge fill)
* **Muted Laurel Sage:** `#8C9E91` (Borders, secondary icons, inactive tabs)
* **Light Border:** `#D3DFD5` (Card borders, row dividers)
* **High-Contrast Text:** `#4A5E50` (Timestamps, secondary body text)
* **Vegetarian Green:** `#2E7D32` (Regulatory veg square & circle dot; soft bg: `#E8F5E9`)
* **Non-Vegetarian Red:** `#C62828` (Regulatory non-veg square & triangle; soft bg: `#FFEBEE`)
* **Cancellation Red:** `#D32F2F` (Cancel dish buttons, destructive actions)
* **WhatsApp Green:** `#25D366` (Customer notification badge; soft bg: `#DCF8C6`; teal header: `#128C7E`)
* **Thermal Paper Tint:** `#FFFDF7` (58mm receipt preview slip; border: `#E8E3D5`)
* **Modal Overlay:** `rgba(13, 56, 30, 0.65)` (Backdrop scrim)

### 3. TYPOGRAPHY & SPACING
* System Sans-Serif font weights: Regular (400), Medium (500), Semibold (600), Bold (700), Heavy (800).
* Tabular Monospace font for 58mm thermal receipts (strict 32 characters per line).
* Spacing Scale: 4dp (xs), 8dp (sm), 12dp (md), 16dp (lg), 20dp (xl), 24dp (xxl), 32dp (xxxl).
* Radii: 6-8dp (action pills/buttons), 12-16dp (cards/inputs), 20-24dp (modals/tabs), 999dp (category pills).

### 4. SCREEN BLUEPRINTS & COMPONENT INVENTORY TO REDESIGN

#### SCREEN 1: TAKE ORDER STATION (POS Menu & Cart)
* **Header:** KŌJI brand logo badge + Title + NEXT TOKEN (#01 in Amber pill) + Reset Cart button.
* **Search & Category Dock:** Search input with clear button + horizontal scrolling category pills (`All`, `Sushi`, `Wok & Crisp`, `Rice & Noodles`, `Mocktail`).
* **Menu Cards:** Dish photo thumbnail (76x76dp) + Veg/Non-Veg regulatory badge + Title + Description + Rupee Price (`₹280`) + Stepper (`+ ADD` or `[- qty +]`).
* **Floating Bottom Cart Dock:** Displays total items badge, bold total amount (`₹560`), and high-contrast CTA `Review & Save →`.
* **Checkout Bottom Sheet:** Itemized review + Customer Name (with autocomplete suggestions) + Phone number + Quick cooking note chips (`Extra Spicy 🌶️`, `Pack Separately 🥡`, `No Onion/Garlic`, etc.) + Auto-print toggle + `Save Order to Kitchen` CTA.

#### SCREEN 2: SHIFT ORDER TIMELINE (Active Kitchen Dispatch Board)
* **Shift Metrics Banner:** 3-column matrix: `Total Orders`, `In Kitchen` (Amber count), `Shift Revenue` (`₹[amount]`).
* **Timeline Controls:** Segmented tab switcher (`Active Orders` vs. `All Orders`, strictly current day) + Search bar.
* **Order Ticket Card:**
  - Header: Large Token badge (`#01`) + Timestamp (`1:59 PM`) + Print icon button + Total amount (`₹1020`) with Due callout if partial payment.
  - Primary Action Bar: 3-button compact row:
    1. `[ ✎ Edit Order ]`: Outlined button opening live edit modal.
    2. `[ Payment Pill ]`: When unpaid, labeled `"Payment"` with Wallet icon (`#B86815`) and amber border. When paid, labeled `"✓ UPI"` or `"✓ Cash"` in green. Tapping opens 2-option UPI/Cash selector.
    3. `[ Order Status ]`: Forest Green `"Mark Done ✓"` when active; Soft green `"Done 2:15 PM"` when completed.
  - Customer & WhatsApp Row: `👤 [Name]  📞 [Phone]` (with one-touch dialer) + Order-level `Notify Ready` / `✓ Notified` WhatsApp pill.
  - Dish Rows: VegBadge + Qty (`1x`) + Name + Compact `0/1 Done` counter (increments served quantity on tap) + `[✕ Cancel]` button + Mini `💬` WhatsApp button.
  - Add-on Divider: Clean `── Added Items (hh:mm AM/PM) ──` divider separating baseline dishes from incremental live edits.

#### SCREEN 3: ADMIN & ORDERS HISTORY
* **Sub-Header:** `[ ← Back to Hub ]` on left, `Orders History` on right.
* **Search & Filters:** Search by token, customer, phone, dish + Horizontal filter pills (`All Time`, `Today`, `Yesterday`, `Custom Date`).
* **Summary Stats Line:** High-visibility banner directly below pills: `Total Orders: [count]  •  Revenue: ₹[filteredTotalRevenue]` in bold `#0D381E`.
* **Historical Order Cards:**
  - Top row: Token badge (#04) + Stacked Time & Date on left; Total Amount (`₹1020`) + Status badge (`Done`) on right.
  - Customer row: `👤 [Name]  📞 [Phone]` on left; Payment badge (`✓ Cash` or `✓ UPI`) on right.
  - Itemized dishes: VegBadge + Qty (`1x`) + Dish Name + Subtotal (`₹220`).
  - Dual 1-Tap Action Buttons: `[ 🧾 Print Customer Bill ]` (outlined `#0D381E`) and `[ 🖨️ Print Station KOTs ]` (solid dark green `#0D381E`).

#### CORE MODALS
1. **Live Edit Order Modal:** Current ticket items with stepper decrement/increment and trash (locked if served > 0) + Add-on dishes catalog with search + Sticky footer button `Save Ticket Changes • Total: ₹[total] (Due: ₹[due])`.
2. **Payment Mode Selector:** Compact dialog with `[ 📱 UPI ]` (PhonePe/GPay/Paytm) and `[ 💵 Cash ]` (Counter cash), immediately clearing dues.
3. **58mm Thermal Receipt Preview Modal:** Simulated off-white paper roll (`#FFFDF7`, 270dp width, dashed tear line with scissor icon, strict 32-column monospace plain text) + `Print Now (via RawBT)` CTA.

### 5. DESIGN DELIVERABLES REQUESTED FROM STITCH
Provide complete, production-grade visual designs, layout compositions, responsive component structures, and React Native StyleSheet definitions that honor the Japanese craft minimalist aesthetic while optimizing touch ergonomics and sunlight contrast for mobile food cart operations.
```
