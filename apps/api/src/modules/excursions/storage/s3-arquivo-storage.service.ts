import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { uuidv7 } from 'uuidv7';
import { ArquivoStorageService, ArquivoSalvo } from './arquivo-storage.service';

/**
 * Implementação real via Amazon S3.
 *
 * PRECISA em produção: `S3_BUCKET` configurado, credenciais AWS válidas
 * (variáveis padrão do SDK ou role da instância/task) e `S3_URL_BASE` com a
 * URL pública de leitura do bucket (domínio do bucket ou CloudFront na
 * frente dele). Só é instanciada quando `S3_BUCKET` está presente — ver o
 * provider factory em `excursions.module.ts`, que troca para
 * `LocalArquivoStorageService` sem essa variável (dev/CI/testes).
 */
@Injectable()
export class S3ArquivoStorageService extends ArquivoStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly urlBase: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.client = new S3Client({ region: this.config.get<string>('S3_REGION') ?? 'us-east-1' });
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.urlBase = (
      this.config.get<string>('S3_URL_BASE') ?? `https://${this.bucket}.s3.amazonaws.com`
    ).replace(/\/$/, '');
  }

  async salvar(
    buffer: Buffer,
    contentType: string,
    extensao: string,
    organizacaoId: string,
  ): Promise<ArquivoSalvo> {
    const chave = `excursoes/${organizacaoId}/${uuidv7()}.${extensao}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chave,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { chave, url: this.urlPublica(chave) };
  }

  async remover(chave: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: chave }));
  }

  urlPublica(chave: string): string {
    return `${this.urlBase}/${chave}`;
  }
}
