# Matias Dibe — Portfolio

Desarrollador Full-Stack y especialista en automatización con IA. Construyo productos web completos y sistemas de automatización inteligentes para negocios reales.

📍 México &nbsp;·&nbsp; 📧 matiasdibe23@gmail.com

---

## Proyectos

### Fantasy WorldCup 2026
App de fantasy football full-stack para el Mundial FIFA 2026. Los usuarios arman un equipo de 15 jugadores de las 48 selecciones, configuran su XI inicial y compiten en ligas privadas con un presupuesto de $100M.

**Tech:** Next.js 16 · Supabase (PostgreSQL + Auth + RLS) · TypeScript · Tailwind CSS v4

**Highlights:**
- RPC `fichar_jugador` con bloqueo de fila (`FOR UPDATE`) — a prueba de race conditions
- Trigger de base de datos que impone el límite de 11 titulares a nivel de motor
- SVG renderer de camisetas nacionales con 5 patrones (rayas, ajedrez, mitades, etc.) para las 48 selecciones
- Motor de puntuación y precios dinámicos por jornada
- UI mobile-first con bottom tab bar y tema navy oscuro

📁 [`/fantasy-worldcup-2026`](./fantasy-worldcup-2026)

---

### Automatizaciones con n8n + IA
Sistemas de automatización construidos en n8n para gestión de negocios: reservas inteligentes, chatbots con IA, generación de leads y seguimiento post-servicio.

**Tech:** n8n · OpenAI · WhatsApp API · Google Calendar · embeddings

**Casos de uso:**
| Sistema | Descripción |
|---|---|
| Agente de reservas (Masajes) | Agenda, modifica y cancela citas por WhatsApp con IA |
| Agente de reservas (Lavadero) | Sistema completo de turnos para lavado de autos |
| Lead Generation | Scraping → calificación con IA → redacción personalizada → envío automatizado |
| Advanced Chatbot | Recordatorios automáticos, seguimiento post-servicio, campaña de reactivación |
| Gastos Personales | Registro y categorización automática de gastos |

📁 [`/n8n-portfolio`](./n8n-portfolio)

---

### Sitios Web para Negocios Locales
7 sitios web para negocios en Monterrey, México. Cada uno con animaciones de entrada, diseño responsivo mobile-first, integración de WhatsApp y optimización SEO.

**Tech:** HTML5 · CSS3 · JavaScript · Google Fonts · Intersection Observer API

**Proyectos:**
- [Hero Boxing Club](https://matiasdibe23-sys.github.io/Web-dev/hero-boxing-club.html) — academia de boxeo
- [Hotel Casa Lucía](https://matiasdibe23-sys.github.io/Web-dev/hotel-casa-lucia.html) — hotel boutique histórico
- [Kleur Salón](https://matiasdibe23-sys.github.io/Web-dev/kleur-salon.html) — salón de belleza premium en San Pedro
- [Spa Relax Soul](https://matiasdibe23-sys.github.io/Web-dev/spa-relax-soul.html) — centro de bienestar holístico
- [Tecny Fitness Center](https://matiasdibe23-sys.github.io/Web-dev/tecny-fitness-center.html) — venta y reparación de equipos de gimnasio
- [Veterinaria Happy Dog](https://matiasdibe23-sys.github.io/Web-dev/veterinaria-happy-dog.html) — clínica veterinaria
- [Vida Fitness](https://matiasdibe23-sys.github.io/Web-dev/vidafitness.html) — gimnasio en Mall Plaza Lincoln

📁 [`/Web-dev`](./Web-dev)

---

## Stack general

![Next.js](https://img.shields.io/badge/Next.js-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss&logoColor=white)
![n8n](https://img.shields.io/badge/n8n-EA4B71?logo=n8n&logoColor=white)
