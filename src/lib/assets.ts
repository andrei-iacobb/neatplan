/**
 * Asset paths configuration
 * Centralized management of all logos, icons, and images used throughout the application
 */

export const ASSETS = {
  // Logos
  logos: {
    main: '/assets/logos/logo.png',
    // Add more logo variants here as needed
    // light: '/assets/logos/cleantrack-logo-light.svg',
    // dark: '/assets/logos/cleantrack-logo-dark.svg',
    // horizontal: '/assets/logos/cleantrack-logo-horizontal.svg',
  },
  
  // Icons
  icons: {
    // Add custom icons here
    // favicon: '/assets/icons/favicon.ico',
    // appleTouchIcon: '/assets/icons/apple-touch-icon.png',
  },
  
  // Images
  images: {
    // Add other images here
    // placeholder: '/assets/images/placeholder.jpg',
    // background: '/assets/images/background.jpg',
  }
} as const

// Helper functions for easy access
export const getLogo = (variant: keyof typeof ASSETS.logos = 'main') => ASSETS.logos[variant]
export const getIcon = (name: keyof typeof ASSETS.icons) => ASSETS.icons[name]
export const getImage = (name: keyof typeof ASSETS.images) => ASSETS.images[name]

// Logo component props helper
export type LogoVariant = keyof typeof ASSETS.logos 