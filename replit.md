# Attendance Tracker

## Overview

This is a Progressive Web App (PWA) for tracking attendance in offline environments. The application is designed for local administration use, allowing users to manage people and track their attendance without requiring an internet connection. The app features a simple, mobile-friendly interface with three main sections: daily attendance tracking, people management, and attendance history.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Single Page Application (SPA)**: Built with vanilla HTML, CSS, and JavaScript without frameworks
- **Progressive Web App**: Implements PWA standards with service worker for offline functionality and app-like experience
- **Mobile-First Design**: Responsive design optimized for mobile devices with touch-friendly interfaces
- **Component-Based Structure**: Modular view system with tab-based navigation between attendance, people, and history sections

### Data Storage

- **Local Storage**: Uses browser's localStorage for data persistence
- **Client-Side State Management**: All data managed in JavaScript objects (people array and attendanceRecords object)
- **Offline-First Approach**: No server dependency, all data stored locally on the device

### User Interface Design

- **Material Design Inspired**: Clean, modern interface with gradient headers and card-based layouts
- **Icon Integration**: Uses Font Awesome for consistent iconography
- **Toast Notifications**: Built-in feedback system for user actions
- **Modal System**: Custom modal implementation for forms and confirmations

### Caching Strategy

- **Service Worker Implementation**: Caches essential files for offline access
- **Cache-First Strategy**: Serves cached content when available, falls back to network requests
- **Resource Caching**: Includes HTML, CSS, JavaScript, manifest, and external font assets

## External Dependencies

### CDN Resources

- **Font Awesome 6.0.0**: Icon library loaded from CloudFlare CDN for user interface icons

### Browser APIs

- **Service Worker API**: For offline functionality and background caching
- **Local Storage API**: For client-side data persistence
- **Web App Manifest**: For PWA installation and app-like behavior

### PWA Standards

- **Web App Manifest**: Configured for standalone display mode with custom theming
- **Responsive Meta Tags**: Optimized for mobile devices and web app capabilities
- **Theme Colors**: Consistent branding with Material Design blue color scheme
