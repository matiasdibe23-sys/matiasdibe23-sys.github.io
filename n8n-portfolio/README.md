# n8n automations

WhatsApp and Telegram agents built in n8n for small-business clients. Each folder is one system, exported as workflow JSON.

> **Client data removed.** These exports have no customer chats, phone numbers, calendar or sheet IDs, credentials or endpoints. Every `YOUR_*` value (credential IDs, `YOUR_CALENDAR_ID`, `YOUR_DOCUMENT_ID`, `YOUR-N8N-HOST`, `YOUR-WEBHOOK-ID`) is a placeholder you must replace. Business names in prompts appear as `[Nombre del negocio]`.

## Importing a workflow

1. In n8n: **Workflows → Import from file** and pick a `.json`.
2. Reconnect each node's credentials (OpenAI, Evolution API, Postgres, Google, Pinecone, Redis, Telegram).
3. Replace the placeholders above, and re-link each *Execute Workflow* / tool node to the imported sub-workflow, because workflow IDs differ per instance.

## Systems

### 01 · Booking agent: wellness center
A WhatsApp agent (via Evolution API) that books, modifies and cancels appointments in natural language. A main agent (OpenAI + Postgres chat memory) calls sub-workflows as tools.

**Tools:** check date · check availability · appointments · find user · register user · hand off to a human advisor  
**Also:** absence handling and a knowledge-base ingestion workflow (Google Drive trigger → text splitter → OpenAI embeddings → Pinecone)  
**Data:** Google Calendar and Sheets · Redis · Postgres

### 02 · Booking agent: car wash
The same architecture adapted to a car wash: chatbot, slot availability, booking, modification, cancellation, handoff and absences.

### 03 · Lead generation
1. **Scraper + qualifier:** receives prospects and scores them with AI.
2. **AI message writer:** drafts a personalized message per prospect.
3. **Send sequence:** controls timing and channels.

### 04 · Advanced chatbot
An orchestrator workflow on Supabase plus automated appointment reminders (WF_07), post-service follow-up (WF_08), an inactive-customer reactivation campaign (WF_09) and the base chatbot flows (WF_1 to WF_6).

### 05 · Personal expenses
A Telegram agent: send an expense as text, voice or file and it is logged to a sheet with category, amount and date.
