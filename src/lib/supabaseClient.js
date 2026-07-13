import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const pareceValorDeExemplo =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes('SEU-PROJETO') ||
  supabaseAnonKey.includes('sua-anon-public-key');

if (pareceValorDeExemplo) {
  throw new Error(
    '[Sacramento RPG] O ".env" ainda está com os valores de exemplo (ou não existe).\n' +
    '1. Crie um projeto em https://supabase.com/dashboard (se ainda não criou)\n' +
    '2. Em Settings -> API, copie a "Project URL" e a "anon public key"\n' +
    '3. Cole os valores reais no arquivo ".env" (não no ".env.example") nas chaves ' +
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY\n' +
    '4. Pare o servidor (Ctrl+C) e rode "npm run dev" de novo -- o Vite só lê o .env ' +
    'quando o servidor inicia, então só salvar o arquivo não é suficiente.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
