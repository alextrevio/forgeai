---
name: Dashboard
slug: dashboard
agentType: coder
category: web
tags: [dashboard, charts, data-tables, analytics, react]
tools: [terminal, filesystem]
description: Crear dashboard de analytics con gráficos, métricas KPI y tablas de datos
---

# Dashboard Skill

## Objetivo
Crear un dashboard de analytics interactivo con métricas KPI, gráficos, y tablas de datos.

## Stack
- React 18+ con Vite
- TypeScript
- Tailwind CSS
- Recharts para gráficos
- Lucide React para iconos
- date-fns para formateo de fechas

## Layout

```
┌─────────────────────────────────────────────────┐
│ Sidebar (fixed)  │  Main Content                │
│                  │  ┌────────────────────────┐   │
│ Logo             │  │ Header: Title + Period │   │
│ Nav items        │  ├────────────────────────┤   │
│ - Dashboard      │  │ KPI Cards (4 cols)     │   │
│ - Analytics      │  ├────────────────────────┤   │
│ - Users          │  │ Charts Row (2 cols)    │   │
│ - Settings       │  ├────────────────────────┤   │
│                  │  │ Data Table             │   │
│ User avatar      │  └────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Componentes

1. **Sidebar**
   - Logo
   - Nav items con iconos y active state
   - Collapsible en desktop
   - Bottom nav en mobile
   - User profile section

2. **KPI Cards** (4 cards en grid)
   - Valor principal grande
   - Label descriptivo
   - Trend indicator (flecha up/down + porcentaje)
   - Icono representativo
   - Color coded: verde=positivo, rojo=negativo
   - Ejemplos: Revenue, Users, Orders, Conversion Rate

3. **Charts**
   - **Line Chart**: Revenue over time (últimos 7/30/90 días)
   - **Bar Chart**: Top products/categories
   - **Pie/Donut Chart**: Traffic sources o user segments
   - **Area Chart**: User activity over time
   - Period selector: 7d, 30d, 90d, 1y

4. **Data Table**
   - Columnas: nombre, valor, fecha, status, acciones
   - Sortable por columna
   - Paginación
   - Search/filter
   - Status badges (active, pending, completed)
   - Row actions (view, edit, delete)

5. **Header**
   - Page title
   - Date range picker
   - Export button
   - Refresh button

## Datos Mock
Generar datos realistas con:
- Tendencias temporales (últimos 30 días)
- Variación natural en métricas
- Diferentes status para tabla
- Nombres y valores verosímiles

## Design Guidelines
- Dark mode: bg-[#0A0A0A] sidebar, bg-[#111111] cards
- Borders: border-[#2A2A2A]
- Charts con colores del accent palette (#7c3aed, #3b82f6, #22c55e, #f59e0b)
- Cards con hover effect sutil
- Responsive: sidebar collapsa en <1024px, grid adapta columnas
- Loading skeletons para datos async
- Tabular nums para cifras
- Tooltips en gráficos con datos detallados
