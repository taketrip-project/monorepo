import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { DATABASE_CONNECTION, type Database } from '../../db/db.provider';
import { NaoEncontradoException } from '../../common/domain-exception';
import { TenantContextStorage } from '../../common/tenant-context';
import { fotoExcursao } from './schema';
import { ArquivoStorageService } from './storage/arquivo-storage.service';
import { ExcursionsService } from './excursions.service';

/** Extensão de arquivo aceita por mimetype — únicos formatos suportados para foto de excursão. */
const MAPA_MIME_EXTENSAO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Fotos da excursão (S3). `ordem = 1` é a foto de capa (comentário do
 * schema) — removê-la promove a próxima foto (renumeração em transação,
 * mesmo padrão de `PontosEmbarqueService.remover`).
 */
@Injectable()
export class FotosService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly storage: ArquivoStorageService,
    private readonly excursionsService: ExcursionsService,
  ) {}

  async enviar(excursaoId: string, arquivo: Express.Multer.File | undefined) {
    const ctx = TenantContextStorage.get();
    await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    if (!arquivo) {
      throw new UnprocessableEntityException({
        erro: {
          codigo: 'arquivo_invalido',
          mensagem: 'Envie um arquivo de imagem no campo "arquivo".',
        },
      });
    }
    const extensao = this.validarArquivo(arquivo);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(fotoExcursao)
      .where(
        and(eq(fotoExcursao.organizacaoId, ctx.organizacaoId), eq(fotoExcursao.excursaoId, excursaoId)),
      );

    const salvo = await this.storage.salvar(
      arquivo.buffer,
      arquivo.mimetype,
      extensao,
      ctx.organizacaoId,
    );

    const [row] = await this.db
      .insert(fotoExcursao)
      .values({
        organizacaoId: ctx.organizacaoId,
        excursaoId,
        s3Key: salvo.chave,
        ordem: Number(total) + 1,
      })
      .returning();

    return { id: row.id, url: salvo.url, ordem: row.ordem };
  }

  async remover(excursaoId: string, fotoId: string): Promise<void> {
    const ctx = TenantContextStorage.get();
    await this.excursionsService.buscarExcursaoOuFalhar(excursaoId);

    const [foto] = await this.db
      .select()
      .from(fotoExcursao)
      .where(
        and(
          eq(fotoExcursao.id, fotoId),
          eq(fotoExcursao.excursaoId, excursaoId),
          eq(fotoExcursao.organizacaoId, ctx.organizacaoId),
        ),
      )
      .limit(1);
    if (!foto) throw new NaoEncontradoException();

    await this.db.transaction(async (tx) => {
      await tx
        .delete(fotoExcursao)
        .where(and(eq(fotoExcursao.id, fotoId), eq(fotoExcursao.organizacaoId, ctx.organizacaoId)));

      const restantes = await tx
        .select()
        .from(fotoExcursao)
        .where(
          and(eq(fotoExcursao.organizacaoId, ctx.organizacaoId), eq(fotoExcursao.excursaoId, excursaoId)),
        )
        .orderBy(fotoExcursao.ordem);

      for (let i = 0; i < restantes.length; i++) {
        if (restantes[i].ordem !== i + 1) {
          await tx
            .update(fotoExcursao)
            .set({ ordem: i + 1 })
            .where(
              and(eq(fotoExcursao.id, restantes[i].id), eq(fotoExcursao.organizacaoId, ctx.organizacaoId)),
            );
        }
      }
    });

    // Best-effort: a linha já foi removida do banco (fonte de verdade);
    // falha ao apagar do storage não deve reverter nem falhar a requisição.
    await this.storage.remover(foto.s3Key).catch(() => undefined);
  }

  private validarArquivo(arquivo: Express.Multer.File): string {
    const extensao = MAPA_MIME_EXTENSAO[arquivo.mimetype];
    if (!extensao) {
      throw new UnprocessableEntityException({
        erro: {
          codigo: 'arquivo_invalido',
          mensagem: 'Formato de imagem não suportado. Envie JPEG, PNG ou WebP.',
        },
      });
    }
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      throw new UnprocessableEntityException({
        erro: { codigo: 'arquivo_invalido', mensagem: 'Arquivo maior que 5MB.' },
      });
    }
    return extensao;
  }
}
