
// IndexedDB Helper for FileSystemHandles
export const dbPromise = typeof window !== 'undefined' ? new Promise((resolve, reject) => {
  const request = indexedDB.open("RemiFolderDB", 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("handles");
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
}) : null;

export const storeHandle = async (key, value) => {
  const db = await dbPromise;
  const tx = db.transaction("handles", "readwrite");
  tx.objectStore("handles").put(value, key);
  return new Promise((r) => (tx.oncomplete = r));
};

export const getHandle = async (key) => {
  const db = await dbPromise;
  const tx = db.transaction("handles", "readonly");
  const request = tx.objectStore("handles").get(key);
  return new Promise((r) => (request.onsuccess = () => r(request.result)));
};
