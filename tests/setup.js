jest.mock("../api/utils/mailer", () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: "test-message-id" }),
}));

jest.mock("mongoose", () => {
  function Schema(definition) {
    this.definition = definition;
    this.pre = jest.fn();
    this.post = jest.fn();
    this.index = jest.fn();
    this.virtual = jest.fn().mockReturnThis();
    this.get = jest.fn();
    this.set = jest.fn();
    this.plugin = jest.fn();
    this.statics = {};
    this.methods = {};
  }

  function ObjectId(id) {
    return id || "mock-object-id";
  }

  ObjectId.isValid = (id) =>
    typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

  Schema.Types = {
    ObjectId,
  };

  return {
    Schema,
    model: jest.fn(() => ({})),
    connect: jest.fn().mockResolvedValue({}),
    disconnect: jest.fn().mockResolvedValue({}),
    Types: {
      ObjectId,
    },
  };
});
