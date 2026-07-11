jest.mock("@aws-sdk/client-rekognition", () => ({
  RekognitionClient: jest.fn(),
  DetectModerationLabelsCommand: jest.fn().mockImplementation((input) => input),
  DetectLabelsCommand: jest.fn().mockImplementation((input) => input),
}));

let sendMock;
let rekognitionService;
let RekognitionClient;

beforeEach(() => {
  jest.resetModules();
  sendMock = jest.fn();
  jest.doMock("@aws-sdk/client-rekognition", () => ({
    RekognitionClient: jest.fn(() => ({ send: sendMock })),
    DetectModerationLabelsCommand: jest
      .fn()
      .mockImplementation((input) => input),
    DetectLabelsCommand: jest.fn().mockImplementation((input) => input),
  }));

  ({ RekognitionClient } = require("@aws-sdk/client-rekognition"));
  rekognitionService = require("../../api/services/rekognitionService");
});

describe("rekognitionService.validateImage", () => {
  it("rejects images that do not contain a bag", async () => {
    sendMock
      .mockResolvedValueOnce({ ModerationLabels: [] })
      .mockResolvedValueOnce({
        Labels: [{ Name: "Person", Confidence: 95 }],
      });

    await expect(
      rekognitionService.validateImage(Buffer.from("test")),
    ).rejects.toThrow("La imagen no parece contener un bolso.");
  });

  it("accepts images that contain a bag", async () => {
    sendMock
      .mockResolvedValueOnce({ ModerationLabels: [] })
      .mockResolvedValueOnce({
        Labels: [{ Name: "Handbag", Confidence: 95 }],
      });

    await expect(
      rekognitionService.validateImage(Buffer.from("test")),
    ).resolves.toBe(true);
  });
});
