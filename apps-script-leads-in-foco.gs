/**
 * In Foco · Landing "Tamanho do Prejuízo" → Google Sheets
 *
 * IMPORTANTE: este script precisa estar VINCULADO à planilha (abra a planilha e vá em
 * Extensões → Apps Script). Criado como projeto avulso, getActiveSpreadsheet() devolve
 * null e nada é gravado.
 *
 * Recebe os eventos enviados pela landing e grava na aba "Leads".
 * Cada lead ocupa UMA linha (identificada pela coluna "ID"):
 *   - evento "cadastro": cria a linha com os dados do formulário;
 *   - evento "clicou_whatsapp": completa a mesma linha com o resultado da
 *     calculadora e marca que a pessoa clicou em "Quero economizar agora".
 *
 * Como publicar: Implantar → Nova implantação → Tipo "App da Web"
 *   Executar como: Eu  ·  Quem pode acessar: Qualquer pessoa
 */

const ABA = 'Leads';

const COLUNAS = [
  'ID', 'Data do cadastro', 'Nome', 'Empresa', 'E-mail', 'WhatsApp', 'Computadores',
  'Funcionários', 'Salário médio', 'Perda mensal', 'Perda anual', 'Plano mensal',
  'Clicou no WhatsApp', 'Data do clique', 'Origem', 'UTM source', 'UTM medium',
  'UTM campaign', 'UTM content', 'UTM term', 'Página', 'Consentimento', 'Status'
];

/* Limites para barrar envio malicioso ou acidental. */
const MAX_TEXTO = 200;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const dados = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!dados.id || !dados.evento) return resposta({ ok: false, erro: 'Envio sem id ou evento.' });

    const aba = obterAba();
    const linha = encontrarLinha(aba, String(dados.id));
    const agora = new Date();

    if (dados.evento === 'cadastro') {
      const valores = {
        'ID': dados.id,
        'Nome': limpar(dados.nome),
        'Empresa': limpar(dados.empresa),
        'E-mail': limpar(dados.email),
        'WhatsApp': limpar(dados.whatsapp),
        'Computadores': numero(dados.computadores),
        'Consentimento': dados.aceite ? 'Sim' : '',
        'Origem': limpar(dados.origem),
        'UTM source': limpar(dados.utm_source),
        'UTM medium': limpar(dados.utm_medium),
        'UTM campaign': limpar(dados.utm_campaign),
        'UTM content': limpar(dados.utm_content),
        'UTM term': limpar(dados.utm_term),
        'Página': limpar(dados.pagina),
      };
      if (linha) {
        gravar(aba, linha, valores);           // pessoa corrigiu os dados e reenviou
      } else {
        valores['Data do cadastro'] = agora;
        valores['Clicou no WhatsApp'] = 'Não';
        valores['Status'] = 'Novo';
        aba.appendRow(COLUNAS.map(c => (c in valores ? valores[c] : '')));
      }
    }

    if (dados.evento === 'clicou_whatsapp') {
      const valores = {
        'Funcionários': numero(dados.funcionarios),
        'Salário médio': numero(dados.salario_medio),
        'Perda mensal': numero(dados.perda_mes),
        'Perda anual': numero(dados.perda_ano),
        'Plano mensal': numero(dados.plano_mes),
        'Clicou no WhatsApp': 'Sim',
        'Data do clique': agora,
      };
      if (linha) {
        gravar(aba, linha, valores);
      } else {                                // cadastro não chegou: cria a linha mesmo assim
        Object.assign(valores, {
          'ID': dados.id, 'Data do cadastro': agora, 'Nome': limpar(dados.nome),
          'Empresa': limpar(dados.empresa), 'E-mail': limpar(dados.email),
          'WhatsApp': limpar(dados.whatsapp), 'Computadores': numero(dados.computadores), 'Status': 'Novo',
        });
        aba.appendRow(COLUNAS.map(c => (c in valores ? valores[c] : '')));
      }
    }

    if (dados.evento !== 'cadastro' && dados.evento !== 'clicou_whatsapp') {
      return resposta({ ok: false, erro: 'Evento desconhecido: ' + dados.evento });
    }

    return resposta({ ok: true });
  } catch (err) {
    return resposta({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* Teste rápido no navegador: abrir a URL /exec deve mostrar {"ok":true,...} */
function doGet() {
  return resposta({ ok: true, servico: 'Leads In Foco' });
}

/* ---------- auxiliares ---------- */

function obterAba() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(ABA);
  if (!aba) aba = planilha.insertSheet(ABA);
  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold').setBackground('#F59600');
  }
  /* Fora do if: a aba pode ter sido criada à mão, sem os formatos de moeda, data e texto. */
  formatar(aba);
  return aba;
}

function formatar(aba) {
  const linhas = aba.getMaxRows() - 1;
  if (linhas < 1) return;
  const moeda = 'R$ #,##0.00';
  ['Salário médio', 'Perda mensal', 'Perda anual', 'Plano mensal'].forEach(c =>
    aba.getRange(2, COLUNAS.indexOf(c) + 1, linhas).setNumberFormat(moeda));
  ['Data do cadastro', 'Data do clique'].forEach(c =>
    aba.getRange(2, COLUNAS.indexOf(c) + 1, linhas).setNumberFormat('dd/MM/yyyy HH:mm'));
  /* WhatsApp como texto, para não virar número e perder o formato */
  aba.getRange(2, COLUNAS.indexOf('WhatsApp') + 1, linhas).setNumberFormat('@');
}

function encontrarLinha(aba, id) {
  const ultima = aba.getLastRow();
  if (ultima < 2) return null;
  const achou = aba.getRange(2, 1, ultima - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return achou ? achou.getRow() : null;
}

function gravar(aba, linha, valores) {
  Object.keys(valores).forEach(c => {
    const col = COLUNAS.indexOf(c);
    if (col >= 0 && valores[c] !== '' && valores[c] !== null) aba.getRange(linha, col + 1).setValue(valores[c]);
  });
}

/* Remove espaços extras e impede fórmulas injetadas (=, +, -, @ no início). */
function limpar(v) {
  if (v === undefined || v === null) return '';
  let t = String(v).trim().slice(0, MAX_TEXTO);
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}

function numero(v) {
  const n = Number(v);
  return isFinite(n) ? n : '';
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* Rode uma vez pelo editor (▶ Executar → testarGravacao) para autorizar e conferir a planilha. */
function testarGravacao() {
  const id = 'TESTE-' + Date.now();
  doPost({ postData: { contents: JSON.stringify({ evento: 'cadastro', id, nome: 'Teste In Foco', empresa: 'Empresa Teste', email: 'teste@exemplo.com', whatsapp: '(69) 99999-9999', computadores: 10, aceite: true, origem: 'teste' }) } });
  doPost({ postData: { contents: JSON.stringify({ evento: 'clicou_whatsapp', id, funcionarios: 10, salario_medio: 1621, perda_mes: 2432.1, perda_ano: 29185.2, plano_mes: 159 }) } });
}
