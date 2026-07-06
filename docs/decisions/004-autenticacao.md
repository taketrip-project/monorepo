# 004 — Autenticação: JWT curto + refresh rotativo persistido, senha com argon2id

**Data:** 2026-07-06 · **Autor:** backend-architect · **Status:** vigente

## Contexto

O organizador usa o app no celular, na rua; a sessão precisa persistir ao fechar e reabrir o navegador (H1.2). Ao mesmo tempo, membro removido deve perder acesso **imediatamente** (H1.3) — o que descarta JWT de vida longa sem estado no servidor. Passageiro não tem conta (fora deste ADR). Não há papéis no MVP: o JWT só precisa identificar membro + organização.

## Decisão

1. **Access token JWT (HS256) de 15 minutos** com claims `sub` (membro) e `organizacaoId` — a base do escopo multi-tenant (ADR 003). Sem estado no servidor: barato de validar em toda requisição.
2. **Refresh token opaco, rotativo, de 30 dias, persistido como hash** na tabela `sessao`. Cada uso revoga o anterior e emite um novo (detecção de reuso = roubo → revoga a família). Remover membro ou redefinir senha revoga todas as sessões do membro — o acesso morre em ≤15 min no pior caso e imediatamente para novas requisições autenticadas por refresh.
3. **Senha com argon2id** (parâmetros OWASP: memória 19 MiB, 2 iterações, paralelismo 1). Justificativa vs. bcrypt: argon2id é o vencedor do Password Hashing Competition, resistente a GPU/ASIC por custo de memória, sem o limite de 72 bytes do bcrypt, e tem implementação Node madura (`argon2`). bcrypt seria aceitável; não há razão para escolher o algoritmo mais antigo num projeto novo.
4. **Força bruta (H1.2):** contador de falhas + `bloqueado_ate` com espera progressiva (5 falhas → 1 min, dobrando até 15 min); resposta 429 com `Retry-After`.
5. **Tokens de e-mail** (redefinição de senha, convite): aleatórios de 32 bytes, armazenados como sha256, expiração curta (redefinição 1h, convite 7 dias), uso único (`usado_em`/`aceito_em`).
6. **Transporte:** tokens no corpo da resposta; o app web guarda o refresh em `localStorage` (mobile-first PWA-like, sem domínio de cookie cruzado no MVP). Mitigação de XSS é responsabilidade do frontend (sem HTML injetado) + vida curta do access token. Revisitar para cookie `httpOnly` se a superfície crescer.

## Consequências

- Logout, remoção de membro e troca de senha têm efeito imediato — critério de aceite de H1.3 atendido sem lista de revogação de JWT.
- Uma tabela a mais (`sessao`) e uma escrita por refresh (a cada ~15 min por usuário ativo): custo desprezível na escala do produto.
- A rotação de refresh exige tratamento de corrida no cliente (duas abas renovando): o servidor tolera 1 reuso dentro de janela de 30 s antes de tratar como roubo.
