-- Migration: add_chat_conversations
-- Création des tables pour les conversations RZBot

CREATE TABLE IF NOT EXISTS "chat_conversations" (
    "id"          SERIAL PRIMARY KEY,
    "sessionId"   TEXT NOT NULL UNIQUE,
    "clientId"    INTEGER,
    "ipAddress"   TEXT,
    "userAgent"   TEXT,
    "nbMessages"  INTEGER NOT NULL DEFAULT 0,
    "creeLe"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "misAJourLe"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_conversations_clientId_fkey"
        FOREIGN KEY ("clientId") REFERENCES "utilisateurs"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id"             SERIAL PRIMARY KEY,
    "conversationId" INTEGER NOT NULL,
    "role"           TEXT NOT NULL,
    "content"        TEXT NOT NULL,
    "creeLe"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_conversationId_fkey"
        FOREIGN KEY ("conversationId") REFERENCES "chat_conversations"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS "chat_conversations_creeLe_idx"  ON "chat_conversations"("creeLe");
CREATE INDEX IF NOT EXISTS "chat_conversations_clientId_idx" ON "chat_conversations"("clientId");
CREATE INDEX IF NOT EXISTS "chat_messages_conversationId_idx" ON "chat_messages"("conversationId");

-- Trigger pour mettre à jour misAJourLe automatiquement
CREATE OR REPLACE FUNCTION update_chat_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."misAJourLe" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_conversations_updated_at ON "chat_conversations";
CREATE TRIGGER chat_conversations_updated_at
    BEFORE UPDATE ON "chat_conversations"
    FOR EACH ROW EXECUTE FUNCTION update_chat_conversation_updated_at();
