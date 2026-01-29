const docMock = () => ({
  get: () => Promise.resolve({ exists: false, data: () => undefined }),
  set: () => Promise.resolve(),
  collection: () => ({ doc: docMock }),
});

function getFirestore() {
  return { collection: () => ({ doc: docMock }) };
}
module.exports = { getFirestore };
