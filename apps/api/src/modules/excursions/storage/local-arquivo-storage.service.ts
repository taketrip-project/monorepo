import { Injectable, Logger } from '@nestjs/common';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { uuidv7 } from 'uuidv7';
import { ArquivoStorageService, ArquivoSalvo } from './arquivo-storage.service';

/**
 * Fake de `ArquivoStorageService` para dev sem credenciais AWS e para os
 * testes de integração (mesmo espírito de `SesEmailService` sem
 * `SES_REMETENTE`: nunca bloqueia a operação por falta de infra). Usada
 * automaticamente quando `S3_BUCKET` não está configurado (ver o provider
 * factory em `excursions.module.ts`) — grava em disco local (diretório
 * temporário do processo) em vez de bater no S3 de verdade, o que permite
 * testar o ciclo completo (salvar → obter url → remover) sem rede.
 *
 * NUNCA usar em produção: a URL retornada não é servida por nenhuma rota
 * HTTP desta API (o MVP não expõe estático) — é só um identificador estável
 * o bastante para os testes/dev local inspecionarem o comportamento.
 */
@Injectable()
export class LocalArquivoStorageService extends ArquivoStorageService {
  private readonly logger = new Logger(LocalArquivoStorageService.name);
  private readonly diretorio = join(tmpdir(), 'taketrip-fotos-dev');

  async salvar(
    buffer: Buffer,
    _contentType: string,
    extensao: string,
    organizacaoId: string,
  ): Promise<ArquivoSalvo> {
    await mkdir(this.diretorio, { recursive: true });
    const chave = `${organizacaoId}_${uuidv7()}.${extensao}`;
    await writeFile(join(this.diretorio, chave), buffer);
    this.logger.warn(
      `S3_BUCKET não configurado — foto salva localmente em ${this.diretorio} ` +
        '(esperado em dev/teste; NUNCA em produção).',
    );
    return { chave, url: this.urlPublica(chave) };
  }

  async remover(chave: string): Promise<void> {
    await rm(join(this.diretorio, chave), { force: true });
  }

  urlPublica(chave: string): string {
    return `local://taketrip-fotos-dev/${chave}`;
  }
}
