# CleanTrack Assets

This folder contains all static assets for the CleanTrack application.

## Folder Structure

```
public/assets/
├── logos/              # Application logos and branding
│   └── cleantrack-logo.svg
├── icons/              # Icons and favicons
└── images/             # Other images and graphics
```

## Logo Management

### Adding New Logos

1. **Add logo files** to `public/assets/logos/`
2. **Update the assets configuration** in `src/lib/assets.ts`
3. **Use the Logo component** throughout your application

### Supported Logo Formats

- **SVG** (recommended) - Scalable and crisp at any size
- **PNG** - For complex logos with transparency
- **WebP** - Modern format with good compression

### Logo Variants

You can create different versions of your logo:

- `cleantrack-logo.svg` - Main logo (current)
- `cleantrack-logo-light.svg` - Light theme variant
- `cleantrack-logo-dark.svg` - Dark theme variant
- `cleantrack-logo-horizontal.svg` - Horizontal layout
- `cleantrack-logo-mark.svg` - Logo mark only (no text)

### Usage Examples

```tsx
// Basic usage
import { Logo } from "@/components/ui/logo"

<Logo size="md" />

// With different sizes
<Logo size="xs" />  // 24x24px
<Logo size="sm" />  // 32x32px  
<Logo size="md" />  // 48x48px (default)
<Logo size="lg" />  // 64x64px
<Logo size="xl" />  // 96x96px

// Custom dimensions
<Logo size="custom" width={100} height={50} />

// Logo with text
import { LogoWithText } from "@/components/ui/logo"

<LogoWithText textSize="lg" />
```

### Configuration

Update `src/lib/assets.ts` when adding new logo variants:

```tsx
export const ASSETS = {
  logos: {
    main: '/assets/logos/cleantrack-logo.svg',
    light: '/assets/logos/cleantrack-logo-light.svg',
    dark: '/assets/logos/cleantrack-logo-dark.svg',
    horizontal: '/assets/logos/cleantrack-logo-horizontal.svg',
  }
}
```

## Best Practices

1. **Use SVG when possible** - Better for responsive design
2. **Optimize images** - Compress files to reduce bundle size
3. **Consistent naming** - Follow the `cleantrack-logo-variant.ext` pattern
4. **Update configuration** - Always update `assets.ts` when adding files
5. **Test different sizes** - Ensure logos look good at all sizes

## Current Logo

The current logo is a simple SVG with:
- Teal gradient background (`#14B8A6` to `#0D9488`)
- White sparkle effects
- 64x64px default size
- Scalable to any dimension

You can replace `cleantrack-logo.svg` with your own logo file to update the branding throughout the entire application. 