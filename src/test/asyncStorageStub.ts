const values = new Map<string, string>();

const asyncStorageStub = {
  getItem: async (key: string) => values.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    values.set(key, value);
  },
  removeItem: async (key: string) => {
    values.delete(key);
  },
};

export default asyncStorageStub;
