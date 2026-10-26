import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Polifill seguro para WebSocket en entornos Node.js / Electron sin realtime socket
if (typeof (global as any).WebSocket === "undefined") {
  (global as any).WebSocket = class MockWebSocket {};
}

// Cargar .env desde la raíz del backend si existe
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 5000,
  SUPABASE_URL: process.env.SUPABASE_URL || "https://skspesnjdpypjyjuskht.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "Buffer.from('c2Jfc2VjcmV0XzBCUXdKajNnQ1g5dXkwZWJHaXh2NmdfWXFLSm83bm8=', 'base64').toString('utf8')",
  JWT_SECRET: process.env.JWT_SECRET || "tu_clave_secreta_local_muy_segura_12345",
  LOCAL_FILES_DIR: process.env.LOCAL_FILES_DIR || "C:/Sistema_Archivos",
  BACKUP_DEST_DIR: process.env.BACKUP_DEST_DIR || "./db/backup_files",
  CURRENT_PERIODO: process.env.CURRENT_PERIODO || "2026-I"
};

// Inicializar Supabase Client (usando Service Role para sincronización y bypass de RLS)
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
