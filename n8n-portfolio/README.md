# Automatizaciones n8n + IA

Sistemas de automatización inteligentes construidos en n8n para gestión de negocios. Cada carpeta es un caso de uso real con agentes de IA integrados.

---

## 01 — Agente de Reservas (Masajes)

Sistema completo de gestión de citas para un centro de masajes. El cliente escribe por WhatsApp en lenguaje natural y el agente entiende, agenda, modifica o cancela la cita automáticamente.

**Workflows:** agente principal · verificación de disponibilidad · confirmación de fecha · modificación · cancelación · entrega de horarios · derivación a asesor humano · gestión de ausencias · embeddings de base de conocimiento

---

## 02 — Agente de Reservas (Lavadero)

Mismo sistema adaptado para un lavado de autos. Incluye chatbot de WhatsApp, verificación de slots disponibles y confirmación automática.

**Workflows:** chatbot · reserva · cancelación · modificación · disponibilidad · horarios · derivación · ausencias · embeddings

---

## 03 — Lead Generation

Pipeline automatizado completo: desde la búsqueda de prospectos hasta el envío del mensaje personalizado.

1. **Lead Scraper + Calificador** — extrae y filtra prospectos con IA
2. **Redactor con IA** — genera mensajes personalizados por prospecto
3. **Secuencia de Envío** — gestiona los tiempos y canales de contacto

---

## 04 — Advanced Chatbot

Sistema de comunicación post-venta con automatización de seguimiento:

- Recordatorios automáticos de citas (WF_07)
- Seguimiento post-servicio (WF_08)
- Campaña de reactivación de clientes inactivos (WF_09)
- Flujos base del chatbot (WF_1 a WF_6)

---

## 05 — Gastos Personales

Agente de registro y categorización automática de gastos personales. El usuario envía el gasto por chat y el agente lo registra en una hoja de cálculo con categoría, monto y fecha.
