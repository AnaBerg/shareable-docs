import { z } from "zod";

const nonEmptyTrimmedStringSchema = z
  .string()
  .trim()
  .min(1, "Required");

const nonEmptyStringSchema = z.string().min(1, "Required");

const documentNameSchema = nonEmptyTrimmedStringSchema.max(
  200,
  "Name is too long",
);

const documentHtmlSchema = nonEmptyStringSchema.max(
  1_000_000,
  "Document is too large",
);

const dateSchema = z.date();
const ulidSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "Invalid ULID");

const normalizedEmailSchema = z.string().trim().toLowerCase().email();

const storedEmailSchema = z
  .string()
  .email()
  .refine((email) => email === email.trim(), {
    message: "Email must be trimmed before insertion.",
  })
  .refine((email) => email === email.toLowerCase(), {
    message: "Email must be lowercased before insertion.",
  });

const nullishDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description is too long")
  .nullish()
  .transform((description) => {
    if (description === undefined || description === null || description === "") {
      return null;
    }

    return description;
  });

export const createDocumentRequestSchema = z.object({
  name: documentNameSchema,
  description: nullishDescriptionSchema,
  html: documentHtmlSchema,
});

export const updateDocumentRequestSchema = z.object({
  html: documentHtmlSchema,
});

export const getDocumentQuerySchema = z.object({
  version: z.coerce.number().int().positive().optional(),
});

export const listDocumentsQuerySchema = z.object({
  access: z.enum(["all", "owned", "shared"]).default("all"),
});

export const shareDocumentRequestSchema = z.object({
  emails: z
    .array(normalizedEmailSchema)
    .nonempty()
    .max(50, "Too many emails")
    .transform((emails) => [...new Set(emails)]),
});

export const documentRouteParamsSchema = z.object({
  id: ulidSchema,
});

export const newDocumentSchema = z
  .object({
    id: ulidSchema,
    ownerUserId: nonEmptyStringSchema,
    name: documentNameSchema,
    description: nullishDescriptionSchema,
    createdAt: dateSchema,
    updatedAt: dateSchema,
    deletedAt: dateSchema.nullable().optional(),
  })
  .strict();

export const newDocumentVersionSchema = z
  .object({
    id: ulidSchema,
    documentId: ulidSchema,
    versionNumber: z.number().int().positive(),
    html: documentHtmlSchema,
    createdByUserId: nonEmptyStringSchema,
    createdAt: dateSchema,
  })
  .strict();

export const newDocumentShareSchema = z
  .object({
    id: ulidSchema,
    documentId: ulidSchema,
    sharedWithEmail: storedEmailSchema,
    sharedByUserId: nonEmptyStringSchema,
    createdAt: dateSchema,
  })
  .strict();

export type CreateDocumentRequest = z.infer<
  typeof createDocumentRequestSchema
>;
export type UpdateDocumentRequest = z.infer<
  typeof updateDocumentRequestSchema
>;
export type GetDocumentQuery = z.infer<typeof getDocumentQuerySchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
export type ShareDocumentRequest = z.infer<typeof shareDocumentRequestSchema>;
export type DocumentRouteParams = z.infer<typeof documentRouteParamsSchema>;
export type NewDocument = z.infer<typeof newDocumentSchema>;
export type NewDocumentVersion = z.infer<typeof newDocumentVersionSchema>;
export type NewDocumentShare = z.infer<typeof newDocumentShareSchema>;
