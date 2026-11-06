import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Imap from 'imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { DatabaseService } from '../config/database.service';
import { TicketsService } from '../tickets/tickets.service';
import { AttachmentsService } from '../attachments/attachments.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly ticketsService: TicketsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async fetchAndProcessEmails(): Promise<{ processed: number; skipped: number }> {
    this.logger.log('📧 Starting email fetch...');
    let processed = 0;
    let skipped = 0;

    // ✅ AJUSTADO: o timeout de segurança agora é dinâmico. Como o tamanho da
    // caixa só é conhecido depois do imap.search (assíncrono), usamos um timer
    // que começa com um valor base (cobrindo conexão + busca) e é reagendado
    // com um valor maior assim que soubermos quantos e-mails serão processados.
    let safetyTimer: ReturnType<typeof setTimeout>;
    let rejectOnTimeout: (err: Error) => void;
    const scheduleSafetyTimeout = (ms: number) => {
      clearTimeout(safetyTimer);
      safetyTimer = setTimeout(() => {
        rejectOnTimeout(new Error(`Email fetch timeout after ${Math.round(ms / 1000)}s`));
      }, ms);
    };

    // ✅ MUDANÇA: era "return new Promise(...)", agora é uma variável separada
    const imapPromise = new Promise<{ processed: number; skipped: number }>((resolve, reject) => {
      const imap = new Imap({
        user: this.config.get('GMAIL_USER'),
        password: this.config.get('GMAIL_APP_PASSWORD'),
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: this.config.get('IMAP_REJECT_UNAUTHORIZED', 'true') === 'true' },
        authTimeout: 10000,
        connTimeout: 15000, // ✅ ADICIONADO: timeout de conexão
      });

      imap.once('ready', () => {
        imap.openBox('INBOX/Chamados ServiceDesk', false, (err, box) => {
          if (err) {
            this.logger.error(`Erro ao abrir marcador: ${err.message}`);
            imap.end();
            return reject(err);
          }

          this.logger.log(`📂 Marcador aberto: ${box.name} (${box.messages.total} emails)`);

          imap.search(['ALL'], async (err, uids) => {
            if (err || !uids.length) {
              this.logger.log('Nenhum email no marcador Chamados ServiceDesk.');
              imap.end();
              return resolve({ processed, skipped });
            }

            // ✅ CORRIGIDO: removido o slice(0, 50) — agora processa TODOS os
            // e-mails encontrados na pasta, não apenas os primeiros 50.
            const limitedUids = uids;
            this.logger.log(`Found ${uids.length} email(s) no marcador, processing ${limitedUids.length}`);

            // ✅ AJUSTADO: agora que sabemos quantos e-mails serão processados,
            // reagendamos o timeout de segurança: base de 2 min + 3s por e-mail
            // (cobrindo parsing/anexos, com o novo timeout de parse de 90s por
            // e-mail), com teto de 30 min para evitar espera indefinida em caso
            // de falha real.
            const dynamicTimeoutMs = Math.min(
              120000 + limitedUids.length * 3000,
              30 * 60 * 1000,
            );
            scheduleSafetyTimeout(dynamicTimeoutMs);
 

			const emails: ParsedMail[] = [];
			let processedCount = 0;

			const fetch = imap.fetch(limitedUids, {
			  bodies: '',
			  markSeen: false,
			  struct: true
			});

			fetch.on('message', (msg) => {
			  // ✅ CORRIGIDO: acumula chunks como Buffer binário (não string UTF-8)
			  // para evitar corrupção de anexos binários como .xlsx durante o parse.
			  const chunks: Buffer[] = [];

			  msg.on('body', (stream) => {
				stream.on('data', (chunk: Buffer) => {
				  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
				});

				stream.once('end', async () => {
				  const buffer = Buffer.concat(chunks);
				  let mail: ParsedMail | null = null;

				  const parsePromise = new Promise<void>((resolve) => {
					simpleParser(buffer, (err, parsed) => {
					  if (err) {
						this.logger.error(`Erro ao parsear email: ${err.message}`);
					  } else {
						mail = parsed;
					  }
					  resolve();
					});
				  });

				  // ✅ AUMENTADO: 20s era insuficiente para e-mails com anexos grandes
				  // (ex.: planilhas .xlsx volumosas), fazendo-os expirar sempre no
				  // mesmo timeout — o mesmo e-mail nunca era processado, ciclo após
				  // ciclo, sem nunca virar chamado. Elevado para 90s.
				  const PARSE_TIMEOUT_MS = 90000;
				  const timedOut = await Promise.race([
					parsePromise.then(() => false),
					new Promise<boolean>((resolve) =>
					  setTimeout(() => resolve(true), PARSE_TIMEOUT_MS)
					),
				  ]);

				  if (timedOut) {
					// ✅ ADICIONADO: mesmo quando o parse completo expira, tentamos
					// extrair rapidamente só os cabeçalhos (assunto/remetente), sem
					// processar anexos, para logar QUAL e-mail travou — antes o log
					// era anônimo e não dava pra saber qual mensagem estava presa.
					try {
					  const headerOnly = await new Promise<ParsedMail | null>((resolve) => {
						simpleParser(buffer, { skipHtmlToText: true, skipTextToHtml: true } as any, (err, parsed) => {
						  resolve(err ? null : parsed);
						});
					  });
					  const subj = headerOnly?.subject || '(assunto desconhecido)';
					  const from = headerOnly?.from?.value?.[0]?.address || '(remetente desconhecido)';
					  this.logger.warn(`Parser timeout — email ignorado | Assunto: "${subj}" | De: ${from}`);
					} catch {
					  this.logger.warn('Parser timeout — email ignorado (não foi possível identificar assunto/remetente)');
					}
				  } else if (mail) {
					emails.push(mail);
				  }

				  processedCount++;

				  if (processedCount === limitedUids.length) {
					await processEmails();
				  }
				});
			  });
			});

			fetch.on('error', (err) => {
			  this.logger.error(`Fetch error: ${err.message}`);
			});

			const processEmails = async () => {
			  for (const mail of emails) {
				const subject = mail.subject || '';
				this.logger.log(`📨 Email: "${subject}" | De: ${mail.from?.value?.[0]?.address}`);

				const result = await this.processEmail(mail);
				if (result) processed++;
				else skipped++;
			  }

			  imap.end();
			  resolve({ processed, skipped });
			};

            // ✅ CORRIGIDO: removido fetch.once('end') duplicado que causava
            // processamento duplo dos e-mails e criação duplicada de chamados.
            // O processamento já é disparado dentro de stream.once('end')
            // quando processedCount === limitedUids.length.
          });
        });
      });

      imap.once('error', (err) => {
        this.logger.error(`IMAP error: ${err.message}`);
        reject(err);
      });

      imap.connect();
    });

    // Timeout inicial cobrindo apenas conexão + busca (reagendado para um valor
    // maior assim que soubermos quantos e-mails existem — ver scheduleSafetyTimeout).
    const timeoutPromise = new Promise<never>((_, reject) => {
      rejectOnTimeout = reject;
      scheduleSafetyTimeout(30000); // 30s para conectar e listar a pasta
    });

    try {
      return await Promise.race([imapPromise, timeoutPromise]);
    } finally {
      clearTimeout(safetyTimer);
    }
  }

  // --- o resto do arquivo não muda nada ---

  private async processEmail(mail: ParsedMail): Promise<boolean> {
    const senderEmail = mail.from?.value?.[0]?.address?.toLowerCase();
    const senderName = mail.from?.value?.[0]?.name || senderEmail;
    const messageId = mail.messageId;

    if (!senderEmail) {
      this.logger.warn('Email sem remetente, ignorando.');
      return false;
    }

    const isBlocked = await this.isBlacklisted(senderEmail);
    if (isBlocked) {
      this.logger.log(`⛔ Email de ${senderEmail} ignorado (blacklist)`);
      await this.logEmailEvent(senderEmail, messageId, 'BLOCKED');
      return false;
    }

    const title = mail.subject || `E-mail de ${senderName}`;
    let rawDescription = mail.text || mail.html || '';
    // Sanitização contra injeção de scripts maliciosos e tags perigosas oriundas de e-mail
    if (typeof rawDescription === 'string') {
      rawDescription = rawDescription
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/javascript:[^"']*/gi, '');
    }
    const description = rawDescription;

	const emailSentAt = mail.date
      ? new Date(mail.date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 19)
      : null;

    const ticket = await this.ticketsService.createFromEmail({
      title,
      description,
      requester_name: senderName,
      requester_email: senderEmail,
      email_message_id: messageId,
      email_sent_at: emailSentAt,
    });

    if (!ticket) {
      this.logger.log(`⏭️ Email ${messageId} já processado, ignorando.`);
      return false;
    }

	// ✅ CORRIGIDO: Oracle retorna colunas em MAIÚSCULAS, por isso ticket.id
	// era undefined. Normaliza com fallback para ticket.ID.
	const ticketId = ticket?.id ?? ticket?.ID;

	this.logger.log(`✅ Chamado #${ticketId} criado de e-mail de ${senderEmail}`);

    if (mail.attachments?.length) {
      await this.saveAttachments(ticketId, mail.attachments);
    }

    await this.logEmailEvent(senderEmail, messageId, 'PROCESSED', ticketId);
    return true;
  }

  private async saveAttachments(ticketId: number, attachments: Attachment[]): Promise<void> {
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];

    for (const att of attachments) {
      if (!ALLOWED_TYPES.includes(att.contentType)) continue;
      try {
        await this.attachmentsService.saveBuffer(
          ticketId, att.filename || 'attachment',
          att.contentType, att.content, null,
        );
      } catch (e) {
        this.logger.error(`Failed to save attachment: ${e.message}`);
      }
    }
  }

  async isBlacklisted(email: string): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT id FROM email_blacklist WHERE LOWER(email) = LOWER(:email)`,
      { email },
    );
    return rows.length > 0;
  }

  async getBlacklist(): Promise<any[]> {
    const rows = await this.db.query(
      `SELECT b.id, b.email, b.reason, b.created_at, u.name AS created_by_name
       FROM email_blacklist b
       LEFT JOIN users u ON u.id = b.created_by
       ORDER BY b.created_at DESC`,
    );
    return rows.map((r: any) => {
      const result: any = {};
      for (const key of Object.keys(r)) result[key.toLowerCase()] = r[key];
      return result;
    });
  }

  async addToBlacklist(email: string, reason: string, userId: number): Promise<any> {
    await this.db.execute(
      `INSERT INTO email_blacklist (email, reason, created_by) VALUES (:email, :reason, :userId)`,
      { email, reason, userId },
    );
    return { message: `E-mail ${email} adicionado à blacklist` };
  }

  async removeFromBlacklist(id: number): Promise<void> {
    await this.db.execute(
      `DELETE FROM email_blacklist WHERE id = :id`,
      { id },
    );
  }

  private async logEmailEvent(
    senderEmail: string, messageId: string,
    action: string, ticketId?: number,
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO logs (entity, entity_id, action, old_value, new_value)
       VALUES ('email', :ticket_id, :action, :sender, :message_id)`,
      { ticket_id: ticketId || null, action, sender: senderEmail, message_id: messageId },
    );
  }
}