# UI & Design Modernization Track

## Current UI System
The project uses **Tailwind CSS** alongside standard React components.
Common UI elements are extracted to `apps/sistema-modular/src/components/ui/` (e.g., `Button.tsx`, `Card.tsx`, `Input.tsx`, `SearchableSelect.tsx`).

## Proposed Design Directions

To elevate the visual fidelity to a premium, modern standard (e.g., Glassmorphism, refined typography, and consistent spacing), we suggest adopting a "Modern SaaS" aesthetic.

### Direction 1: "Sleek Industrial"
* Clean, high-contrast interfaces typical for enterprise tech.
* **Primary Color:** Deep Blue/Slate (`slate-900`)
* **Accents:** Electric Blue (`blue-600`) for actions.
* **Surfaces:** Crisp white cards with subtle borders (`border-slate-200`) and slight rounded corners (`rounded-lg`).

### Direction 2: "Soft & Accessible" (Recommended)
* Reduced cognitive load, plenty of white space.
* **Primary Color:** Soft Indigo (`indigo-600`).
* **Backgrounds:** Off-white/Gray (`bg-gray-50`) for the application background, pure white for cards.
* **Typography:** `Inter` or `Outfit` sans-serif fonts.

## Mini Design System (Tailwind Tokens)

Add these to `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6', // Primary Action
          600: '#2563eb', // Hover Action
          900: '#1e3a8a', // Dark Text / Headers
        },
        surface: {
          light: '#ffffff',
          muted: '#f8fafc',
          dark: '#0f172a'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'floating': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      }
    }
  }
}
```

## Highest ROI UI Improvements

1. **Tables & Grids:** Standardize table headers, add sticky headers, hover effects on rows (`hover:bg-brand-50/50`), and consistent pagination controls.
2. **Forms & Inputs:** Use the `SearchableSelect` for all relation fields (e.g., Client, Establishment). Focus states should universally use `ring-2 ring-brand-500`.
3. **Empty/Loading/Error States:** Replace standard text with tailored empty state illustrations or Lottie animations (Lottie is already in `reportes-ot` dependencies). Add skeleton loaders instead of spinning wheels for data fetching.
4. **Badges:** Standardize status badges across exactly 4 semantics: Success (Green), Warning (Yellow), Error (Red), and Info (Blue) using soft backgrounds (`bg-green-100 text-green-800`).
5. **Sidebar/Header Consistency:** Use a coherent layout structure (`Layout.tsx`) with a sticky sidebar and breadcrumbs for deep navigation.
