import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config()

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log(supabaseUrl, supabaseServiceKey)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
