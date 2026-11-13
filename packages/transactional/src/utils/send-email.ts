import type { ReactElement } from "react";
import { render } from "react-email";
import { z } from "zod";

import { senderAddressSchema } from "../sender";
import type { Transport } from "../transport";

const sanitizeTagSegment = (s: string): string =>
  s
    .replaceAll(/[^\-A-Za-z0-9_]+/gv, "-")
    .replaceAll(/^-+|-+$/gv, "")
    .slice(0, 256);

const recipientSchema = z.union([z.email(), z.array(z.email())]);

const resendErrorSchema = z.object({
  message: z.string().optional(),
  name: z.string().optional(),
});

const tagSchema = z.object({
  name: z.string().transform(sanitizeTagSegment),
  value: z.string().transform(sanitizeTagSegment),
});

const emailConfigSchema = z.object({
  bcc: recipientSchema.optional(),
  cc: recipientSchema.optional(),
  from: senderAddressSchema,
  replyTo: senderAddressSchema.optional(),
  subject: z.string(),
  tags: z
    .array(tagSchema)
    .transform((arr) => arr.filter((t) => t.name.length > 0 && t.value.length > 0))
    .optional(),
  to: recipientSchema,
});

type EmailConfig = z.input<typeof emailConfigSchema>;

type SendEmailOptions = EmailConfig & {
  template: ReactElement;
  transport: Transport;
};

const sendEmail = async ({ template, transport, ...config }: SendEmailOptions) => {
  try {
    const validatedConfig = emailConfigSchema.parse(config);
    const html = await render(template);
    const text = await render(template, { plainText: true });

    const result = await transport({
      bcc: validatedConfig.bcc,
      cc: validatedConfig.cc,
      from: validatedConfig.from,
      html,
      replyTo: validatedConfig.replyTo,
      subject: validatedConfig.subject,
      tags: validatedConfig.tags,
      text,
      to: validatedConfig.to,
    });

    if (result.error) {
      const error = resendErrorSchema.safeParse(result.error).data;
      throw new Error(
        `Failed to queue email: ${error?.name ?? "unknown_error"} - ${error?.message ?? "No message"}`,
      );
    }

    return { data: result.data, error: null, success: true };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to send email",
      success: false,
    };
  }
};

export { sendEmail };
