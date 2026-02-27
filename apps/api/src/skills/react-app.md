---
name: React App
slug: react-app
agentType: coder
category: web
tags: [react, vite, tailwind, typescript]
tools: [terminal, filesystem]
description: Crear una aplicación React moderna con Vite, TypeScript y Tailwind CSS
---

# React App Skill

## Objetivo
Crear una aplicación React moderna, rápida y bien estructurada siguiendo las mejores prácticas del ecosistema.

## Stack
- React 18+ con Vite 5+
- TypeScript strict mode
- Tailwind CSS 3+
- React Router v6
- Lucide React para iconos

## Pasos

1. **Inicializar proyecto**
   ```bash
   npm create vite@latest {name} -- --template react-ts
   cd {name}
   ```

2. **Instalar dependencias**
   ```bash
   npm install react-router-dom lucide-react clsx
   npm install -D tailwindcss postcss autoprefixer @types/node
   npx tailwindcss init -p
   ```

3. **Configurar Tailwind** en `tailwind.config.js`:
   - Content paths: `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`
   - Extend theme con colores custom del proyecto

4. **Configurar estilos base** en `src/index.css`:
   - Importar Tailwind directives (@tailwind base/components/utilities)
   - Reset CSS mínimo
   - Dark mode por default: body bg-[#0A0A0A] text-[#EDEDED]
   - Fuente: Inter o system-ui

5. **Crear estructura de carpetas**:
   ```
   src/
   ├── components/    # Componentes reutilizables
   │   ├── ui/        # Componentes base (Button, Input, Card)
   │   └── layout/    # Layout, Navbar, Footer
   ├── pages/         # Páginas/rutas
   ├── hooks/         # Custom hooks
   ├── lib/           # Utilidades, helpers
   ├── types/         # TypeScript types
   └── assets/        # Imágenes, SVGs
   ```

6. **Crear componentes base**:
   - `Layout.tsx`: Wrapper con Navbar + main content + Footer
   - `Navbar.tsx`: Logo, nav links, mobile hamburger menu
   - `Footer.tsx`: Links, copyright
   - `Button.tsx`: Variantes (primary, secondary, ghost, destructive)

7. **Configurar routing** en `App.tsx`:
   ```tsx
   <BrowserRouter>
     <Routes>
       <Route path="/" element={<Layout />}>
         <Route index element={<HomePage />} />
         <Route path="about" element={<AboutPage />} />
         <Route path="*" element={<NotFoundPage />} />
       </Route>
     </Routes>
   </BrowserRouter>
   ```

8. **Verificar que compila**: `npm run dev` y `npm run build`

## Design Guidelines
- Mobile-first responsive design
- Dark mode por default con fondo #0A0A0A
- Color accent configurable (default: #7c3aed purple)
- Transiciones suaves (duration-200)
- Componentes con estados hover/focus/active visibles
- Rounded corners consistentes (rounded-lg o rounded-xl)
- Espaciado consistente con scale de Tailwind (4, 6, 8)
- Tipografía: text-sm para body, text-lg para headings

## Convenciones
- Nombres de componentes en PascalCase
- Nombres de hooks con prefijo `use`
- Props interfaces exportadas junto al componente
- Barrel exports desde index.ts de cada carpeta
- Evitar `any` — usar tipos específicos
