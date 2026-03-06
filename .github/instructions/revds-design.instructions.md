---
applyTo: '**/*.{html,scss,css,ts,tsx,jsx,vue,java,jsp}'
description: 'Revenue Design System (RDS) design standards, colour tokens, typography, accessibility, and application-type-specific guidance'
---

# Revenue Design System (RDS) Design Instructions

**Version:** RDS v20.0.1
**Reference:** [RDS Storybook](http://revds.revenuedomain.ie/?path=/docs/welcome-introduction--docs) | [Component Showcase](http://revds.revenuedomain.ie/?path=/story/design-system-showcase--default)

Revenue Design System is Revenue's single source of truth for design and development. It consists of working code, design tools and resources, human interface guidelines, and a Figma component library. **All application UIs — regardless of tech stack — must conform to these standards.**

When generating UI code or design output for any Revenue application, this file takes precedence over any generic or creative defaults. Do not apply experimental typography, creative colour palettes, or decorative UI patterns that deviate from the RDS system.

---

## Contents

1. [Revenue Design Principles](#1-revenue-design-principles)
2. [Colour System](#2-colour-system)
   - [2.1 Base Colours](#21-base-colours)
   - [2.2 Semantic Colour Mapping](#22-semantic-colour-mapping)
   - [2.3 Surface Colours](#23-surface-colours-neutral-scale)
   - [2.4 Colour Variation Ramps](#24-colour-variation-ramps)
3. [Typography](#3-typography)
   - [3.1 Font Family](#31-font-family)
   - [3.2 Semantic HTML Heading Hierarchy](#32-semantic-html-heading-hierarchy)
   - [3.3 Body & UI Text Scale](#33-body--ui-text-scale)
   - [3.4 RDS Typography Classes](#34-rds-typography-classes)
4. [Accessibility](#4-accessibility)
5. [Layout & Spacing](#5-layout--spacing)
6. [Component Library (PrimeNG)](#6-component-library-primeng)
7. [Internationalisation (i18n)](#7-internationalisation-i18n)
8. [Security](#8-security)
9. [Theming](#9-theming)
10. [Application-Type-Specific Guidance](#10-application-type-specific-guidance)
    - [10.1 Angular Web Apps](#101-angular-web-apps-primary--primeng)
    - [10.2 Java / Spring Boot](#102-java--spring-boot-server-rendered-jsp)
    - [10.3 BI Dashboards](#103-bi-dashboards-power-bi--tableau)
    - [10.4 Analytics Reports](#104-analytics-reports)
    - [10.5 Static / HTML Pages](#105-static--html-pages)
11. [AI / Frontend-Design Skill Integration](#11-ai--frontend-design-skill-integration)
12. [Key RDS Resources](#12-key-rds-resources)

---

## 1. Revenue Design Principles

All design decisions must be grounded in these 8 principles. Apply them when making layout, component, content, and interaction choices.

### 1. Start with Needs
Service design starts with identifying user needs. Do research, analyse data, talk to users. Don't make assumptions. Have empathy — what users ask for isn't always what they need.

### 2. Do the Hard Work to Make It Simple
Making something look simple is easy. Making something simple to use is much harder. Don't accept "it's always been that way." It's usually more work to make things simple, but it's the right thing to do.

### 3. Intuitive, Not Learned
Provide users with UI design options that are tried, tested, and easily understood. Use clear guidelines and consistent patterns so users don't need to learn the interface — they just understand it.

### 4. Be Consistent, Not Uniform
Use the same language and design patterns wherever possible. Consistency helps familiarity. Where uniformity isn't possible, ensure the approach is still internally consistent.

### 5. Direction Over Choice
Clarity inspires confidence. One hundred clear screens is preferable to a single cluttered one. Every screen should support a single action of real value to the user.

### 6. Do Less
If a pattern works, make it reusable and shareable. Don't reinvent the wheel. Prefer existing RDS components over custom solutions.

### 7. Unbreakable
Design so users can always navigate and recover. If something doesn't produce the expected result, make it obvious how to correct it.

### 8. This Is for Everyone
Accessible design is good design. Everything must be as inclusive, legible, and readable as possible. Consider users who most need our services — they are often those who find them hardest to use.

---

## 2. Colour System

All colours must use the RDS token names and hex values defined below. Do not introduce colours outside this system.

### 2.1 Base Colours

| Token | Hex | Usage |
|---|---|---|
| `base-brandteal` | `#005a5c` | Primary brand colour — headers, primary actions, key UI elements |
| `base-brandmint` | `#428f94` | Secondary brand colour — supporting elements, hover states |
| `base-cyan` | `#00c6c6` | Accent — use sparingly for highlights |
| `base-blue` | `#006fe6` | Informational, links, interactive states |
| `base-green` | `#155b25` | Success states |
| `base-red` | `#a51d2b` | Error, danger, destructive actions |
| `base-yellow` | `#ffc12c` | Warning states |
| `base-white` | `#ffffff` | Backgrounds, text on dark surfaces |

### 2.2 Semantic Colour Mapping

| Intent | Token | Hex |
|---|---|---|
| Primary / Brand | `base-brandteal` | `#005a5c` |
| Secondary | `base-brandmint` | `#428f94` |
| Success | `base-green` | `#155b25` |
| Warning | `base-yellow` | `#ffc12c` |
| Danger / Error | `base-red` | `#a51d2b` |
| Info / Links | `base-blue` | `#006fe6` |
| Neutral | surface scale | see §2.3 |

**NEVER** use colour as the sole means of conveying information. Always pair colour with text, icons, or other visual indicators.

### 2.3 Surface Colours (Neutral Scale)

| Token | Hex | Usage |
|---|---|---|
| `surface-50` | `#f4f4f4` | Page backgrounds |
| `surface-100` | `#f8f9fa` | Card backgrounds |
| `surface-200` | `#e9ecef` | Subtle section dividers |
| `surface-300` | `#dee2e6` | Borders |
| `surface-400` | `#ced4da` | Disabled states |
| `surface-500` | `#adb5bd` | Placeholder text |
| `surface-600` | `#6c757d` | Secondary text |
| `surface-700` | `#485057` | Body text (dark) |
| `surface-800` | `#343a40` | Headings on light backgrounds |
| `surface-900` | `#030507` | Near-black — maximum contrast |

### 2.4 Colour Variation Ramps

Use variation ramps for hover states, focus rings, backgrounds, disabled states, and data visualisation.

#### Brandteal Variations
| Token | Hex |
|---|---|
| `brandteal-lighten-10` | `#008c8f` |
| `brandteal-lighten-20` | `#00bdc1` |
| `brandteal-lighten-30` | `#00f0f5` |
| `brandteal-lighten-40` | `#28faff` |
| `brandteal-lighten-50` | `#5bfbff` |
| `brandteal-darken-10` | `#004042` |
| `brandteal-darken-20` | `#002728` |
| `brandteal-darken-30` | `#000e0f` |
| `brandteal-darken-40` | `#000000` |

#### Brandmint Variations
| Token | Hex |
|---|---|
| `brandmint-lighten-10` | `#56aeb3` |
| `brandmint-lighten-20` | `#79bfc3` |
| `brandmint-lighten-30` | `#9cd0d3` |
| `brandmint-lighten-40` | `#bfe0e3` |
| `brandmint-lighten-50` | `#e3f1f2` |
| `brandmint-darken-10` | `#326d71` |
| `brandmint-darken-20` | `#234b4d` |
| `brandmint-darken-30` | `#13292a` |
| `brandmint-darken-40` | `#030707` |

#### Cyan Variations
| Token | Hex |
|---|---|
| `cyan-lighten-10` | `#00f9f9` |
| `cyan-lighten-20` | `#2dffff` |
| `cyan-lighten-30` | `#60ffff` |
| `cyan-lighten-40` | `#93ffff` |
| `cyan-lighten-50` | `#c6ffff` |
| `cyan-darken-10` | `#009393` |
| `cyan-darken-20` | `#006060` |
| `cyan-darken-30` | `#002d2d` |
| `cyan-darken-40` | `#001414` |

#### Blue Variations
| Token | Hex |
|---|---|
| `blue-lighten-10` | `#1a89ff` |
| `blue-lighten-20` | `#4da3ff` |
| `blue-lighten-30` | `#80bdff` |
| `blue-lighten-40` | `#b3d8ff` |
| `blue-lighten-50` | `#e6f2ff` |
| `blue-darken-10` | `#0056b3` |
| `blue-darken-20` | `#003e80` |
| `blue-darken-30` | `#00254d` |
| `blue-darken-40` | `#000d1a` |

#### Green Variations
| Token | Hex |
|---|---|
| `green-lighten-10` | `#1f8436` |
| `green-lighten-20` | `#28ae47` |
| `green-lighten-30` | `#38d15b` |
| `green-lighten-40` | `#61db7d` |
| `green-lighten-50` | `#8be49f` |
| `green-lighten-60` | `#b4eec1` |
| `green-darken-10` | `#0b3214` |
| `green-darken-20` | `#071d0c` |
| `green-darken-30` | `#020803` |

#### Red Variations
| Token | Hex |
|---|---|
| `red-lighten-10` | `#d02536` |
| `red-lighten-20` | `#df4958` |
| `red-lighten-30` | `#e77480` |
| `red-lighten-40` | `#eea0a8` |
| `red-lighten-50` | `#f6cbd0` |
| `red-darken-10` | `#7a1520` |
| `red-darken-20` | `#4e0e14` |
| `red-darken-30` | `#230609` |
| `red-darken-40` | `#0d0203` |

#### Yellow Variations
| Token | Hex |
|---|---|
| `yellow-lighten-10` | `#ffd05f` |
| `yellow-lighten-20` | `#ffdf92` |
| `yellow-lighten-30` | `#ffeec5` |
| `yellow-lighten-40` | `#fff5df` |
| `yellow-darken-10` | `#f8af00` |
| `yellow-darken-20` | `#c58b00` |
| `yellow-darken-30` | `#926700` |
| `yellow-darken-40` | `#5f4300` |
| `yellow-darken-50` | `#2c1f00` |

---

## 3. Typography

### 3.1 Font Family

**Segoe UI** is the standard font for all Revenue internal-facing applications.

```scss
font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
```

- Do not use Inter, Roboto, Arial, or any other font family in Revenue applications
- Segoe UI provides consistency and excellent readability across all Windows-based environments

### 3.2 Semantic HTML Heading Hierarchy

Apply headings semantically — never skip levels. The heading level reflects page hierarchy, not visual size.

| Element | Size | Usage |
|---|---|---|
| `<h1>` | 35px | Entity name and ID — **not the application name** (e.g. "Revenue Workflow Portal - Case #12345") |
| `<h2>` | 28px | Major section headings |
| `<h3>` | 24.5px | Subsection headings |
| `<h4>` | 21px | Content group headings |
| `<h5>` | 17.5px | Minor headings |
| `<h6>` | 14px | Small headings |

**Rule:** The H1 on any page must represent the entity name and ID, not the application name. This improves accessibility and screen reader navigation.

```html
<!-- CORRECT -->
<h1>Revenue Workflow Portal - Case #12345</h1>
<h2>Case Details</h2>
  <h3>Tax Assessment</h3>
  <h3>Documentation</h3>
<h2>Actions Required</h2>

<!-- INCORRECT — skips levels, uses application name as H1 -->
<h1>My Application</h1>
<h3>Case Details</h3>
```

### 3.3 Body & UI Text Scale

| Element | Size | Usage |
|---|---|---|
| Paragraph | 16px | Standard body/content text |
| Label | 12px | Form field labels |
| Small Text | 14px | Supplementary or helper information |
| Extra Small | 12px | Secondary helper text (use sparingly) |
| Extra-Extra Small | 10.5px | Legal requirements and minimal supplementary content |

### 3.4 RDS Typography Classes

These utility classes are used for header navigation (especially with PrimeNG tab components). Apply to any HTML element while maintaining semantic meaning with proper heading tags.

| Class | Size | Weight | Line Height | Token |
|---|---|---|---|---|
| `rds-h1` | 21px | 600 | 32px | `$h4-600` |
| `rds-h2` | 14px | 600 | 22px | `$macro-2-600` |
| `rds-h3` | 17.5px | 600 | 26px | `$h5-600` |

**TabView:** Apply `rds-h2` class to `<p-tabView>` for consistent tab header styling.

```html
<p-tabView class="rds-h2">
  <p-tabPanel header="Details">...</p-tabPanel>
</p-tabView>
```

---

## 4. Accessibility

All applications — internal and public-facing — must be accessible. WCAG 2.1 compliance is mandatory.

### 4.1 Semantic HTML
- Use proper HTML elements for their intended purpose: `<button>` for actions, `<a>` for navigation, `<input>` for form fields
- Use landmark tags: `<header>`, `<main>`, `<nav>`, `<footer>`, `<section>`, `<aside>`
- Never attach `(click)` events to non-interactive elements like `<div>` or `<span>` — screen readers won't recognise them as interactive

### 4.2 Heading Hierarchy
- Never skip heading levels (e.g. do not jump from H1 to H3 with no H2)
- Headings must form a logical outline reflecting page hierarchy

### 4.3 ARIA
- ARIA attributes supplement or clarify element meaning — they do not replace correct semantic HTML
- Only add ARIA attributes when needed; semantically correct HTML reduces the need for them
- Do not add unnecessary ARIA attributes

### 4.4 Keyboard Navigation
- All interactive elements must be accessible and operable via keyboard alone
- Tab order must follow a logical visual flow
- The focused element must always be clearly visible with a visible focus ring

### 4.5 Colour Contrast
| Text type | Minimum ratio |
|---|---|
| Normal text | 4.5:1 |
| Large text (18px+ regular or 14px+ bold) | 3:1 |

The RDS colour system is pre-configured to meet these requirements. Do not override RDS colours with values that may fail contrast checks.

### 4.6 Images & Icons
- Images conveying information must have descriptive `alt` text
- Decorative images must have `alt=""` (empty string) so screen readers ignore them
- Icons used as interactive controls must have accessible labels

### 4.7 Skip Navigation
- Add "Skip to Content" links on pages with repeated navigation so keyboard users can bypass menus

### 4.8 Testing Requirements
- **Lighthouse** (built into Chrome DevTools) — run accessibility audits on every page
- **JAWS** screen reader — manual testing for complex interactions
- **Keyboard-only** navigation — test all user flows without a mouse

### 4.9 DO NOT
- Do not skip heading levels
- Do not make read-only elements interactable
- Do not add unnecessary ARIA attributes
- Do not use colour alone to convey information
- Do not rely solely on visual indicators for important states

---

## 5. Layout & Spacing

> The RDS Spacing and Layout foundations page is currently in progress. Until it is published, apply the following guidance.

- Use **PrimeNG's grid system** (`p-grid`, `p-col`) for page layouts in Angular applications
- Design for **responsive layouts** at minimum breakpoints: mobile (< 768px), tablet (768–1199px), desktop (≥ 1200px)
- Use consistent spacing based on a **4px base unit** (4, 8, 12, 16, 24, 32, 48, 64px)
- Prefer CSS Flexbox and Grid over absolute positioning
- Avoid fixed pixel widths for main content containers — use percentages or fluid grid columns
- Reference the [RDS Figma library](https://www.figma.com/design/54mLMOlYob2egO77uIyXt9/Project-Template--File?node-id=2248-38281) for spacing tokens and layout templates

---

## 6. Component Library (PrimeNG)

**Angular applications use PrimeNG v17** as the component library. All standard UI components (buttons, tabs, tables, dropdowns, dialogs, forms, etc.) must come from PrimeNG v17.

- All PrimeNG components are **available as pre-built Figma components** in the RDS Figma library — use these for prototyping and design handoff
- **Use existing components first** — don't build custom equivalents of components that PrimeNG already provides
- If a required component is missing from RDS, contact the RDS team before building custom alternatives (see [Contribution Guides](http://revds.revenuedomain.ie/?path=/docs/welcome-contribution-guides--docs))
- Reference [PrimeNG docs](https://primeng.org/) for the expected accessible behaviour of each component
- The RDS team performs a final QA from UI/UX and accessibility perspectives — build for this from the start

### 6.1 Icons
- Reference the RDS icon library via the [Icons foundations page](http://revds.revenuedomain.ie/?path=/docs/design-system-foundations-icons--docs)
- PrimeNG uses PrimeIcons — use these in preference to third-party icon libraries

---

## 7. Internationalisation (i18n)

All Angular applications must be configured for i18n. Text must not be hardcoded in templates.

### 7.1 Setup
Use `@ngx-translate/core` with the `TranslateModule`:

```typescript
import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './home.component.html',
})
export class HomeComponent {}
```

### 7.2 Translation Files
Place translation JSON files in `src/assets/i18n/`. Use a nested key structure:

```json
{
  "app": {
    "banner": "My Application Name",
    "heading": "Welcome"
  },
  "common": {
    "buttons": {
      "back": "Back",
      "save": "Save Changes",
      "submit": "Submit",
      "cancel": "Cancel",
      "search": "Search",
      "clear": "Clear",
      "delete": "Delete",
      "edit": "Edit"
    }
  },
  "validation": {
    "required": "{{field}} field is required",
    "invalidDate": "{{field}} is not a valid date"
  }
}
```

### 7.3 Template Usage
```html
<!-- Static text -->
<p>{{ 'app.heading' | translate }}</p>

<!-- With variable interpolation -->
<span>{{ 'validation.required' | translate: { field: 'forms.labels.name' | translate } }}</span>
```

---

## 8. Security

### 8.1 General Rules
- **Do not** store sensitive data in browser session storage
- **Do not** pass data from the backend to the frontend that should not be exposed to users
- Sanitise all user input — use Angular's built-in sanitisation, never bypass it
- Use Angular's `HttpInterceptor` for CSRF protection and API authentication headers

### 8.2 Public-Facing Application Security Pattern
Public-facing apps integrated with ROS must use the `UserDataHandover` flow:

1. ROS stores customer details via `UserDataHandover` service
2. ROS calls the Java backend with the `UserDataHandover` token
3. Java backend retrieves customer details using the token and stores them in session
4. Java backend redirects to the Angular app entry point
5. All Angular routes must be secured with a `ROSGuard`

```typescript
// Add ROSGuard to all routes
{
  path: 'your-route',
  canActivate: [ROSGuard],
  component: YourComponent
}

// Configure the guard URL in app.config.ts
const authServiceConfig: AuthServiceConfig = {
  apiUrl: '/your-app/api/userDetails',
};
```

---

## 9. Theming

RDS supports two themes:
- **Internal theme** — for Revenue staff-facing applications
- **External theme** — for public-facing applications (e.g. ROS-integrated apps)

The theme is configured automatically when using the `rev-angular-schematics` skeleton:

```bash
npm install -g rev-angular-schematics@latest
ng new [app-name] --collection=rev-angular-schematics
```

Differences between themes:
- Whether the external-theme CSS is applied
- Whether the header includes a sign-out link to ROS
- Whether there is a "Back to ROS" link on the page

Reference: [Theming guidelines](http://revds.revenuedomain.ie/?path=/docs/architecture-guidelines-theming--docs)

---

## 10. Application-Type-Specific Guidance

### 10.1 Angular Web Apps (Primary — PrimeNG)

**Stack:** Angular v18, PrimeNG v17, TypeScript, SCSS

**Project setup:**
- Always use `rev-angular-schematics` to scaffold new projects (not bare `ng new`)
- Use standalone components (not NgModules) unless explicitly required
- Use SCSS for all styling
- Enable strict TypeScript mode

**Directory structure** (from the Revenue skeleton):
```
src/app/
├── features/          ← lazy-loaded feature modules
└── shared/
    ├── components/    ← reusable UI components
    ├── directives/    ← custom Angular directives
    ├── model/         ← TypeScript interfaces & models
    ├── pipes/         ← custom Angular pipes
    ├── services/      ← shared services
    └── state/         ← state management utilities
```

**Key standards:**
- Lazy-load all feature routes (exception: error routes)
- Use functional route guards (`CanActivateFn`)
- Use `@ngx-translate/core` for all text — no hardcoded strings in templates
- Use `ROSGuard` for public-facing route protection
- Run Sonar analysis as part of every build
- Build on Jenkins (npm install → Sonar → npm build → docker build → docker push)

**Supported versions:**
| Angular | PrimeNG | RDS |
|---|---|---|
| v18 | v17 | v20 |

**Development tools:**
- VS Code with Angular Language Service, ESLint, Prettier extensions
- Chrome with Angular DevTools extension
- Lighthouse for accessibility audits

```typescript
// Lazy-loaded route example
export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(m => m.NotFoundComponent),
  }
];
```

---

### 10.2 Java / Spring Boot (Server-Rendered, JSP)

When building server-rendered pages (JSP or Thymeleaf) for Revenue applications:

**Visual parity with Angular apps:**
- Import and apply the same RDS colour tokens as CSS custom properties
- Use the same Segoe UI font stack
- Apply the same heading hierarchy (H1 = entity + ID, H2 = sections, etc.)
- Replicate PrimeNG component visual style where possible using RDS CSS classes

**Colour tokens in CSS:**
```css
:root {
  --color-brand-primary: #005a5c;    /* base-brandteal */
  --color-brand-secondary: #428f94;  /* base-brandmint */
  --color-success: #155b25;          /* base-green */
  --color-warning: #ffc12c;          /* base-yellow */
  --color-danger: #a51d2b;           /* base-red */
  --color-info: #006fe6;             /* base-blue */
  --color-bg-page: #f4f4f4;          /* surface-50 */
  --color-bg-card: #f8f9fa;          /* surface-100 */
  --color-text-body: #485057;        /* surface-700 */
  --color-text-heading: #343a40;     /* surface-800 */
}
```

**Font stack:**
```css
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 16px;
}
```

**Security:** Implement the same `UserDataHandover` + session-based authentication pattern. Never trust client-side state.

---

### 10.3 BI Dashboards (Power BI / Tableau)

When designing or building BI dashboard reports for Revenue:

**Colour palette — derive from RDS base and variation tokens:**

Primary sequence (for categorical data series):
1. `#005a5c` — brandteal (primary)
2. `#006fe6` — blue
3. `#155b25` — green
4. `#ffc12c` — yellow
5. `#428f94` — brandmint
6. `#a51d2b` — red
7. `#00c6c6` — cyan

Background: `#f8f9fa` (surface-100)
Grid lines: `#dee2e6` (surface-300)
Axis labels: `#6c757d` (surface-600)
Titles: `#343a40` (surface-800)

**Typography:**
- Title: Segoe UI, 16px, weight 600, colour `#343a40`
- Axis labels: Segoe UI, 12px, colour `#6c757d`
- Data labels: Segoe UI, 11px, colour `#343a40`
- Legend: Segoe UI, 12px, colour `#485057`

**Layout principles:**
- Keep dashboards focused — one primary KPI or insight per page (Direction over Choice principle)
- Use consistent header sections with application name and entity identifier
- Avoid decorative backgrounds, gradients, or non-data ink
- Align to the same spacing rhythm as web apps (4px base unit)

**Accessibility:**
- Never use colour alone to distinguish data series — add labels, patterns, or icons
- Ensure tooltip text meets 4.5:1 contrast ratio
- Provide text summaries of KPIs alongside charts

---

### 10.4 Analytics Reports

For analytics reporting interfaces and tabular report outputs:

**Chart colour sequences:**
- Use the RDS base colour ramp in order: brandteal → blue → green → yellow → brandmint → red → cyan
- For diverging scales: red-lighten-50 → surface-100 → green or blue
- For sequential scales: use a single hue variation ramp (e.g. brandteal-lighten-50 → base-brandteal → brandteal-darken-20)

**Tabular data:**
- Use surface-50 (`#f4f4f4`) for alternate row shading
- Use surface-300 (`#dee2e6`) for borders and dividers
- Header rows: surface-800 (`#343a40`) text on surface-200 (`#e9ecef`) background

**Page chrome:**
- Apply consistent header (application name, entity/report name)
- H1 = report or entity name
- Use Segoe UI throughout
- Include a "Generated: [date/time]" footer for printed/exported reports

---

### 10.5 Static / HTML Pages

For standalone HTML pages without Angular or a backend framework:

**Reference RDS tokens directly via CSS custom properties:**

```css
:root {
  /* Brand */
  --rds-brand-primary: #005a5c;
  --rds-brand-secondary: #428f94;

  /* Semantic */
  --rds-success: #155b25;
  --rds-warning: #ffc12c;
  --rds-danger: #a51d2b;
  --rds-info: #006fe6;

  /* Surface */
  --rds-bg-page: #f4f4f4;
  --rds-bg-card: #f8f9fa;
  --rds-border: #dee2e6;
  --rds-text-body: #485057;
  --rds-text-heading: #343a40;
  --rds-text-muted: #6c757d;

  /* Typography */
  --rds-font: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

body {
  font-family: var(--rds-font);
  font-size: 16px;
  background-color: var(--rds-bg-page);
  color: var(--rds-text-body);
}

h1 { font-size: 35px; color: var(--rds-text-heading); }
h2 { font-size: 28px; color: var(--rds-text-heading); }
h3 { font-size: 24.5px; color: var(--rds-text-heading); }
h4 { font-size: 21px; color: var(--rds-text-heading); }
h5 { font-size: 17.5px; color: var(--rds-text-heading); }
h6 { font-size: 14px; color: var(--rds-text-heading); }
```

---

## 11. AI / Frontend-Design Skill Integration

When using the `frontend-design` skill or any AI-driven UI generation in the context of Revenue applications, the following rules override the skill's default aesthetic behaviour:

### 11.1 Aesthetic Direction
Revenue applications are **government-grade, institutional, and user-first**. They are not platforms for creative experimentation.

- **Colour:** Use only RDS token values from §2. Do not introduce creative palettes, gradients, duotones, or non-RDS colours
- **Typography:** Use Segoe UI exclusively. Do not use Inter, Space Grotesk, Playfair Display, or any other display/experimental font
- **Motion:** Use minimal, purposeful animation only. No decorative animations, parallax, or scroll-triggered effects that are not functionally meaningful
- **Layout:** Prioritise clarity and predictability. Avoid asymmetric, grid-breaking, or overlapping layouts. Standard header/content/footer structure preferred
- **Backgrounds:** Use surface tokens for backgrounds. No gradient meshes, noise textures, grain overlays, or decorative backgrounds

### 11.2 Design Priority Stack
Apply design decisions in this order:
1. **Accessibility** — WCAG 2.1 is non-negotiable
2. **Consistency with RDS** — use existing components and tokens
3. **Clarity and usability** — direction over choice, one action per screen
4. **Visual coherence** — clean, professional, government-appropriate
5. **Aesthetic refinement** — only after all above are met

### 11.3 What "Good" Looks Like in Revenue UI
- Clean white/light-grey backgrounds (`surface-50`, `surface-100`)
- Brandteal (`#005a5c`) used for primary actions, navigation, and key structural elements
- High contrast text (`surface-800`, `surface-900`) on light backgrounds
- Consistent spacing rhythm (multiples of 4px)
- PrimeNG components styled with the RDS theme — not visually re-invented
- Typography that is legible, hierarchical, and screen-reader friendly
- Forms and tables that are dense with information but visually organised and scannable

### 11.4 Showcase Reference
When unsure about a component's intended appearance, refer to the live [RDS Component Showcase](http://revds.revenuedomain.ie/?path=/story/design-system-showcase--default) for the canonical look-and-feel.

---

## 12. Key RDS Resources

| Resource | URL |
|---|---|
| RDS Storybook | http://revds.revenuedomain.ie/ |
| Introduction | http://revds.revenuedomain.ie/?path=/docs/welcome-introduction--docs |
| Core Principles | http://revds.revenuedomain.ie/?path=/docs/welcome-core-principles--docs |
| Getting Started (Design Process) | http://revds.revenuedomain.ie/?path=/docs/design-system-getting-started--docs |
| Architecture Getting Started | http://revds.revenuedomain.ie/?path=/docs/architecture-guidelines-getting-started--docs |
| Accessibility | http://revds.revenuedomain.ie/?path=/docs/architecture-guidelines-accessibility--docs |
| Theming | http://revds.revenuedomain.ie/?path=/docs/architecture-guidelines-theming--docs |
| Security | http://revds.revenuedomain.ie/?path=/docs/architecture-guidelines-security--docs |
| Routing | http://revds.revenuedomain.ie/?path=/docs/architecture-guidelines-routing--docs |
| i18n | http://revds.revenuedomain.ie/?path=/docs/architecture-guidelines-internationalisation-i18n--docs |
| Contribution Guides | http://revds.revenuedomain.ie/?path=/docs/welcome-contribution-guides--docs |
| User Experience Foundations | http://revds.revenuedomain.ie/?path=/docs/design-system-foundations-user-experience--docs |
| Typography & Headings | http://revds.revenuedomain.ie/?path=/docs/design-system-foundations-typography-and-headings--docs |
| Icons | http://revds.revenuedomain.ie/?path=/docs/design-system-foundations-icons--docs |
| Component Showcase | http://revds.revenuedomain.ie/?path=/story/design-system-showcase--default |
| RDS Figma Project Template | https://www.figma.com/design/54mLMOlYob2egO77uIyXt9/Project-Template--File?node-id=2248-38281 |
