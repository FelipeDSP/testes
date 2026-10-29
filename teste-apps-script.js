/* Simula o mínimo do Apps Script para rodar o .gs fora do Google. */
const fs = require('fs');
const grade = [];                          // grade[linha-1][col-1]
const sheet = {
  _max: 1000,
  getLastRow: () => grade.length,
  getMaxRows: () => sheet._max,
  setFrozenRows(){ return sheet; },
  appendRow(v){ grade.push(v.slice()); },
  getRange(l, c, n = 1, w = 1){
    return {
      setValue(v){ (grade[l-1] ??= [])[c-1] = v; },
      setNumberFormat(){ return this; },
      setFontWeight(){ return this; },
      setBackground(){ return this; },
      createTextFinder(txt){
        return { matchEntireCell(){ return this; },
          findNext(){
            for (let i = 0; i < n; i++)
              if (String((grade[l-1+i]||[])[c-1]) === String(txt))
                return { getRow: () => l + i };
            return null;
          } };
      },
    };
  },
};
global.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) };
global.LockService = { getScriptLock: () => ({ waitLock(){}, releaseLock(){} }) };
global.ContentService = { MimeType: { JSON: 'json' },
  createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }) };

eval(fs.readFileSync(process.argv[2], 'utf8') + ';global.COLUNAS=COLUNAS;global.doPost=doPost;');

const post = o => doPost({ postData: { contents: JSON.stringify(o) } });
const col = n => COLUNAS.indexOf(n);
let falhas = 0;
const check = (nome, real, esperado) => {
  const ok = String(real) === String(esperado);
  if (!ok) falhas++;
  console.log(`  ${ok ? 'ok  ' : 'FALHA'} ${nome}${ok ? '' : ` — esperado "${esperado}", veio "${real}"`}`);
};

console.log('\n1) cadastro cria a linha e registra o consentimento');
post({ evento:'cadastro', id:'A1', nome:'Maria', empresa:'Souza Ltda', email:'m@x.com',
       whatsapp:'(69) 99999-9999', computadores:10, aceite:true, origem:'landing', utm_source:'meta' });
check('uma linha criada', grade.length, 2);          // cabecalho + lead
check('nome', grade[1][col('Nome')], 'Maria');
check('consentimento', grade[1][col('Consentimento')], 'Sim');
check('UTM source', grade[1][col('UTM source')], 'meta');
check('clicou = Nao por enquanto', grade[1][col('Clicou no WhatsApp')], 'Não');
check('status inicial', grade[1][col('Status')], 'Novo');

console.log('\n2) clique no WhatsApp completa a MESMA linha');
post({ evento:'clicou_whatsapp', id:'A1', funcionarios:10, salario_medio:1621,
       perda_mes:2432.10, perda_ano:29185.20, plano_mes:159 });
check('continua uma linha so', grade.length, 2);
check('perda mensal', grade[1][col('Perda mensal')], 2432.1);
check('perda anual', grade[1][col('Perda anual')], 29185.2);
check('plano', grade[1][col('Plano mensal')], 159);
check('clicou virou Sim', grade[1][col('Clicou no WhatsApp')], 'Sim');
check('nome preservado', grade[1][col('Nome')], 'Maria');

console.log('\n3) clique sem cadastro cria a linha mesmo assim');
post({ evento:'clicou_whatsapp', id:'B2', nome:'Joao', empresa:'ACME', email:'j@x.com',
       whatsapp:'(69) 98888-8888', computadores:5, funcionarios:5, perda_mes:1216 });
check('segunda linha criada', grade.length, 3);
check('nome do orfao', grade[2][col('Nome')], 'Joao');

console.log('\n4) injeção de fórmula é neutralizada');
post({ evento:'cadastro', id:'C3', nome:'=IMPORTXML(1,2)', empresa:'X', email:'c@x.com', aceite:true });
check('formula vira texto', grade[3][col('Nome')], "'=IMPORTXML(1,2)");

console.log('\n5) envios inválidos são rejeitados');
check('sem id', post({ evento:'cadastro' }).ok, false);
check('evento desconhecido', post({ evento:'hackeado', id:'D4' }).ok, false);
check('nada foi gravado a mais', grade.length, 4);

console.log(falhas ? `\n${falhas} FALHA(S)\n` : '\nTodos os testes passaram.\n');
process.exit(falhas ? 1 : 0);
