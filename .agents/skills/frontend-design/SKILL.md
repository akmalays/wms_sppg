---
name: frontend-design
description: Create clean, production-grade, highly usable frontend interfaces with professional aesthetics. Eliminates AI-generated design slop, cliché styling, and gimmicks in favor of crisp typography, ergonomic layout, semantic color systems, and robust UX.
license: MIT
---

# Frontend Design & UI Engineering Guidelines

This skill guides the creation of clean, production-grade, and ergonomic frontend interfaces. It prioritizes clarity, usability, accessibility, and high performance while strictly eliminating generic "AI slop" aesthetics, gimmicks, and cliché buzzwords.

---

## 1. What is "AI Slop" in UI & How to Avoid It

AI slop refers to predictable, low-effort aesthetic patterns and clichés that large language models habitually generate. These patterns look flashy at first glance on mockups but fall apart in real-world production software.

### Anti-Patterns (Strictly Avoid)
- **Repetitive Uppercase & Tracking Spam**: Slapping `text-xs uppercase tracking-wider` or `tracking-widest` on every label, table header, card header, and badge. It reduces scannability, feels mechanical, and screams AI boilerplate.
- **Cliché Purple Gradients & Glowing Blobs**: Gratuitous violet/indigo gradients (`from-violet-600 to-indigo-600`), floating blurred gradient orbs (`bg-indigo-500/20 blur-3xl`), and neon glow effects.
- **Unusable Glassmorphism**: Forcing `backdrop-blur-md bg-white/10 border-white/20` onto forms and tables where readability and contrast are ruined.
- **Novelty Layout Gimmicks**: Unpredictable diagonal flows, chaotic asymmetrical overlaps, grid-breaking elements, and decorative custom cursors or grain overlays that hinder actual work.
- **Excessive Animation Delays**: Artificial staggered entrance delays (`delay-200`, `delay-500`) on critical data grids, forms, or navigation. Users want fast, responsive tools—not a slow cinematic movie trailer.
- **Banning Standard Fonts**: Forbidding clean workhorse fonts (Inter, Geist, system fonts) in favor of quirky, illegible display fonts on data-heavy dashboards.
- **AI Marketing Buzzwords**: Copy filled with generic hype ("Transform your workflow", "Supercharge productivity", "Seamless experience", "Next-generation", "AI-powered magic").

---

## 2. Core UI Engineering Principles

### Typography & Hierarchy
1. **Natural Case Over Uppercase**: Use Sentence case or Title Case for section titles, table headers, form labels, and badges. Reserve uppercase strictly for acronyms (e.g., SKU, PO, ID, WMS, SPPG) or standardized codes.
2. **Controlled Tracking**:
   - Do **NOT** use `tracking-widest` or repetitive `tracking-wider` on body text or standard labels.
   - Use `tracking-tight` moderately only on large headlines (`text-xl` to `text-3xl`) for optical balance.
   - Body text and small utility text should use normal letter spacing (`tracking-normal`).
3. **Legible Typefaces**:
   - Use clean, modern, high-legibility typefaces (system UI stacks, Inter, Geist, Plus Jakarta Sans).
   - Ensure tabular figures (`tabular-nums`) are used for numbers, currency, timestamps, and data tables to maintain clean vertical alignment.
4. **Weight & Scale Hierarchy**:
   - Rely on subtle weight differentiation (`font-medium`, `font-semibold`) and tone (`text-slate-900`, `text-slate-600`, `text-slate-400`) rather than making everything bold.

### Color & Contrast System
1. **Semantic Roles Over Decorative Colors**:
   - **Neutrals**: Crisp slate, zinc, or gray foundations (`bg-slate-50`, `border-slate-200`, `text-slate-900`).
   - **Brand / Primary**: Single, intentional primary color tailored to the domain (e.g., emerald for agriculture/food/nutrition, blue for enterprise logistics, slate for utilities).
   - **Status Colors**: Clear, standard semantic cues:
     - Success / In-stock: Emerald / Green
     - Warning / Low-stock: Amber / Orange
     - Danger / Out-of-stock / Error: Rose / Red
     - Information / Ongoing: Sky / Blue
2. **High Contrast (WCAG AA)**: Always ensure text is easily readable against its background. Never place low-contrast gray text on tinted backgrounds.
3. **Solid, Crisp Borders**: Use subtle solid borders (`border border-slate-200`) instead of heavy shadows or blurry glows to separate cards, tables, and dialogs.

### Layout, Density & Spatial Ergonomics
1. **Structured & Predictable**:
   - Build robust, responsive flexbox and grid layouts.
   - Align labels, inputs, icons, and action buttons cleanly to an 4px/8px grid system.
2. **Appropriate Data Density**:
   - Operational tools and dashboards (WMS, ERP, analytics) need efficient information density so operators can scan multiple rows without endless scrolling.
   - Consumer / landing views can breathe with comfortable spacing, but never at the expense of functional clarity.
3. **Tables & Data Grids**:
   - Clear row separation (`divide-y divide-slate-100` or `hover:bg-slate-50/75`).
   - Left-align text and labels; right-align numbers, quantities, and currency; center-align status tags and actions.
   - Sticky headers for long tables so context isn't lost while scrolling.

### Interaction States & Accessibility
Every interactive element must explicitly account for all states:
- **Default**: Crisp and visually distinct.
- **Hover**: Subtle contrast change (`hover:bg-slate-100` or `hover:border-slate-300`).
- **Focus-Visible**: Accessible, distinct focus rings (`focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none`) for keyboard navigability.
- **Active / Pressed**: Subtle inset or scale feedback.
- **Disabled**: Clear reduced opacity and `cursor-not-allowed` without losing semantic readability.
- **Loading & Empty**: Informative empty states with actionable next steps, and smooth skeleton loaders rather than jarring blank screens.

### Motion & Animation
- Keep micro-interactions fast and utilitarian: **150ms to 200ms ease-out**.
- Modals, drawers, and dropdowns should feel snappy, not sluggish.
- Honor user preferences: respect `prefers-reduced-motion`.

### Microcopy & Language
- Use concrete, human, and domain-accurate words.
- Focus on verbs that explain the action: "Simpan Penerimaan", "Tambah Barang", "Export CSV", "Verifikasi Fisik".
- Avoid fluff, hyperbole, and artificial praise.
