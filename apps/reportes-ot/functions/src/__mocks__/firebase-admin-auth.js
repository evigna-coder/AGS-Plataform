function getAuth() {
  return { verifyIdToken: () => Promise.resolve({ uid: 'test', email: 'test@test.com' }) };
}
module.exports = { getAuth };
