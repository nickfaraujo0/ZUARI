"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { action, cuid, files, obj } from "@/lib/action";
import { assertManager, assertProject, canUploadDocs, UserError } from "@/lib/access";
import { logActivity } from "@/lib/services";
import { removeFiles, storeDocument } from "@/lib/storage";
import { DOC_CATEGORY } from "@/lib/utils";

const refresh = () => revalidatePath("/", "layout");
const CATS = ["DRAWING", "CONTRACT", "BOQ", "QUOTATION", "PURCHASE_ORDER", "INVOICE", "REPORT", "CERTIFICATE", "OTHER"] as const;
const AUD = ["MANAGERS", "PROJECT", "EXTERNAL"] as const;

export const uploadDocument = action(async (u, fd) => {
  if (!canUploadDocs(u)) throw new UserError("You can't upload documents.");
  const d = z.object({ projectId: cuid("Project"), title: z.string().min(2, "Give the document a title").max(120), category: z.enum(CATS), audience: z.enum(AUD).default("PROJECT"), discipline: z.string().max(40).optional(), note: z.string().max(300).optional() }).parse(obj(fd));
  const project = await assertProject(u, d.projectId);
  const file = files(fd, "file")[0];
  if (!file) throw new UserError("Choose a file to upload.");
  const s = await storeDocument(file, u.companyId, project.id);
  await prisma.document.create({ data: { companyId: u.companyId, projectId: project.id, title: d.title, category: d.category, audience: d.audience, discipline: d.discipline, versions: { create: { companyId: u.companyId, version: 1, storageKey: s.key, filename: s.filename, mime: s.mime, size: s.size, note: d.note, uploadedById: u.id } } } });
  await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "DOCUMENT", message: `${u.name} uploaded ${DOC_CATEGORY[d.category].toLowerCase()} “${d.title}”`, detail: project.name });
  refresh(); return { message: "Document uploaded" };
});

export const addDocumentVersion = action(async (u, fd) => {
  if (!canUploadDocs(u)) throw new UserError("You can't upload documents.");
  const d = z.object({ documentId: cuid("Document"), note: z.string().max(300).optional() }).parse(obj(fd));
  const doc = await prisma.document.findFirst({ where: { id: d.documentId, companyId: u.companyId } });
  if (!doc) throw new UserError("Document not found.");
  const project = await assertProject(u, doc.projectId);
  const file = files(fd, "file")[0];
  if (!file) throw new UserError("Choose a file to upload.");
  const s = await storeDocument(file, u.companyId, project.id);
  const version = doc.currentVersion + 1;
  await prisma.$transaction([
    prisma.documentVersion.create({ data: { companyId: u.companyId, documentId: doc.id, version, storageKey: s.key, filename: s.filename, mime: s.mime, size: s.size, note: d.note, uploadedById: u.id } }),
    prisma.document.update({ where: { id: doc.id }, data: { currentVersion: version } }),
  ]);
  await logActivity({ companyId: u.companyId, projectId: project.id, actorId: u.id, type: "DOCUMENT", message: `${u.name} uploaded v${version} of “${doc.title}”`, detail: project.name });
  refresh(); return { message: `Version ${version} is now current` };
});

export const updateDocument = action(async (u, fd) => {
  assertManager(u);
  const d = z.object({ documentId: cuid("Document"), title: z.string().min(2).max(120), category: z.enum(CATS), audience: z.enum(AUD) }).parse(obj(fd));
  const r = await prisma.document.updateMany({ where: { id: d.documentId, companyId: u.companyId, project: { OR: [{ managerId: u.id }, { members: { some: { userId: u.id } } }, { company: { users: { some: { id: u.id, role: "DIRECTOR" } } } }] } }, data: { title: d.title, category: d.category, audience: d.audience } });
  if (!r.count) throw new UserError("Document not found.");
  refresh(); return { message: "Saved" };
});

export const deleteDocument = action(async (u, fd) => {
  assertManager(u);
  const { documentId } = z.object({ documentId: cuid("Document") }).parse(obj(fd));
  const doc = await prisma.document.findFirst({ where: { id: documentId, companyId: u.companyId }, include: { versions: { select: { storageKey: true } } } });
  if (!doc) throw new UserError("Document not found.");
  await assertProject(u, doc.projectId);
  await prisma.document.delete({ where: { id: doc.id } });
  await removeFiles(doc.versions.map((v) => v.storageKey));
  refresh();
});
