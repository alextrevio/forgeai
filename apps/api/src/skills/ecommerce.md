---
name: E-commerce
slug: ecommerce
agentType: coder
category: web
tags: [ecommerce, react, carrito, checkout, tailwind]
tools: [terminal, filesystem]
description: Crear tienda online con catálogo de productos, carrito de compras y checkout
---

# E-commerce Skill

## Objetivo
Crear una tienda online funcional con catálogo de productos, carrito de compras, y flujo de checkout completo.

## Stack
- React 18+ con Vite
- TypeScript
- Tailwind CSS
- React Router v6
- Zustand para estado global (carrito)
- Lucide React para iconos

## Páginas Principales

1. **Home / Catálogo**
   - Grid de productos (responsive: 1-2-3-4 columnas)
   - Filtros por categoría, precio, rating
   - Barra de búsqueda
   - Ordenar por: relevancia, precio, nuevo

2. **Producto Detalle**
   - Galería de imágenes con thumbnails
   - Nombre, precio, descripción
   - Selector de variantes (talla, color)
   - Selector de cantidad
   - Botón "Agregar al carrito"
   - Productos relacionados

3. **Carrito**
   - Lista de items con imagen, nombre, precio, cantidad
   - Modificar cantidad / eliminar item
   - Subtotal, impuestos, total
   - Botón "Proceder al checkout"
   - "Seguir comprando" link

4. **Checkout**
   - Formulario de envío (nombre, dirección, ciudad, CP)
   - Selección de método de envío
   - Resumen del pedido
   - Formulario de pago (mockup — campos de tarjeta)
   - Botón "Confirmar pedido"

5. **Confirmación**
   - Número de orden
   - Resumen de compra
   - Estimado de entrega
   - "Seguir comprando" CTA

## Componentes Clave

- `ProductCard`: Imagen, nombre, precio, rating, botón agregar
- `CartIcon`: Icono con badge de cantidad
- `CartDrawer` o `CartPage`: Vista del carrito
- `PriceTag`: Formato de precio con moneda
- `QuantitySelector`: +/- con input numérico
- `StarRating`: Estrellas visuales

## Estado (Zustand Store)

```typescript
interface CartStore {
  items: CartItem[];
  addItem: (product: Product, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}
```

## Design Guidelines
- Imágenes de producto con aspect-ratio consistente (4:3 o 1:1)
- Precios siempre visibles y destacados
- CTA "Agregar al carrito" prominente y accesible
- Badge del carrito siempre visible en navbar
- Animación al agregar producto al carrito
- Loading skeletons para productos
- Empty states: carrito vacío, sin resultados de búsqueda
- Mobile: carrito como página completa, no drawer

## Datos Mock
Crear al menos 8-12 productos de ejemplo con:
- Imágenes placeholder (usar picsum.photos o unsplash)
- Nombres, descripciones y precios realistas
- Categorías variadas
- Ratings aleatorios
