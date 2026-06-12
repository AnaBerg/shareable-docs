import { z } from "zod";

const nonEmptyTrimmedStringSchema = z
  .string()
  .trim()
  .min(1, "Required");

const nonEmptyStringSchema = z.string().min(1, "Required");

const dateSchema = z.date();

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
  .nullish()
  .transform((description) => {
    if (description === undefined || description === null || description === "") {
      return null;
    }

    return description;
  });

export const createDocumentRequestSchema = z.object({
  name: nonEmptyTrimmedStringSchema,
  description: nullishDescriptionSchema,
  html: nonEmptyStringSchema,
});

export const updateDocumentRequestSchema = z.object({
  html: nonEmptyStringSchema,
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
    .transform((emails) => [...new Set(emails)]),
});

export const documentRouteParamsSchema = z.object({
  id: nonEmptyStringSchema,
});

export const newDocumentSchema = z
  .object({
    id: nonEmptyStringSchema,
    ownerUserId: nonEmptyStringSchema,
    name: nonEmptyTrimmedStringSchema,
    description: nullishDescriptionSchema,
    createdAt: dateSchema,
    updatedAt: dateSchema,
    deletedAt: dateSchema.nullable().optional(),
  })
  .strict();

export const newDocumentVersionSchema = z
  .object({
    id: nonEmptyStringSchema,
    documentId: nonEmptyStringSchema,
    versionNumber: z.number().int().positive(),
    html: nonEmptyStringSchema,
    createdByUserId: nonEmptyStringSchema,
    createdAt: dateSchema,
  })
  .strict();

export const newDocumentShareSchema = z
  .object({
    id: nonEmptyStringSchema,
    documentId: nonEmptyStringSchema,
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
