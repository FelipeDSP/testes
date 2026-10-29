# In Foco · Landing "Tamanho do Prejuízo"

Página estática de captura de leads com calculadora de perdas. Não tem backend próprio:
o front envia os dados para um Google Apps Script, que grava numa planilha.

```
index.html                     a landing (HTML + CSS + JS, tudo embutido)
privacidade.html               política de privacidade — RASCUNHO, precisa de revisão jurídica
favicon.ico
assets/                        logos, ícones e imagem de compartilhamento
apps-script-leads-in-foco.gs   o "backend": cola no Apps Script da planilha
teste-apps-script.js           testes do .gs, rodam no Node sem precisar do Google
*.bak                          versão original, antes das correções
```

---

## Antes de publicar

### 1. Ligar a gravação dos leads  ⚠️ sem isso nenhum lead é salvo

1. Crie uma planilha no Google Sheets.
2. Nela, vá em **Extensões → Apps Script**. Precisa ser por dentro da planilha:
   criado como projeto avulso, o script não enxerga a planilha e não grava nada.
3. Apague o conteúdo do editor e cole o `apps-script-leads-in-foco.gs`.
4. Rode a função `testarGravacao` uma vez (▶ Executar) para autorizar e conferir
   se a aba **Leads** aparece preenchida. Depois apague as linhas de teste.
5. **Implantar → Nova implantação → App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a URL gerada (termina em `/exec`) e cole em `index.html`, na constante
   `LEAD_ENDPOINT` (fica logo no começo do `<script>`).

Para conferir que funcionou: abra a página publicada, preencha o formulário e veja se a
linha aparece na planilha. Se abrir o console do navegador (F12) e houver um aviso
`[In Foco] LEAD_ENDPOINT vazio`, é porque o passo 6 não foi feito.

> Toda vez que você alterar o `.gs`, precisa fazer **Implantar → Gerenciar implantações →
> editar → Nova versão**. Sem isso a URL continua servindo o código antigo.

### 2. Domínio nas meta tags  ✅ feito

As tags `canonical`, `og:url` e `og:image` já apontam para `https://produtivo.estudyou.com`
(linhas 11, 15 e 18 do `index.html`). São elas que controlam o preview exibido quando
alguém manda o link no WhatsApp. Se o domínio mudar, troque nas três.

### 3. Fechar a política de privacidade

`privacidade.html` está marcado como rascunho e tem campos em `[COLCHETES]`: e-mail de contato,
encarregado (DPO), prazo de retenção e data. Preencha, passe pelo jurídico e **apague o bloco
de aviso vermelho** (está comentado no HTML indicando onde).

O formulário agora exige o aceite marcado, e o consentimento fica registrado na coluna
**Consentimento** da planilha — a LGPD pede que ele seja comprovável, não só coletado.

### 4. Conferir o telefone

O número está num lugar só: a constante `WHATSAPP` no `index.html`. Ela alimenta o botão do
topo, o CTA final e o telefone embaixo dele. Formato: `55` + DDD + número, só dígitos.

---

## Colocando no servidor (Coolify)

O servidor roda **Coolify** em `painel.client4you.com.br`, projeto **infoco teste.**,
ambiente **production**. O domínio `produtivo.estudyou.com` já aponta para lá.

O Coolify não aceita upload de pasta: ele puxa de um Git ou constrói um Dockerfile.
Usamos Git — assim atualizar o site vira `git push`.

**Criando o recurso (uma vez só)**

1. No projeto → **+ New** → **Public Repository** (ou *Private Repository with Deploy Key*,
   se o repo for fechado).
2. Cole a URL do repositório e selecione o branch `master`.
3. **Build Pack: Dockerfile** — não "Static" nem "Nixpacks". O `Dockerfile` da raiz já
   monta o nginx com os cabeçalhos e o cache corretos.
4. **Port: 80** (é o que o container expõe).
5. Em **Domains**, informe `https://produtivo.estudyou.com`. O Coolify emite o certificado
   via Let's Encrypt automaticamente — o TLS é terminado no proxy dele (Traefik), e por isso
   o `nginx.conf` daqui fala HTTP puro dentro do container.
6. **Deploy**.

**Atualizando depois**

```bash
git add -A && git commit -m "o que mudou" && git push
```

Se o webhook estiver ligado, o Coolify redeploya sozinho. Senão, clique em **Redeploy** no painel.

**Os dois arquivos de infraestrutura**

- `Dockerfile` — `nginx:1.27-alpine` + os arquivos estáticos. Sem build, sem dependências.
- `nginx.conf` — rotas, gzip, cache e cabeçalhos de segurança.

Cuidado ao mexer no `nginx.conf`: um `add_header` dentro de um `location` **descarta todos os
herdados do `server`**. É por isso que os cabeçalhos de segurança aparecem repetidos em cada
`location` — não é descuido. Se criar um `location` novo, repita-os lá também.

Para conferir qualquer alteração antes de subir:

```bash
docker build -t infoco-landing . && docker run --rm -p 8098:80 infoco-landing
curl -sI http://localhost:8098/        # deve trazer Cache-Control: no-cache + os 3 de segurança
```

**Checklist pós-deploy**

- [ ] A página abre em `https://produtivo.estudyou.com` com cadeado válido
- [ ] O logo aparece no topo e no rodapé (se não, o `COPY assets/` falhou no build)
- [ ] `/privacidade.html` abre e **não** está mais com o aviso vermelho de rascunho
- [ ] Mandar o link para si mesmo no WhatsApp e ver se o preview carrega a imagem
- [ ] Preencher o formulário e confirmar a linha na planilha
- [ ] Clicar em "Quero economizar agora" e ver a coluna **Clicou no WhatsApp** virar "Sim"

> Os dois últimos itens só passam depois do `LEAD_ENDPOINT` configurado.
> Enquanto ele estiver vazio, a página sobe e funciona, mas não registra nada.

---

## Como funciona

**Dois eventos, uma linha.** O formulário dispara `cadastro`, que cria a linha com um UUID.
O clique no CTA dispara `clicou_whatsapp`, que acha a mesma linha pelo UUID e completa com os
números da calculadora. Por isso a coluna **Clicou no WhatsApp** é o filtro que importa: quem
está com "Não" calculou o prejuízo e não chamou ninguém — é a fila de retomada.

**Falha é silenciosa por natureza.** O envio usa `mode: "no-cors"`, que é o que contorna o
bloqueio de CORS do Apps Script, mas em troca impede o JavaScript de ler a resposta. A página
não tem como saber se a gravação deu certo. Por isso o checklist acima pede a conferência
manual na planilha depois de publicar.

**O cálculo é propositalmente conservador:** 1h30 por dia (e não as 2h da fonte citada),
22 dias úteis e jornada de 220 h para o valor-hora. Está tudo em `calcular()`, junto com a
tabela de preços `FAIXAS` — que é uma cópia da tabela do produto. Se o preço mudar lá,
precisa mudar aqui também.

---

## Rodando local

```bash
# qualquer servidor estático serve; o importante é não abrir via file://
python -m http.server 8099
# depois: http://localhost:8099
```

Testes do Apps Script (simula a planilha, não toca no Google):

```bash
node teste-apps-script.js apps-script-leads-in-foco.gs
```

Rode-os sempre que mexer no `.gs` — principalmente se alterar a lista `COLUNAS`,
porque a ordem das colunas é o que liga o script à planilha.
