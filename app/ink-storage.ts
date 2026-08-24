import type { HandwritingPage } from "./exam-model";

const databaseName = "micro849-private";
const storeName = "ink-drafts";
const blobStoreName = "answer-blobs";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("secrets"))
        request.result.createObjectStore("secrets");
      if (!request.result.objectStoreNames.contains(storeName))
        request.result.createObjectStore(storeName);
      if (!request.result.objectStoreNames.contains(blobStoreName))
        request.result.createObjectStore(blobStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePhotoDraft(id: string, blob: Blob) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(blobStoreName, "readwrite")
      .objectStore(blobStoreName)
      .put(blob, id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function readPhotoDraft(id: string) {
  const db = await openDatabase();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = db
      .transaction(blobStoreName)
      .objectStore(blobStoreName)
      .get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

export async function deletePhotoDraft(id: string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(blobStoreName, "readwrite")
      .objectStore(blobStoreName)
      .delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function deleteExamLocalDrafts(
  examId: string,
  questionIds: number[],
  assetIds: string[],
) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([storeName, blobStoreName], "readwrite");
    for (const questionId of questionIds)
      transaction.objectStore(storeName).delete(`${examId}:${questionId}`);
    for (const assetId of assetIds)
      transaction.objectStore(blobStoreName).delete(assetId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function saveInkDraft(
  examId: string,
  questionId: number,
  pages: HandwritingPage[],
) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(pages, `${examId}:${questionId}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function readInkDraft(examId: string, questionId: number) {
  const db = await openDatabase();
  const value = await new Promise<HandwritingPage[] | undefined>(
    (resolve, reject) => {
      const request = db
        .transaction(storeName)
        .objectStore(storeName)
        .get(`${examId}:${questionId}`);
      request.onsuccess = () =>
        resolve(request.result as HandwritingPage[] | undefined);
      request.onerror = () => reject(request.error);
    },
  );
  db.close();
  return value;
}
