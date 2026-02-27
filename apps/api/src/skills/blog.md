---
name: Blog
slug: blog
agentType: coder
category: content
tags: [blog, markdown, seo, react, cms]
tools: [terminal, filesystem]
description: Crear blog con soporte de markdown, SEO optimizado y diseño editorial
---

# Blog Skill

## Objetivo
Crear un blog profesional con contenido en markdown, buen SEO, y diseño editorial limpio.

## Stack
- React 18+ con Vite
- TypeScript
- Tailwind CSS con @tailwindcss/typography
- React Router v6
- react-markdown + remark-gfm para renderizar markdown
- gray-matter para frontmatter parsing
- Lucide React para iconos
- date-fns para fechas

## Páginas

1. **Home / Blog Index**
   - Featured post grande (hero card)
   - Grid de posts recientes (2-3 columnas)
   - Sidebar con categorías y tags populares
   - Paginación o "Load more"
   - Search bar

2. **Post Detail**
   - Hero image (full width o contained)
   - Título (H1), fecha, autor, categoría
   - Tiempo de lectura estimado
   - Contenido markdown renderizado con prose styling
   - Table of Contents (auto-generado desde headings)
   - Share buttons (Twitter, LinkedIn, Copy link)
   - Author bio card al final
   - Posts relacionados

3. **Category Page**
   - Filtrado por categoría
   - Header con nombre y descripción de categoría
   - Grid de posts

4. **About / Author Page**
   - Bio del autor
   - Avatar y redes sociales
   - Lista de posts del autor

## Componentes

- `PostCard`: Imagen, título, excerpt, fecha, categoría, author avatar
- `PostContent`: Markdown renderer con prose styling
- `TableOfContents`: Auto-generated, sticky sidebar
- `ShareButtons`: Social share links
- `AuthorCard`: Avatar, nombre, bio, links
- `CategoryBadge`: Pill con color por categoría
- `ReadingTime`: Cálculo automático (words/200 = minutes)
- `SearchBar`: Search con highlight de resultados

## Content Format (Markdown con frontmatter)

```markdown
---
title: "Título del Post"
date: "2024-01-15"
author: "Nombre del Autor"
category: "Tecnología"
tags: ["react", "typescript"]
excerpt: "Breve descripción del post..."
coverImage: "/images/post-cover.jpg"
---

# Contenido del post

Párrafos, código, imágenes, etc.
```

## Posts de Ejemplo
Crear 4-6 posts de ejemplo con contenido real (300-500 palabras cada uno) sobre temas variados.

## Design Guidelines
- Tipografía editorial: serif para headings, sans-serif para body
- Prose styling via @tailwindcss/typography
- Line-height generoso (leading-relaxed)
- Max-width para texto legible (max-w-prose o ~65ch)
- Imágenes responsive con rounded corners
- Code blocks con syntax highlighting theme oscuro
- Dark mode: fondo #0A0A0A, texto #EDEDED
- Espaciado generoso entre artículos
- Subtle animations en hover de cards

## SEO
- Meta tags dinámicos por post (title, description, og:image)
- Semantic HTML (article, time, header)
- Structured data (JSON-LD) para blog posts
- Sitemap generation
- Canonical URLs
- Alt text en todas las imágenes
