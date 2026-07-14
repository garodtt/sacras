import { useEffect, useState } from 'react';

// Campo genérico (texto, número ou textarea, via `linhas`) usado em toda
// a ficha. Guarda um buffer local enquanto o usuário digita e só chama
// `onSalvar` quando o campo perde o foco — evita 1 chamada ao Supabase
// por tecla digitada. Quando `editavel` é false, vira só leitura (usado
// quando quem está vendo não é o dono do personagem nem admin).
export default function CampoEditavel({
  label,
  valor,
  onSalvar,
  tipo = 'number',
  min,
  max,
  dica,
  placeholder,
  editavel = true,
  linhas, // se vier (nº de linhas), renderiza <textarea> em vez de <input>
}) {
  const [buffer, setBuffer] = useState(valor ?? '');

  // Sincroniza o buffer se o valor vindo de fora mudar (ex.: acabou de
  // salvar e o servidor devolveu o registro inteiro).
  useEffect(() => {
    setBuffer(valor ?? '');
  }, [valor]);

  function commit() {
    if (!editavel) return;

    let novo = buffer;
    if (tipo === 'number') {
      novo = buffer === '' ? 0 : Number(buffer);
      if (Number.isNaN(novo)) novo = 0;
      if (min !== undefined) novo = Math.max(min, novo);
      if (max !== undefined) novo = Math.min(max, novo);
    }

    if (novo === valor) {
      setBuffer(novo);
      return;
    }
    onSalvar(novo);
  }

  const InputTag = linhas ? 'textarea' : 'input';

  return (
    <label className="campo-editavel">
      {label && <span>{label}</span>}
      <InputTag
        type={linhas ? undefined : tipo}
        rows={linhas}
        min={linhas ? undefined : min}
        max={linhas ? undefined : max}
        value={buffer}
        disabled={!editavel}
        placeholder={placeholder}
        onChange={(e) => setBuffer(e.target.value)}
        onBlur={commit}
      />
      {dica && <small className="campo-dica">{dica}</small>}
    </label>
  );
}